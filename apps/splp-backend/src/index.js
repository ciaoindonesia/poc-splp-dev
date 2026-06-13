const express = require('express')
const cors    = require('cors')
const { v4: uuidv4 } = require('uuid')
const { WebSocketServer } = require('ws')
const http  = require('http')
const https = require('https')
const net   = require('net')

const app    = express()
const server = http.createServer(app)
const wss    = new WebSocketServer({ server, path: '/ws/events' })

app.use(cors())
app.use(express.json())

const PORT = process.env.PORT || 3002

/* ── Helpers ─────────────────────────────────────── */
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
const AGENCIES = ['dukcapil','bpjs-kes','bpjs-tk','djp','kemendagri','kemenkes','kemensos','polri','kemenkumham','ppatk']
const APIS     = ['Verifikasi NIK','Status Kepesertaan BPJS','Verifikasi NPWP','Data Kependudukan','Verifikasi JHT','Data STNK/BPKB','Data Bansos','Status Pajak','Rekam Medis','Status WNI/WNA']
const TOPICS   = ['splp.data-exchange','splp.api-events','splp.notifications','splp.audit-log','agency.dukcapil','agency.bpjs','agency.djp']

const mockApiResponse = (apiName) => ({
  request_id:    uuidv4(),
  timestamp:     new Date().toISOString(),
  api:           apiName,
  status:        Math.random() > 0.05 ? 'SUCCESS' : 'ERROR',
  response_time: rand(80, 450),
  data: {
    verified:    true,
    confidence:  (95 + Math.random() * 5).toFixed(2),
    source:      'SPLP-APIGW-v2',
    gateway:     'WSO2 API Manager 4.3.0',
    trace_id:    uuidv4().replace(/-/g, '').substring(0, 16).toUpperCase(),
  },
})

const mockKafkaMessage = (topic) => ({
  message_id: uuidv4(),
  topic,
  partition: rand(0, 2),
  offset:    rand(1000, 99999),
  timestamp: new Date().toISOString(),
  key:       AGENCIES[rand(0, AGENCIES.length - 1)],
  value: {
    event_type:  ['DATA_REQUEST','DATA_RESPONSE','NOTIFICATION','AUDIT'][rand(0,3)],
    agency_from: AGENCIES[rand(0, AGENCIES.length - 1)],
    agency_to:   AGENCIES[rand(0, AGENCIES.length - 1)],
    payload_size: rand(512, 8192),
    correlation_id: uuidv4(),
  },
})

/* ── Health probe helpers ────────────────────────── */
const probeHttp = (url, timeoutMs = 4000) => new Promise(resolve => {
  const t0  = Date.now()
  const mod = url.startsWith('https') ? https : http
  try {
    const req = mod.get(url, { rejectUnauthorized: false, timeout: timeoutMs }, res => {
      res.resume()
      resolve({ ok: true, latency: Date.now() - t0, code: res.statusCode })
    })
    req.setTimeout(timeoutMs, () => { req.destroy(); resolve({ ok: false, latency: timeoutMs, error: 'timeout' }) })
    req.on('error', err => resolve({ ok: false, latency: Date.now() - t0, error: err.message }))
  } catch (err) {
    resolve({ ok: false, latency: Date.now() - t0, error: err.message })
  }
})

const probeTcp = (host, port, timeoutMs = 4000) => new Promise(resolve => {
  const t0   = Date.now()
  const sock = new net.Socket()
  sock.setTimeout(timeoutMs)
  sock.connect(port, host, () => { sock.destroy(); resolve({ ok: true,  latency: Date.now() - t0 }) })
  sock.on('error',   err => resolve({ ok: false, latency: Date.now() - t0, error: err.message }))
  sock.on('timeout', ()  => { sock.destroy(); resolve({ ok: false, latency: timeoutMs, error: 'timeout' }) })
})

/* ── Service URLs (env-overridable for k8s vs dev) ─ */
const SVC = {
  wso2Apim:    process.env.WSO2_APIM_URL    || 'https://localhost:9443',
  wso2Is:      process.env.WSO2_IS_URL      || 'https://localhost:9444',
  clickhouse:  process.env.CLICKHOUSE_URL   || 'http://localhost:8888',
  grafana:     process.env.GRAFANA_URL      || 'http://localhost:3000',
  prometheus:  process.env.PROMETHEUS_URL   || 'http://prometheus-server.monitoring.svc.cluster.local:80',
  loki:        process.env.LOKI_URL         || 'http://loki.monitoring.svc.cluster.local:3100',
  kafkaHost:   process.env.KAFKA_HOST       || 'localhost',
  kafkaPort:   parseInt(process.env.KAFKA_PORT || '30292'),
  kafkaAlt:    process.env.KAFKA_BOOTSTRAP   || '',
}

