import { useState, useEffect, useCallback } from 'react'
import { Save, RefreshCw, CheckCircle2, Shield, Database, Bell, Key, Loader2, WifiOff } from 'lucide-react'
import { deriveBackendUrl } from '../lib/utils'

const BACKEND = deriveBackendUrl()

function deriveUrls() {
  if (typeof window === 'undefined') return {}
  const h = window.location.hostname
  const isLocal = h === 'localhost' || h === '127.0.0.1'
  const parts = h.split('.')
  const base = isLocal ? 'localhost' : (parts.length > 2 ? parts.slice(1).join('.') : h)
  const pfx  = isLocal ? 'http' : window.location.protocol.replace(':', '')
  return {
    wso2ApimUrl:   `${pfx}://apim.${base}/carbon`,
    wso2IsUrl:     `${pfx}://is.${base}/console`,
    grafanaUrl:    `${pfx}://grafana.${base}`,
    clickhouseUrl: `${pfx}://clickhouse.${base}`,
    prometheusUrl: 'http://prometheus-server.monitoring.svc.cluster.local:80',
    lokiUrl:       'http://loki.monitoring.svc.cluster.local:3100',
    backendUrl:    deriveBackendUrl(),
  }
}

type ServiceResult = { ok: boolean; latency: number; error?: string }
type HealthMap = Record<string, ServiceResult>

