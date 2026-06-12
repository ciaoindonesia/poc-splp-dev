import { useState, useEffect, useRef } from 'react'
import { Send, RefreshCw, Play, Zap, MessageSquare, ChevronDown } from 'lucide-react'
import { formatTimestamp, formatBytes, AGENCIES, MOCK_APIS } from '../lib/utils'
import { generateKafkaMessage, type KafkaMessage } from '../lib/mockData'

const SAMPLE_PAYLOADS: Record<string, string> = {
  'Verifikasi NIK': JSON.stringify({ nik: '3201234567890001', nama: 'Ahmad Fauzi', tgl_lahir: '1985-03-15' }, null, 2),
  'Data Kependudukan': JSON.stringify({ nik: '3201234567890001', include_fields: ['nama', 'alamat', 'status', 'kk'] }, null, 2),
  'Status Kepesertaan BPJS': JSON.stringify({ nik: '3201234567890001', jenis_jaminan: 'JKN' }, null, 2),
  'Verifikasi NPWP': JSON.stringify({ npwp: '12.345.678.9-012.345', nama_wp: 'PT Maju Bersama' }, null, 2),
}

const DEFAULT_PAYLOAD = JSON.stringify({ nik: '3201234567890001', request_id: 'REQ-2026-001' }, null, 2)