/* ── ClickHouse query helper ─────────────────────── */
const CH_USER = process.env.CLICKHOUSE_USER     || 'default'
const CH_PASS = process.env.CLICKHOUSE_PASSWORD || ''

const queryClickHouse = (sql) => new Promise((resolve, reject) => {
  const chUrl = new URL(SVC.clickhouse)
  const auth  = CH_PASS ? `&user=${encodeURIComponent(CH_USER)}&password=${encodeURIComponent(CH_PASS)}` : ''
  const options = {
    hostname: chUrl.hostname,
    port:     chUrl.port || 8123,
    path:     `/?query=${encodeURIComponent(sql + ' FORMAT JSON')}${auth}`,
    method:   'GET',
    timeout:  8000,
  }
  const req = http.request(options, res => {
    let data = ''
    res.on('data', c => { data += c })
    res.on('end', () => {
      if (res.statusCode !== 200) return reject(new Error(`ClickHouse ${res.statusCode}: ${data.substring(0,200)}`))
      try { resolve(JSON.parse(data)) } catch (e) { reject(e) }
    })
  })
  req.on('error', reject)
  req.on('timeout', () => { req.destroy(); reject(new Error('ClickHouse timeout')) })
  req.end()
})

/* ── WSO2 IS auth helper (ROPC via OAuth2 token) ─── */
const validateWso2User = (username, password) => new Promise(resolve => {
  const isUrl    = new URL(SVC.wso2Is)
  const clientId = process.env.WSO2_CLIENT_ID     || 'IH2mMW0_N4LQ6gjlXQsNJsFk_rYa'
  const clientSe = process.env.WSO2_CLIENT_SECRET || 'j7nAfZYZyKbZ8Q45_Pi5fooQQCylWnq_NfFYhfGkm0wa'
  const creds    = Buffer.from(`${clientId}:${clientSe}`).toString('base64')
  const body     = `grant_type=password&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&scope=openid`
  const options  = {
    hostname: isUrl.hostname,
    port:     isUrl.port || 9443,
    path:     '/oauth2/token',
    method:   'POST',
    headers:  { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
    rejectUnauthorized: false,
    timeout: 8000,
  }
  const req = https.request(options, res => {
    let data = ''
    res.on('data', c => { data += c })
    res.on('end', () => {
      try {
        const d = JSON.parse(data)
        if (res.statusCode === 200 && d.access_token) {
          resolve({ ok: true, user: { userName: username, access_token: d.access_token } })
        } else {
          resolve({ ok: false, status: res.statusCode, error: d.error_description || d.error })
        }
      } catch { resolve({ ok: false, error: 'parse error' }) }
    })
  })
  req.on('error', err => resolve({ ok: false, error: err.message }))
  req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'timeout' }) })
  req.write(body)
  req.end()
})

/* ── REST Routes ─────────────────────────────────── */
app.get('/api/health/services', async (_, res) => {
  const [apim, is_, ch, gf, kf, prom, loki] = await Promise.all([
    probeHttp(`${SVC.wso2Apim}/carbon/admin/login.jsp`),
    probeHttp(`${SVC.wso2Is}/carbon/admin/login.jsp`),
    probeHttp(`${SVC.clickhouse}/ping`),
    probeHttp(`${SVC.grafana}/api/health`),
    probeTcp(SVC.kafkaHost, SVC.kafkaPort).then(async r => {
      if (!r.ok && SVC.kafkaAlt) {
        const [h, p] = SVC.kafkaAlt.split(':')
        return probeTcp(h, parseInt(p))
      }
      return r
    }),
    probeHttp(`${SVC.prometheus}/-/healthy`),
    probeHttp(`${SVC.loki}/ready`),
  ])
  res.json({
    timestamp: new Date().toISOString(),
    services: {
      'WSO2 APIM':    { ok: apim.ok,  latency: apim.latency,  error: apim.error  },
      'WSO2 IS':      { ok: is_.ok,   latency: is_.latency,   error: is_.error   },
      'ClickHouse':   { ok: ch.ok,    latency: ch.latency,    error: ch.error    },
      'Grafana':      { ok: gf.ok,    latency: gf.latency,    error: gf.error    },
      'Kafka':        { ok: kf.ok,    latency: kf.latency,    error: kf.error    },
      'Prometheus':   { ok: prom.ok,  latency: prom.latency,  error: prom.error  },
      'Loki':         { ok: loki.ok,  latency: loki.latency,  error: loki.error  },
      'SPLP Backend': { ok: true,     latency: 1 },
    },
  })
})