export default function Settings() {
  const [section, setSection] = useState('Koneksi')
  const [saved, setSaved] = useState(false)
  const [health, setHealth]     = useState<HealthMap | null>(null)
  const [checking, setChecking] = useState(false)
  const [checkErr, setCheckErr] = useState<string | null>(null)

  const runCheck = useCallback(async () => {
    setChecking(true)
    setCheckErr(null)
    try {
      const r = await fetch(`${BACKEND}/api/health/services`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const d = await r.json()
      setHealth(d.services)
    } catch (e: unknown) {
      setCheckErr(e instanceof Error ? e.message : 'Gagal menghubungi backend')
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => { runCheck() }, [])

  const urls = deriveUrls()
  const [conn, setConn] = useState(() => ({
    wso2ApimUrl:   urls.wso2ApimUrl   ?? 'https://wso2-apim.wso2.svc:9443',
    wso2IsUrl:     urls.wso2IsUrl     ?? 'https://wso2-is.wso2.svc:9444',
    kafkaBroker:   'splp-kafka-kafka-bootstrap.messaging.svc:9092',
    clickhouseUrl: urls.clickhouseUrl ?? 'http://clickhouse.splp.svc:8123',
    grafanaUrl:    urls.grafanaUrl    ?? 'http://grafana.monitoring.svc:80',
    prometheusUrl: urls.prometheusUrl ?? 'http://prometheus-server.monitoring.svc:80',
    lokiUrl:       urls.lokiUrl       ?? 'http://loki.monitoring.svc:3100',
    backendUrl:    urls.backendUrl    ?? 'http://splp-backend.splp.svc:3002',
  }))

  const [security, setSecurity] = useState({
    clientId: 'splp-portal-client',
    clientSecret: '••••••••••••••••',
    tokenExpiry: '3600',
    tlsVerify: true,
    auditLog: true,
    rateLimitEnabled: true,
  })

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="section-title">Pengaturan Sistem</h2>
          <p className="section-subtitle">Konfigurasi koneksi, keamanan, dan integrasi</p>
        </div>
        <button onClick={handleSave} className="btn-primary">
          {saved ? <CheckCircle2 size={16} /> : <Save size={16} />}
          {saved ? 'Tersimpan!' : 'Simpan Perubahan'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Nav */}
        <div className="card p-3 h-fit">
          <div className="space-y-1">
            {([
              { key: 'Koneksi',     icon: <Database size={14} /> },
              { key: 'Keamanan',    icon: <Shield size={14} /> },
              { key: 'Notifikasi',  icon: <Bell size={14} /> },
              { key: 'Tentang',     icon: <Key size={14} /> },
            ]).map(s => (
              <button
                key={s.key}
                onClick={() => setSection(s.key)}
                className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold text-left transition-all ${section === s.key ? 'bg-splp-50 text-splp-700 border border-splp-100' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                {s.icon} {s.key}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-3 space-y-4">

          {section === 'Koneksi' && (
            <div className="card space-y-5">
              <div>
                <h3 className="section-title text-base">Konfigurasi Koneksi</h3>
                <p className="section-subtitle text-xs">URL endpoint untuk setiap komponen infrastruktur</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {([
                  { key: 'wso2ApimUrl',   label: 'WSO2 API Manager URL',    icon: '🔌', placeholder: 'https://wso2-apim:9443' },
                  { key: 'wso2IsUrl',     label: 'WSO2 Identity Server URL', icon: '🔐', placeholder: 'https://wso2-is:9444' },
                  { key: 'kafkaBroker',   label: 'Kafka Bootstrap Server',   icon: '📨', placeholder: 'kafka:9092' },
                  { key: 'clickhouseUrl', label: 'ClickHouse HTTP URL',      icon: '🗄️', placeholder: 'http://clickhouse:8123' },
                  { key: 'grafanaUrl',    label: 'Grafana URL',              icon: '📊', placeholder: 'http://grafana:3000' },
                  { key: 'prometheusUrl', label: 'Prometheus URL',           icon: '📈', placeholder: 'http://prometheus-server:80' },
                  { key: 'lokiUrl',       label: 'Loki URL',                 icon: '📋', placeholder: 'http://loki:3100' },
                  { key: 'backendUrl',    label: 'SPLP Backend URL',         icon: '⚙️', placeholder: 'http://backend:3002' },
                ] as const).map(f => (
                  <div key={f.key}>
                    <label className="form-label flex items-center gap-1.5">
                      <span>{f.icon}</span> {f.label}
                    </label>
                    <input
                      type="text"
                      className="form-input font-mono text-xs"
                      value={conn[f.key]}
                      placeholder={f.placeholder}
                      onChange={e => setConn(c => ({ ...c, [f.key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>

              {/* Connection Test */}
              <div className="border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-slate-700">Test Koneksi</h4>
                  <button
                    onClick={runCheck}
                    disabled={checking}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium disabled:opacity-50 transition-colors"
                  >
                    {checking
                      ? <Loader2 size={12} className="animate-spin" />
                      : <RefreshCw size={12} />}
                    {checking ? 'Memeriksa...' : 'Cek Ulang'}
                  </button>
                </div>

                {checkErr && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100 text-xs text-red-700 mb-3">
                    <WifiOff size={14} className="shrink-0" />
                    <span>Tidak dapat menghubungi backend: <strong>{checkErr}</strong></span>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {['WSO2 APIM','WSO2 IS','Kafka','ClickHouse','Grafana','Prometheus','Loki','SPLP Backend'].map(name => {
                    const svc = health?.[name]
                    const isOk = svc?.ok ?? false
                    return (
                      <div
                        key={name}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs transition-all ${
                          checking        ? 'border-slate-100 bg-slate-50 opacity-60' :
                          !health         ? 'border-slate-100 bg-slate-50' :
                          isOk            ? 'border-emerald-100 bg-emerald-50' :
                                            'border-red-100 bg-red-50'
                        }`}
                      >
                        {checking ? (
                          <Loader2 size={12} className="animate-spin text-slate-400 shrink-0" />
                        ) : (
                          <span className={`w-2 h-2 rounded-full shrink-0 ${!health ? 'bg-slate-300' : isOk ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        )}
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-800 truncate">{name}</div>
                          <div className={
                            !health         ? 'text-slate-400' :
                            isOk            ? 'text-emerald-600' :
                                              'text-red-600'
                          }>
                            {checking            ? '...'
                             : !health           ? '—'
                             : isOk              ? `${svc!.latency}ms`
                             : svc?.error        ? svc.error.slice(0, 20)
                             : 'Tidak terhubung'}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {section === 'Keamanan' && (
            <div className="card space-y-5">
              <div>
                <h3 className="section-title text-base">Konfigurasi Keamanan</h3>
                <p className="section-subtitle text-xs">OAuth2 credentials dan pengaturan TLS</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Client ID (OAuth2)</label>
                  <input type="text" className="form-input font-mono text-xs" value={security.clientId}
                    onChange={e => setSecurity(s => ({ ...s, clientId: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Client Secret</label>
                  <input type="password" className="form-input font-mono text-xs" value={security.clientSecret}
                    onChange={e => setSecurity(s => ({ ...s, clientSecret: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Token Expiry (detik)</label>
                  <input type="number" className="form-input font-mono text-xs" value={security.tokenExpiry}
                    onChange={e => setSecurity(s => ({ ...s, tokenExpiry: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-3 border-t border-slate-100 pt-4">
                {([
                  { key: 'tlsVerify',       label: 'Verifikasi TLS Certificate',   desc: 'Aktifkan validasi sertifikat SSL/TLS' },
                  { key: 'auditLog',         label: 'Audit Logging',                desc: 'Catat semua akses API ke ClickHouse' },
                  { key: 'rateLimitEnabled', label: 'Rate Limiting',                desc: 'Batasi request via WSO2 throttling policy' },
                ] as const).map(t => (
                  <div key={t.key} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div>
                      <div className="text-sm font-semibold text-slate-800">{t.label}</div>
                      <div className="text-xs text-slate-500">{t.desc}</div>
                    </div>
                    <button
                      onClick={() => setSecurity(s => ({ ...s, [t.key]: !s[t.key] }))}
                      className={`relative w-10 h-5 rounded-full transition-colors ${security[t.key] ? 'bg-splp-600' : 'bg-slate-300'}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${security[t.key] ? 'left-5' : 'left-0.5'}`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {section === 'Notifikasi' && (
            <div className="card space-y-5">
              <h3 className="section-title text-base">Konfigurasi Notifikasi</h3>
              <div className="space-y-3">
                {[
                  { label: 'Alert SLA Turun', desc: 'Notifikasi saat SLA API turun di bawah threshold', enabled: true },
                  { label: 'Latency Tinggi', desc: 'Alert saat P99 latency > 500ms selama 5 menit', enabled: true },
                  { label: 'Kafka Lag', desc: 'Peringatan consumer lag Kafka > 10.000 message', enabled: false },
                  { label: 'Pod Crash', desc: 'Notifikasi restart pod pada namespace splp', enabled: true },
                  { label: 'Disk Usage', desc: 'Alert saat penggunaan disk ClickHouse > 80%', enabled: false },
                ].map((n, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div>
                      <div className="text-sm font-semibold text-slate-800">{n.label}</div>
                      <div className="text-xs text-slate-500">{n.desc}</div>
                    </div>
                    <div className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${n.enabled ? 'bg-splp-600' : 'bg-slate-300'}`}>
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${n.enabled ? 'left-5' : 'left-0.5'}`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {section === 'Tentang' && (
            <div className="card space-y-5">
              <h3 className="section-title text-base">Tentang SPLP Portal</h3>
              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-r from-splp-50 to-indigo-50 rounded-2xl border border-splp-100">
                  <div className="text-2xl font-black text-splp-800">SPLP Portal</div>
                  <div className="text-sm text-splp-600 mt-0.5">Sistem Penghubung Layanan Pemerintah</div>
                  <div className="text-xs text-slate-500 mt-2">v1.0.0 · Build 2026.06.01 · POC Demo</div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {[
                    { label: 'Framework',  value: 'React 18 + Vite 5' },
                    { label: 'UI Library', value: 'TailwindCSS 3 + Recharts' },
                    { label: 'API Gateway', value: 'WSO2 API Manager 4.7.0' },
                    { label: 'Identity',   value: 'WSO2 Identity Server 7.3.0' },
                    { label: 'Messaging',  value: 'Apache Kafka 4.1 (Strimzi)' },
                    { label: 'Analytics',  value: 'ClickHouse 24.3' },
                    { label: 'Monitoring', value: 'Grafana 10.x + Prometheus' },
                    { label: 'Infra',      value: 'k3d (Kubernetes 1.31)' },
                  ].map(s => (
                    <div key={s.label} className="flex justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="text-slate-500 font-medium">{s.label}</span>
                      <span className="font-semibold text-slate-800">{s.value}</span>
                    </div>
                  ))}
                </div>
                <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-800">
                  <strong>⚠ Demo / POC Mode</strong> — Sistem ini adalah Proof of Concept untuk keperluan live demo tender SPLP 2026. 
                  Kementerian Komunikasi dan Digital Republik Indonesia.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