export default function DataExchange() {
  const [activeTab, setActiveTab] = useState<'sync' | 'async'>('sync')

  // Sync state
  const [srcAgency, setSrcAgency] = useState('djp')
  const [tgtAgency, setTgtAgency] = useState('dukcapil')
  const [selectedApi, setSelectedApi] = useState('api-001')
  const [payload, setPayload] = useState(DEFAULT_PAYLOAD)
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<null | { status: number; latency: number; body: object }>(null)
  const [history, setHistory] = useState<Array<{ id: string; time: string; api: string; latency: number; status: number }>>([])

  // Async state
  const [kafkaTopic, setKafkaTopic] = useState('splp.data.exchange')
  const [kafkaPayload, setKafkaPayload] = useState(DEFAULT_PAYLOAD)
  const [messages, setMessages] = useState<KafkaMessage[]>([])
  const [producing, setProducing] = useState(false)
  const msgRef = useRef<HTMLDivElement>(null)

  const api = MOCK_APIS.find(a => a.id === selectedApi)

  useEffect(() => {
    if (api && SAMPLE_PAYLOADS[api.name]) setPayload(SAMPLE_PAYLOADS[api.name])
  }, [selectedApi])

  useEffect(() => {
    const iv = setInterval(() => {
      const msg = generateKafkaMessage()
      setMessages(prev => [msg, ...prev].slice(0, 100))
    }, 2000)
    return () => clearInterval(iv)
  }, [])

  const handleSyncExchange = async () => {
    setLoading(true)
    setResponse(null)
    const start = Date.now()
    await new Promise(r => setTimeout(r, 400 + Math.random() * 600))
    const latency = Date.now() - start
    const success = Math.random() > 0.08
    const resp = {
      status: success ? 200 : 400,
      latency,
      body: success ? {
        success: true,
        transaction_id: `TXN-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
        timestamp: new Date().toISOString(),
        data: {
          nik: '3201234567890001',
          nama: 'Ahmad Fauzi Rahmanto',
          status_verifikasi: 'VALID',
          provinsi: 'Jawa Barat',
          kota: 'Bogor',
          kecamatan: 'Bogor Tengah',
          message: 'Data berhasil diverifikasi'
        }
      } : {
        success: false,
        error_code: 'DATA_NOT_FOUND',
        message: 'NIK tidak ditemukan dalam database kependudukan',
        timestamp: new Date().toISOString()
      }
    }
    setResponse(resp)
    setHistory(prev => [{
      id: `TXN-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      time: formatTimestamp(new Date()),
      api: api?.name ?? '',
      latency, status: resp.status
    }, ...prev].slice(0, 20))
    setLoading(false)
  }

  const handleProduceMessage = async () => {
    setProducing(true)
    await new Promise(r => setTimeout(r, 300))
    const msg: KafkaMessage = {
      id: Math.random().toString(36).substring(2, 8).toUpperCase(),
      timestamp: new Date().toISOString(),
      topic: kafkaTopic,
      partition: Math.floor(Math.random() * 3),
      offset: Math.floor(Math.random() * 999999),
      source: 'Portal SPLP',
      target: 'Broadcast',
      type: 'DATA_REQUEST',
      payloadSize: new TextEncoder().encode(kafkaPayload).length,
      status: 'delivered',
    }
    setMessages(prev => [msg, ...prev].slice(0, 100))
    setProducing(false)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {(['sync', 'async'] as const).map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-150 ${activeTab === t ? 'bg-white shadow-sm text-splp-700' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {t === 'sync' ? '⚡ Pertukaran Sinkron (REST via WSO2)' : '📨 Pertukaran Asinkron (Kafka)'}
          </button>
        ))}
      </div>

      {activeTab === 'sync' && (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          {/* Form */}
          <div className="xl:col-span-2 space-y-4">
            <div className="card">
              <h3 className="section-title text-base mb-4">Konfigurasi Pertukaran</h3>
              <div className="space-y-4">
                <div>
                  <label className="form-label">Instansi Pengirim</label>
                  <select className="form-select" value={srcAgency} onChange={e => setSrcAgency(e.target.value)}>
                    {AGENCIES.map(a => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Instansi Penerima</label>
                  <select className="form-select" value={tgtAgency} onChange={e => setTgtAgency(e.target.value)}>
                    {AGENCIES.map(a => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">API Endpoint</label>
                  <select className="form-select" value={selectedApi} onChange={e => setSelectedApi(e.target.value)}>
                    {MOCK_APIS.map(a => <option key={a.id} value={a.id}>{a.name} ({a.agency})</option>)}
                  </select>
                </div>
                {api && (
                  <div className="p-3 bg-splp-50 rounded-xl border border-splp-100 text-xs space-y-1">
                    <div className="flex justify-between"><span className="text-slate-500">Version:</span><span className="font-mono font-semibold text-splp-700">{api.version}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">SLA:</span><span className="font-semibold text-emerald-600">{api.sla}%</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Avg Latency:</span><span className="font-mono text-slate-700">{api.latency}ms</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Gateway:</span><span className="font-semibold text-slate-700">WSO2 APIM 4.3</span></div>
                  </div>
                )}
                <div>
                  <label className="form-label">Request Payload (JSON)</label>
                  <textarea
                    className="form-textarea font-mono text-xs h-36"
                    value={payload}
                    onChange={e => setPayload(e.target.value)}
                  />
                </div>
                <button
                  onClick={handleSyncExchange}
                  disabled={loading}
                  className="btn-primary w-full justify-center"
                >
                  {loading ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
                  {loading ? 'Memproses via WSO2 Gateway...' : 'Kirim Permintaan'}
                </button>
              </div>
            </div>

            {/* History */}
            {history.length > 0 && (
              <div className="card">
                <h4 className="font-semibold text-sm text-slate-700 mb-3">Riwayat Permintaan</h4>
                <div className="space-y-1.5 max-h-48 overflow-auto">
                  {history.map(h => (
                    <div key={h.id} className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-50 rounded-lg text-xs">
                      <span className={`w-1.5 h-1.5 rounded-full ${h.status === 200 ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      <span className="font-mono text-slate-400">{h.time}</span>
                      <span className="flex-1 text-slate-700 truncate">{h.api}</span>
                      <span className="font-mono text-slate-500">{h.latency}ms</span>
                      <span className={`font-semibold ${h.status === 200 ? 'text-emerald-600' : 'text-red-600'}`}>{h.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Response */}
          <div className="xl:col-span-3 space-y-4">
            <div className="card min-h-96">
              <div className="flex items-center justify-between mb-4">
                <h3 className="section-title text-base">Response WSO2 API Gateway</h3>
                {response && (
                  <div className="flex items-center gap-2">
                    <span className={`badge ${response.status === 200 ? 'badge-green' : 'badge-red'}`}>
                      HTTP {response.status}
                    </span>
                    <span className="badge-gray">{response.latency}ms</span>
                  </div>
                )}
              </div>

              {!response && !loading && (
                <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                  <Zap size={48} className="mb-3" />
                  <p className="text-slate-400 text-sm">Kirim permintaan untuk melihat response</p>
                  <p className="text-xs text-slate-300 mt-1">Melalui WSO2 API Gateway → Instansi Target</p>
                </div>
              )}

              {loading && (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="relative">
                    <div className="w-16 h-16 border-4 border-splp-100 rounded-full" />
                    <div className="absolute inset-0 w-16 h-16 border-4 border-splp-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                  <p className="mt-4 text-sm text-slate-500">Memproses melalui WSO2 APIM Gateway...</p>
                  <div className="mt-3 space-y-1.5 text-center">
                    {['🔐 Autentikasi via WSO2 Identity Server', '🔌 Routing ke API Gateway', '📡 Memanggil endpoint instansi target', '✅ Validasi response & logging'].map((step, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-slate-400">
                        <RefreshCw size={10} className="animate-spin" />
                        {step}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {response && !loading && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Status', value: response.status === 200 ? 'Berhasil' : 'Gagal', color: response.status === 200 ? 'text-emerald-600' : 'text-red-600' },
                      { label: 'Latency', value: `${response.latency}ms`, color: response.latency > 300 ? 'text-amber-600' : 'text-slate-700' },
                      { label: 'Gateway', value: 'WSO2 APIM', color: 'text-splp-600' },
                    ].map(m => (
                      <div key={m.label} className="bg-slate-50 rounded-xl p-3 text-center">
                        <div className={`font-bold text-lg ${m.color}`}>{m.value}</div>
                        <div className="text-xs text-slate-400">{m.label}</div>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-500 uppercase mb-2">Response Body</div>
                    <pre className="terminal text-xs overflow-auto max-h-72">
                      {JSON.stringify(response.body, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-500 uppercase mb-2">Headers (WSO2 Gateway)</div>
                    <pre className="terminal text-xs">
{`Content-Type: application/json; charset=UTF-8
X-Transaction-Id: TXN-${Math.random().toString(36).substring(2,8).toUpperCase()}
X-WSO2-Response-Time: ${response.latency}ms
X-Gateway-Version: WSO2 API Manager 4.3.0
X-OAuth2-Token: Bearer <redacted>
X-Forwarded-For: splp-gateway.kominfo.go.id
Cache-Control: no-cache, no-store`}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'async' && (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          {/* Producer */}
          <div className="xl:col-span-2 space-y-4">
            <div className="card">
              <h3 className="section-title text-base mb-4">Kafka Producer</h3>
              <div className="space-y-4">
                <div>
                  <label className="form-label">Topic</label>
                  <select className="form-select" value={kafkaTopic} onChange={e => setKafkaTopic(e.target.value)}>
                    {['splp.data.exchange', 'splp.api.events', 'splp.audit.logs', 'splp.notifications', 'dukcapil.nik.verify', 'bpjs.kepesertaan', 'djp.npwp.verify', 'kemensos.bansos'].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Message Payload (JSON)</label>
                  <textarea
                    className="form-textarea font-mono text-xs h-40"
                    value={kafkaPayload}
                    onChange={e => setKafkaPayload(e.target.value)}
                  />
                </div>
                <button
                  onClick={handleProduceMessage}
                  disabled={producing}
                  className="btn-primary w-full justify-center"
                >
                  {producing ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}
                  {producing ? 'Publishing ke Kafka...' : 'Publish Message'}
                </button>
              </div>
            </div>

            {/* Topic Stats */}
            <div className="card">
              <h4 className="font-semibold text-sm text-slate-700 mb-3">Statistik Topics</h4>
              <div className="space-y-2">
                {[
                  { topic: 'splp.data.exchange', msgs: 12834, rate: '45/s' },
                  { topic: 'dukcapil.nik.verify', msgs: 8921, rate: '32/s' },
                  { topic: 'bpjs.kepesertaan', msgs: 6543, rate: '28/s' },
                  { topic: 'djp.npwp.verify', msgs: 4321, rate: '18/s' },
                ].map(t => (
                  <div key={t.topic} className="flex items-center gap-2 text-xs p-2 rounded-lg hover:bg-slate-50">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="flex-1 font-mono text-slate-600 truncate">{t.topic}</span>
                    <span className="text-slate-400">{t.msgs.toLocaleString()}</span>
                    <span className="badge-green">{t.rate}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Consumer Feed */}
          <div className="xl:col-span-3">
            <div className="card h-full">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="section-title text-base">Kafka Consumer Feed</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Real-time messages dari semua topics</p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                  Consuming
                </div>
              </div>
              <div ref={msgRef} className="space-y-1.5 max-h-[500px] overflow-y-auto scrollbar-hide">
                {messages.map(msg => (
                  <div key={msg.id} className="font-mono text-xs bg-slate-900 text-green-400 rounded-lg px-3 py-2 space-y-0.5">
                    <div className="flex items-center gap-2 text-slate-400">
                      <span className={`w-1.5 h-1.5 rounded-full ${msg.status === 'delivered' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      <span>{formatTimestamp(msg.timestamp)}</span>
                      <span className="text-yellow-400">[{msg.topic}]</span>
                      <span>P:{msg.partition} O:{msg.offset}</span>
                      <span className="ml-auto text-slate-500">{msg.payloadSize}B</span>
                    </div>
                    <div className="text-green-300">
                      {`{"source":"${msg.source}","target":"${msg.target}","type":"${msg.type}","id":"${msg.id}"}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