app.get('/health', (_, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    services: {
      wso2_apim: 'connected',
      wso2_is:   'connected',
      kafka:     'connected',
      clickhouse:'connected',
    },
  })
})

app.get('/api/stats', (_, res) => {
  res.json({
    total_requests_today: rand(40000, 55000),
    total_requests_month: rand(1100000, 1400000),
    success_rate:         (98.5 + Math.random() * 1.4).toFixed(2),
    avg_latency_ms:       rand(130, 180),
    p99_latency_ms:       rand(320, 450),
    active_agencies:      10,
    active_apis:          12,
    kafka_messages_today: rand(80000, 120000),
    kafka_lag_ms:         rand(10, 90),
    data_transferred_gb:  (4 + Math.random() * 2).toFixed(2),
  })
})

app.post('/api/exchange/sync', (req, res) => {
  const { api_name = 'Verifikasi NIK', payload } = req.body
  const delay = rand(80, 450)
  setTimeout(() => {
    const result = mockApiResponse(api_name)
    result.request_payload = payload
    res.json(result)
  }, delay)
})

app.post('/api/exchange/async', (req, res) => {
  const { topic = 'splp.data-exchange', payload } = req.body
  const msg = mockKafkaMessage(topic)
  msg.value.original_payload = payload
  res.json({
    status:     'PUBLISHED',
    message_id: msg.message_id,
    topic:      msg.topic,
    partition:  msg.partition,
    offset:     msg.offset,
    timestamp:  msg.timestamp,
  })
})

app.get('/api/exchange/history', (_, res) => {
  const history = Array.from({ length: 20 }, () => ({
    id:           uuidv4(),
    timestamp:    new Date(Date.now() - rand(0, 3600000)).toISOString(),
    type:         Math.random() > 0.5 ? 'SYNC' : 'ASYNC',
    api:          APIS[rand(0, APIS.length - 1)],
    from:         AGENCIES[rand(0, AGENCIES.length - 1)],
    to:           AGENCIES[rand(0, AGENCIES.length - 1)],
    status:       Math.random() > 0.05 ? 'SUCCESS' : 'ERROR',
    latency_ms:   rand(80, 500),
    size_bytes:   rand(512, 8192),
  }))
  res.json(history)
})

app.get('/api/kafka/topics', (_, res) => {
  res.json(TOPICS.map(t => ({
    name:              t,
    partitions:        rand(1, 3),
    messages_per_sec:  rand(5, 120),
    total_messages:    rand(100000, 5000000),
    consumer_lag:      rand(0, 200),
    retention_hours:   168,
  })))
})

app.get('/api/kafka/messages', (req, res) => {
  const topic = req.query.topic || TOPICS[0]
  const msgs  = Array.from({ length: 10 }, () => mockKafkaMessage(topic))
  res.json(msgs)
})

app.get('/api/agencies', (_, res) => {
  res.json(AGENCIES.map(id => ({
    id,
    status:     'connected',
    latency_ms: rand(80, 400),
    sla_pct:    (97 + Math.random() * 3).toFixed(2),
    calls_today: rand(1000, 50000),
    last_seen:  new Date(Date.now() - rand(0, 60000)).toISOString(),
  })))
})

app.get('/api/analytics/hourly', (_, res) => {
  const now  = new Date()
  const data = Array.from({ length: 24 }, (_, i) => {
    const h = new Date(now)
    h.setHours(now.getHours() - 23 + i, 0, 0, 0)
    const total = rand(800, 4500)
    return {
      hour:    h.toISOString(),
      label:   `${String(h.getHours()).padStart(2,'0')}:00`,
      total,
      success: Math.floor(total * (0.97 + Math.random() * 0.025)),
      error:   Math.floor(total * (0.005 + Math.random() * 0.02)),
    }
  })
  res.json(data)
})

/* ── Auth endpoints (WSO2 IS proxy) ─────────────── */
/* Local demo users — dipakai sebagai fallback jika WSO2 IS tidak tersedia */
const LOCAL_USERS = {
  'admin':       { name: 'Admin SPLP',              agency: 'SPLP',              role: 'admin',    icon: '🏛️', password: 'admin123',    email: 'admin@splp.go.id' },
  'dukcapil':    { name: 'Operator Dukcapil',       agency: 'Dukcapil',          role: 'instansi', icon: '🏛️', password: 'instansi123', email: 'operator@dukcapil.go.id' },
  'bpjs':        { name: 'Operator BPJS Kesehatan', agency: 'BPJS Kesehatan',    role: 'instansi', icon: '🏥', password: 'instansi123', email: 'operator@bpjs-kesehatan.go.id' },
  'bpjstk':      { name: 'Operator BPJS TK',        agency: 'BPJS Ketenagakerjaan', role: 'instansi', icon: '👷', password: 'instansi123', email: 'operator@bpjsketenagakerjaan.go.id' },
  'djp':         { name: 'Operator DJP',            agency: 'DJP',               role: 'instansi', icon: '💰', password: 'instansi123', email: 'operator@pajak.go.id' },
  'polri':       { name: 'Operator POLRI',          agency: 'POLRI',             role: 'instansi', icon: '🚔', password: 'instansi123', email: 'operator@polri.go.id' },
  'kemensos':    { name: 'Operator Kemensos',       agency: 'Kemensos',          role: 'instansi', icon: '🤝', password: 'instansi123', email: 'operator@kemensos.go.id' },
  'kemenkumham': { name: 'Operator Kemenkumham',    agency: 'Kemenkumham',       role: 'instansi', icon: '⚖️', password: 'instansi123', email: 'operator@kemenkumham.go.id' },
  'kemenkes':    { name: 'Operator Kemenkes',       agency: 'Kemenkes',          role: 'instansi', icon: '⚕️', password: 'instansi123', email: 'operator@kemkes.go.id' },
  'kemendagri':  { name: 'Operator Kemendagri',     agency: 'Kemendagri',        role: 'instansi', icon: '🏠', password: 'instansi123', email: 'operator@kemendagri.go.id' },
}

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {}
  if (!username || !password) return res.status(400).json({ error: 'username and password required' })

  const key = username.toLowerCase()

  /* 1. Coba WSO2 IS terlebih dahulu */
  const result = await validateWso2User(username, password)
  if (result.ok) {
    const u = result.user
    const local = LOCAL_USERS[key]
    const meta = local || { name: u.displayName || username, agency: 'Instansi', role: 'instansi', icon: '🏢' }
    return res.json({
      token:    Buffer.from(`${username}:${Date.now()}`).toString('base64'),
      username: u.userName || username,
      name:     meta.name,
      agency:   meta.agency,
      role:     meta.role,
      icon:     meta.icon,
      email:    (u.emails && u.emails[0]) ? (u.emails[0].value || u.emails[0]) : meta.email || `${username}@splp.go.id`,
    })
  }

  /* 2. Fallback ke local user store (demo) */
  const localUser = LOCAL_USERS[key]
  if (localUser && localUser.password === password) {
    return res.json({
      token:    Buffer.from(`${username}:${Date.now()}`).toString('base64'),
      username: username,
      name:     localUser.name,
      agency:   localUser.agency,
      role:     localUser.role,
      icon:     localUser.icon,
      email:    localUser.email,
    })
  }

  return res.status(401).json({ error: 'Username atau password salah' })
})

app.get('/api/auth/verify', async (req, res) => {
  const auth = req.headers.authorization || ''
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' })
  const decoded = Buffer.from(auth.slice(7), 'base64').toString()
  const username = decoded.split(':')[0]
  res.json({ ok: true, username })
})

/* ── Analytics (real ClickHouse) ─────────────────── */
app.get('/api/analytics/summary', async (_, res) => {
  try {
    const [summary, byAgency, topApis, latencyDist] = await Promise.all([
      queryClickHouse(`
        SELECT
          count(*) as total_requests,
          countIf(status_code < 400) as success_count,
          countIf(status_code >= 400) as error_count,
          round(avg(response_time_ms), 1) as avg_latency_ms,
          round(quantile(0.99)(response_time_ms), 1) as p99_latency_ms,
          round(countIf(status_code < 400) * 100.0 / count(*), 2) as success_rate
        FROM splp.api_access_logs
        WHERE timestamp >= now() - INTERVAL 30 DAY
      `),
      queryClickHouse(`
        SELECT agency_source as agency, count(*) as calls
        FROM splp.api_access_logs
        WHERE timestamp >= now() - INTERVAL 30 DAY
        GROUP BY agency_source ORDER BY calls DESC LIMIT 8
      `),
      queryClickHouse(`
        SELECT
          api_name,
          count(*) as calls,
          countIf(status_code < 400) as success,
          countIf(status_code >= 400) as error,
          round(avg(response_time_ms), 0) as avg_ms
        FROM splp.api_access_logs
        WHERE timestamp >= now() - INTERVAL 30 DAY
        GROUP BY api_name ORDER BY calls DESC LIMIT 8
      `),
      queryClickHouse(`
        SELECT
          multiIf(response_time_ms < 100,'<100ms',response_time_ms < 200,'100-200ms',response_time_ms < 300,'200-300ms',response_time_ms < 500,'300-500ms','> 500ms') as range,
          count(*) as count
        FROM splp.api_access_logs
        WHERE timestamp >= now() - INTERVAL 30 DAY
        GROUP BY range ORDER BY range
      `),
    ])
    res.json({
      summary:      summary.data[0] || {},
      byAgency:     byAgency.data,
      topApis:      topApis.data,
      latencyDist:  latencyDist.data,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/analytics/daily', async (req, res) => {
  const days = parseInt(req.query.days || '30')
  try {
    const result = await queryClickHouse(`
      SELECT
        toDate(timestamp) as date,
        count(*) as total,
        countIf(status_code < 400) as success,
        countIf(status_code >= 400) as error
      FROM splp.api_access_logs
      WHERE timestamp >= now() - INTERVAL ${days} DAY
      GROUP BY date ORDER BY date
    `)
    res.json(result.data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* ── Mock Agency API handlers ────────────────────── */
const MOCK_NIK = () => ({ nik: '3201234567890001', nama: 'Ahmad Fauzi', valid: true, jenisKelamin: 'L', tglLahir: '1985-04-23', alamat: 'Jl. Merdeka No. 10, Jakarta Pusat', rt: '005', rw: '002', kelurahan: 'Gambir', kecamatan: 'Gambir', kabupaten: 'Jakarta Pusat', provinsi: 'DKI Jakarta', agama: 'Islam', statusPerkawinan: 'Kawin', pekerjaan: 'Wiraswasta', kewarganegaraan: 'WNI' })
const MOCK_BPJS = (no) => ({ noPeserta: no || 'BPJ001234567', nama: 'Ahmad Fauzi', status: 'AKTIF', jenisPeserta: 'Peserta Mandiri', kelasRawat: 2, faskes: 'Puskesmas Gambir I', berlakuMulai: '2023-01-01', berlakuSampai: '2026-12-31', tagihan: 0 })
const MOCK_NPWP = () => ({ npwp: '12.345.678.9-012.345', nama: 'Ahmad Fauzi', status: 'VALID', jenis: 'Orang Pribadi', terdaftar: '2010-03-15', kpp: 'KPP Pratama Jakarta Gambir', statusKepatuhan: 'Patuh' })
const MOCK_JHT  = () => ({ nik: '3201234567890001', nama: 'Ahmad Fauzi', kpj: 'TK12345678', status: 'AKTIF', saldoJHT: 18500000, saldoJP: 4200000, iuranBulanIni: 350000, perusahaan: 'PT Maju Bersama', masa: '2018-06-01' })
const MOCK_KEND = () => ({ nopol: 'B1234ABC', merk: 'Toyota', model: 'Avanza', tahun: 2021, warna: 'Putih', noRangka: 'MHFXX3BE3AJ000001', noMesin: '3SZVE0123456', pemilik: 'Ahmad Fauzi', alamat: 'Jl. Merdeka No. 10 Jakarta', statusPajak: 'LUNAS', expiry: '2027-01-15' })
const MOCK_BANSOS = () => ({ nik: '3201234567890001', nama: 'Ahmad Fauzi', status: 'TERDAFTAR', program: [{ nama: 'PKH', nominal: 750000, periode: '2026-Q1' }, { nama: 'BPNT', nominal: 200000, periode: '2026-01' }] })
const MOCK_REKMED = () => ({ nik: '3201234567890001', nama: 'Ahmad Fauzi', goldar: 'O+', riwayat: [{ tgl: '2026-01-10', faskes: 'RSUD Cengkareng', diagnosa: 'ISPA', tindakan: 'Rawat Jalan', dokter: 'dr. Siti Aminah' }] })
const MOCK_WNI   = () => ({ nik: '3201234567890001', nama: 'Ahmad Fauzi', status: 'WNI', noPassport: null, berlaku: null, kewarganegaraan: 'Indonesia' })
const MOCK_IZIN  = () => ({ nib: '9120105382735', nama: 'UD Maju Bersama', jenisUsaha: 'Perdagangan', status: 'AKTIF', terbit: '2020-08-10', pemilik: 'Ahmad Fauzi', alamat: 'Jl. Merdeka No. 10 Jakarta' })

const wrapMock = (data) => ({ request_id: uuidv4(), timestamp: new Date().toISOString(), status: 'SUCCESS', source: 'SPLP-MOCK', gateway: 'WSO2 API Manager 4.3.0', trace_id: uuidv4().replace(/-/g,'').substring(0,16).toUpperCase(), data })

app.post('/api/mock/dukcapil/v2/verify-nik',            (req, res) => res.json(wrapMock(MOCK_NIK())))
app.get( '/api/mock/dukcapil/v2/data-kependudukan',     (req, res) => res.json(wrapMock(MOCK_NIK())))
app.post('/api/mock/bpjs-kes/v1/kepesertaan',           (req, res) => res.json(wrapMock(MOCK_BPJS())))
app.get( '/api/mock/bpjs-kes/v1/tagihan',               (req, res) => res.json(wrapMock({ ...MOCK_BPJS(), tagihan: 150000, jatuhTempo: '2026-07-01' })))
app.post('/api/mock/djp/v3/verify-npwp',                (req, res) => res.json(wrapMock(MOCK_NPWP())))
app.get( '/api/mock/djp/v2/status-badan',               (req, res) => res.json(wrapMock({ ...MOCK_NPWP(), spt: [{ tahun: 2025, status: 'DILAPORKAN' }] })))
app.post('/api/mock/bpjs-tk/v1/kepesertaan-jht',        (req, res) => res.json(wrapMock(MOCK_JHT())))
app.post('/api/mock/polri/v1/kendaraan',                (req, res) => res.json(wrapMock(MOCK_KEND())))
app.get( '/api/mock/kemensos/v1/bansos',                (req, res) => res.json(wrapMock(MOCK_BANSOS())))
app.get( '/api/mock/kemenkes/v2/rekam-medis',           (req, res) => res.json(wrapMock(MOCK_REKMED())))
app.post('/api/mock/ditjen-imigrasi/v1/status-wni',     (req, res) => res.json(wrapMock(MOCK_WNI())))
app.get( '/api/mock/kemendagri/v1/perizinan',           (req, res) => res.json(wrapMock(MOCK_IZIN())))
app.all( '/api/mock/*',                                 (req, res) => res.json(wrapMock({ path: req.path, method: req.method, body: req.body })))

/* ── WSO2 APIM helper ────────────────────────────── */
const APIM_CLIENT_ID     = process.env.APIM_CLIENT_ID     || 'B9fqPOPPRc0B1XTwdbKwCDp6drUa'
const APIM_CLIENT_SECRET = process.env.APIM_CLIENT_SECRET || 'sjunTt1jFEzHJJALMvqGQGEPMJEa'
let apimTokenCache = null

const getApimToken = () => new Promise((resolve, reject) => {
  // For PoC, use admin Basic auth directly
  // OAuth2 requires valid client registration in WSO2 APIM admin console
  // To enable OAuth2: 1) Login to https://apim.pocsplp.com/publisher 2) Go to Applications 3) Create OAuth2 app 4) Update APIM_CLIENT_ID/SECRET in env
  resolve(Buffer.from('admin:admin').toString('base64'))
})

const callApim = (method, path, body) => new Promise(async (resolve, reject) => {
  try {
    const token  = await getApimToken()
    const isUrl  = new URL(SVC.wso2Apim)
    const bodyStr = body ? JSON.stringify(body) : ''
    const mod    = isUrl.protocol === 'https:' ? https : http
    const opts = {
      hostname: isUrl.hostname, port: isUrl.port || (isUrl.protocol === 'https:' ? 9443 : 8280), path,
      method, rejectUnauthorized: false, timeout: 10000,
      headers: { Authorization: `Basic ${token}`, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) } : {}) },
    }
    const req = mod.request(opts, res => {
      let d = ''; res.on('data', c => d += c)
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: d ? JSON.parse(d) : {} }) }
        catch { resolve({ status: res.statusCode, data: d }) }
      })
    })
    req.on('error', reject); req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
    if (body) req.write(bodyStr)
    req.end()
  } catch (e) { reject(e) }
})

/* ── In-memory catalog store ─────────────────────── */
const localApis = new Map()       // id → api entry (for locally-registered apis not yet in APIM)
const kafkaTopics = new Map()     // id → topic entry
const subscriptions = new Map()   // id → subscription

// Seed Kafka topics
;['splp.nik.verified','splp.bpjs.status','splp.pajak.events','splp.kendaraan.updated','splp.bansos.penerima','splp.perizinan.changed'].forEach((t, i) => {
  const id = `kt-${i+1}`
  const agencies = ['Dukcapil','BPJS Kesehatan','DJP','POLRI','Kemensos','Kemendagri']
  kafkaTopics.set(id, { id, name: t, agency: agencies[i], partitions: [1,3,3,2,2,1][i], retention: '7d', description: `Event stream ${t} dari ${agencies[i]}`, type: 'kafka', status: 'active', created: new Date().toISOString() })
})

/* ── Catalog REST API endpoints ──────────────────── */

// GET /api/catalog/apis — fetch from APIM + local store
app.get('/api/catalog/apis', async (_, res) => {
  const local = [...localApis.values()]
  try {
    const r = await callApim('GET', '/api/am/publisher/v4/apis?limit=50')
    const apimApis = (r.data.list || []).map(a => ({
      id: a.id, name: a.name, version: a.version, description: a.description || '',
      agency: a.tags?.[0] || 'SPLP', status: a.lifeCycleStatus === 'PUBLISHED' ? 'active' : a.lifeCycleStatus.toLowerCase(),
      lifeCycleStatus: a.lifeCycleStatus, endpoint: `http://api.pocsplp.com:8080/${a.context?.replace(/^\//,'')}`,
      method: 'POST', auth: 'OAuth2/JWT', category: a.tags?.[1] || 'Umum',
      rateLimit: '1000 req/min', latency: 0, sla: 99.0, source: 'wso2',
    }))
    res.json({ apis: [...apimApis, ...local], total: apimApis.length + local.length })
  } catch (e) {
    console.error('APIM call failed:', e.message)
    res.json({ apis: local, total: local.length, warning: 'APIM unreachable, showing local only' })
  }
})

// POST /api/catalog/apis — create API in APIM + local
app.post('/api/catalog/apis', async (req, res) => {
  const { name, version, description, agency, category, endpoint, method, auth, rateLimit } = req.body || {}
  if (!name || !version) return res.status(400).json({ error: 'name and version required' })
  const context = `/${agency?.toLowerCase().replace(/\s+/g,'-') || 'splp'}/${version}/${name.toLowerCase().replace(/\s+/g,'-')}`
  const apimBody = {
    name, version, description: description || name, context,
    tags: [agency || 'SPLP', category || 'Umum'],
    lifeCycleStatus: 'CREATED', type: 'HTTP',
    transport: ['http', 'https'],
    operations: [{ target: '/*', verb: method || 'POST', authType: 'Application & Application User', throttlingPolicy: 'Unlimited' }],
    endpointConfig: { endpoint_type: 'http', production_endpoints: { url: endpoint || `https://mock.api/${context}` } },
    policies: ['Unlimited'],
  }
  try {
    const r = await callApim('POST', '/api/am/publisher/v4/apis', apimBody)
    if (r.status === 201) {
      const created = { ...r.data, source: 'wso2', agency: agency || 'SPLP', category: category || 'Umum', endpoint, method, auth, rateLimit, lifeCycleStatus: 'CREATED', status: 'created' }
      res.status(201).json(created)
    } else { res.status(r.status).json(r.data) }
  } catch (e) {
    const id = uuidv4()
    const entry = { id, name, version, description, agency, category, endpoint, method, auth, rateLimit, status: 'created', lifeCycleStatus: 'CREATED', source: 'local', created: new Date().toISOString() }
    localApis.set(id, entry)
    res.status(201).json(entry)
  }
})

// POST /api/catalog/apis/:id/publish — publish in APIM
app.post('/api/catalog/apis/:id/publish', async (req, res) => {
  const { id } = req.params
  if (localApis.has(id)) {
    const entry = localApis.get(id)
    entry.lifeCycleStatus = 'PUBLISHED'; entry.status = 'active'
    return res.json({ id, lifeCycleStatus: 'PUBLISHED', message: 'Published (local)' })
  }
  try {
    const r = await callApim('POST', `/api/am/publisher/v4/apis/change-lifecycle?apiId=${id}&action=Publish`)
    if (r.status === 200 || r.status === 201) res.json({ id, lifeCycleStatus: 'PUBLISHED', ...r.data })
    else res.status(r.status).json(r.data)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET /api/catalog/topics
app.get('/api/catalog/topics', (_, res) => {
  res.json({ topics: [...kafkaTopics.values()], total: kafkaTopics.size })
})

// POST /api/catalog/topics
app.post('/api/catalog/topics', (req, res) => {
  const { name, agency, description, partitions = 1, retention = '7d' } = req.body || {}
  if (!name || !agency) return res.status(400).json({ error: 'name and agency required' })
  const id = `kt-${uuidv4().slice(0,8)}`
  const topic = { id, name, agency, description: description || name, partitions, retention, type: 'kafka', status: 'active', created: new Date().toISOString() }
  kafkaTopics.set(id, topic)
  res.status(201).json(topic)
})

// GET /api/catalog/subscriptions
app.get('/api/catalog/subscriptions', (req, res) => {
  const { agency, status: st } = req.query
  let subs = [...subscriptions.values()]
  if (agency) subs = subs.filter(s => s.agency === agency)
  if (st) subs = subs.filter(s => s.status === st)
  res.json({ subscriptions: subs, total: subs.length })
})

// POST /api/catalog/subscriptions
app.post('/api/catalog/subscriptions', (req, res) => {
  const { itemId, itemName, itemType, agency, agencyName } = req.body || {}
  if (!itemId || !agency) return res.status(400).json({ error: 'itemId and agency required' })
  const existing = [...subscriptions.values()].find(s => s.itemId === itemId && s.agency === agency)
  if (existing) return res.status(409).json({ error: 'Sudah subscribe', subscription: existing })
  const id = uuidv4()
  const sub = { id, itemId, itemName, itemType: itemType || 'api', agency, agencyName, status: 'pending', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
  subscriptions.set(id, sub)
  res.status(201).json(sub)
})

// PUT /api/catalog/subscriptions/:id — approve or reject
app.put('/api/catalog/subscriptions/:id', (req, res) => {
  const { id } = req.params
  const { status: newStatus } = req.body || {}
  if (!subscriptions.has(id)) return res.status(404).json({ error: 'Subscription not found' })
  if (!['approved', 'rejected'].includes(newStatus)) return res.status(400).json({ error: 'status must be approved or rejected' })
  const sub = subscriptions.get(id)
  sub.status = newStatus; sub.updatedAt = new Date().toISOString()
  res.json(sub)
})

// DELETE /api/catalog/subscriptions/:id — unsubscribe
app.delete('/api/catalog/subscriptions/:id', (req, res) => {
  const { id } = req.params
  if (!subscriptions.has(id)) return res.status(404).json({ error: 'Not found' })
  subscriptions.delete(id)
  res.json({ ok: true })
})

/* ── WebSocket live event feed ───────────────────── */
const broadcast = (data) => {
  const msg = JSON.stringify(data)
  wss.clients.forEach(client => {
    if (client.readyState === 1) client.send(msg)
  })
}

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'connected', message: 'SPLP live event stream connected' }))
})

setInterval(() => {
  const isKafka = Math.random() > 0.5
  broadcast({
    type:      isKafka ? 'kafka' : 'api',
    timestamp: new Date().toISOString(),
    id:        uuidv4(),
    ...(isKafka
      ? mockKafkaMessage(TOPICS[rand(0, TOPICS.length - 1)])
      : {
          api:     APIS[rand(0, APIS.length - 1)],
          from:    AGENCIES[rand(0, AGENCIES.length - 1)],
          to:      AGENCIES[rand(0, AGENCIES.length - 1)],
          status:  Math.random() > 0.05 ? 'SUCCESS' : 'ERROR',
          latency: rand(80, 450),
        }
    ),
  })
}, 1200)

server.listen(PORT, () => {
  console.log(`✅  SPLP Backend running on http://localhost:${PORT}`)
  console.log(`🔌  WebSocket live events on ws://localhost:${PORT}/ws/events`)
})
