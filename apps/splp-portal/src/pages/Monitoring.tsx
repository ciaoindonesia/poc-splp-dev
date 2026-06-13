import { useState } from 'react'
import { ExternalLink, RefreshCw, Activity, AlertTriangle, CheckCircle } from 'lucide-react'

function getGrafanaUrl(): string {
  if (import.meta.env.VITE_GRAFANA_URL) return import.meta.env.VITE_GRAFANA_URL
  if (typeof window === 'undefined') return 'http://localhost:3000'
  const h = window.location.hostname
  if (h === 'localhost' || h === '127.0.0.1') return `http://localhost:3000`
  const parts = h.split('.')
  const base = parts.length > 2 ? parts.slice(1).join('.') : h
  const proto = window.location.protocol.replace(':', '')
  return `${proto}://grafana.${base}`
}

const GRAFANA_URL = getGrafanaUrl()

const LOKI_EXPLORE = `${GRAFANA_URL}/explore?orgId=1&left=${encodeURIComponent(JSON.stringify({
  datasource: 'loki-splp',
  queries: [{ refId: 'A', expr: '{namespace=~"splp|wso2|messaging"}', queryType: 'range' }],
  range: { from: 'now-1h', to: 'now' },
}))}`

const DASHBOARD_PANELS = [
  { title: 'Traffic Overview',            uid: 'splp-traffic',   src: `${GRAFANA_URL}/d/splp-traffic/splp-traffic-overview?orgId=1&refresh=5s&theme=light&kiosk` },
  { title: 'Kafka Metrics',               uid: 'kafka-metrics',  src: `${GRAFANA_URL}/d/kafka-metrics/kafka-metrics?orgId=1&refresh=5s&theme=light&kiosk` },
  { title: 'API Latency Heatmap',         uid: 'api-latency',    src: `${GRAFANA_URL}/d/api-latency/api-latency?orgId=1&refresh=5s&theme=light&kiosk` },
  { title: 'Infrastructure (Prometheus)', uid: 'rYdddlPWk',      src: `${GRAFANA_URL}/d/rYdddlPWk/node-exporter-full?orgId=1&refresh=10s&theme=light&kiosk` },
  { title: 'Application Logs (Loki)',     uid: 'loki-explore',   src: LOKI_EXPLORE },
]

const ALERTS = [
  { id: 1, severity: 'warning', msg: 'API Verifikasi NIK: Latency P99 > 400ms', time: '2 mnt lalu', resolved: false },
  { id: 2, severity: 'info',    msg: 'Kafka broker restart berhasil diselesaikan', time: '8 mnt lalu', resolved: true },
  { id: 3, severity: 'warning', msg: 'BPJS Kesehatan API: Success rate turun ke 98.1%', time: '15 mnt lalu', resolved: false },
  { id: 4, severity: 'info',    msg: 'ClickHouse: Merging data partitions (normal)', time: '22 mnt lalu', resolved: true },
  { id: 5, severity: 'error',   msg: 'DJP API: Timeout pada 3 requests berturut-turut', time: '31 mnt lalu', resolved: true },
]

export default function Monitoring() {
  const [activeView, setActiveView] = useState<'overview' | 'kafka' | 'latency' | 'infra' | 'logs'>('overview')
  const [iframeKey, setIframeKey] = useState(0)
  const [iframeLoaded, setIframeLoaded] = useState(false)

  const currentPanel = DASHBOARD_PANELS.find(p => ({
    overview: 'splp-traffic',
    kafka:    'kafka-metrics',
    latency:  'api-latency',
    infra:    'rYdddlPWk',
    logs:     'loki-explore',
  }[activeView] === p.uid)) ?? DASHBOARD_PANELS[0]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="section-title">Monitoring Dashboard</h2>
          <p className="section-subtitle">Dashboard monitoring via Grafana — embedded langsung di portal</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setIframeKey(k => k + 1); setIframeLoaded(false) }}
            className="btn-secondary text-xs"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
          <a
            href={GRAFANA_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary text-xs"
          >
            <ExternalLink size={14} />
            Buka Grafana
          </a>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'CPU Usage',    value: '34%', icon: '🖥️', color: 'text-blue-600',   bar: 34 },
          { label: 'Memory',       value: '12.4GB / 30GB', icon: '💾', color: 'text-purple-600', bar: 41 },
          { label: 'Kafka Lag',    value: '< 100ms',   icon: '📨', color: 'text-amber-600',  bar: 10 },
          { label: 'Pod Health',   value: '8/8 Running', icon: '☸️', color: 'text-emerald-600', bar: 100 },
        ].map(s => (
          <div key={s.label} className="card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500">{s.label}</span>
              <span className="text-lg">{s.icon}</span>
            </div>
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
              <div className={`h-1.5 rounded-full transition-all duration-1000 ${s.bar > 80 ? 'bg-red-500' : s.bar > 60 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                style={{ width: `${s.bar}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* Dashboard Tabs + Grafana Embed */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Side nav */}
        <div className="space-y-3">
          <div className="card p-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 px-1">Dashboard Panels</p>
            <div className="space-y-1">
              {([
                { key: 'overview', label: 'Traffic Overview',  icon: '📊', badge: '' },
                { key: 'kafka',    label: 'Kafka Metrics',     icon: '📨', badge: '' },
                { key: 'latency',  label: 'API Latency',       icon: '⚡', badge: '' },
                { key: 'infra',    label: 'Infrastructure',    icon: '📈', badge: 'Prometheus' },
                { key: 'logs',     label: 'Application Logs',  icon: '�', badge: 'Loki' },
              ] as { key: 'overview'|'kafka'|'latency'|'infra'|'logs'; label: string; icon: string; badge: string }[]).map(v => (
                <button
                  key={v.key}
                  onClick={() => setActiveView(v.key)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold text-left transition-all ${activeView === v.key ? 'bg-splp-50 text-splp-700 border border-splp-100' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <span>{v.icon}</span>
                  <span className="flex-1">{v.label}</span>
                  {v.badge && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 font-semibold">{v.badge}</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Active Alerts */}
          <div className="card p-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 px-1">Alert Aktif</p>
            <div className="space-y-1.5">
              {ALERTS.map(a => (
                <div key={a.id} className={`flex items-start gap-2 p-2 rounded-lg ${a.resolved ? 'opacity-50' : ''}`}>
                  {a.severity === 'error' ? <AlertTriangle size={12} className="text-red-500 mt-0.5 shrink-0" />
                    : a.severity === 'warning' ? <AlertTriangle size={12} className="text-amber-500 mt-0.5 shrink-0" />
                    : <CheckCircle size={12} className="text-emerald-500 mt-0.5 shrink-0" />}
                  <div>
                    <p className="text-[10px] text-slate-700 leading-relaxed">{a.msg}</p>
                    <p className="text-[9px] text-slate-400">{a.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Grafana iframe */}
        <div className="lg:col-span-3">
          <div className="card p-0 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Activity size={16} className="text-splp-600" />
                <span className="font-semibold text-sm text-slate-800">{currentPanel.title}</span>
                <span className="badge-blue text-[10px]">Grafana</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                <span className="text-xs text-emerald-600 font-semibold">Live</span>
              </div>
            </div>
            <div className="relative bg-slate-900" style={{ height: '520px' }}>
              <iframe
                key={iframeKey}
                src={currentPanel.src}
                className="w-full h-full border-0"
                title={currentPanel.title}
                onLoad={() => setIframeLoaded(true)}
                onError={() => setIframeLoaded(false)}
              />
              {/* Fallback overlay — hanya tampil saat iframe belum load */}
              <div className={`absolute inset-0 flex flex-col items-center justify-center bg-slate-900 transition-opacity duration-500 pointer-events-none ${iframeLoaded ? 'opacity-0' : 'opacity-100'}`}>
                <div className="text-center">
                  <div className="text-6xl mb-4">📊</div>
                  <p className="text-white font-bold text-lg">Grafana Dashboard</p>
                  <p className="text-slate-400 text-sm mt-1">{currentPanel.title}</p>
                  <p className="text-slate-500 text-xs mt-2">Menghubungkan ke {GRAFANA_URL}...</p>
                  <div className="mt-4 flex justify-center">
                    <div className="flex gap-1">
                      {[0, 1, 2].map(i => (
                        <div key={i} className="w-2 h-2 bg-splp-500 rounded-full animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                  </div>
                  <p className="text-slate-600 text-xs mt-4 max-w-sm">
                    Dashboard akan aktif setelah k3d cluster dan Grafana pod berjalan.
                    Gunakan script <code className="text-splp-400">./scripts/setup-all.sh</code> untuk deploy.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Service Status Grid */}
      <div className="card">
        <h3 className="section-title text-base mb-4">Status Semua Komponen</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { name: 'WSO2 API Manager 4.7', ns: 'wso2', pods: '1/1', cpu: '45%', mem: '2.1GB', status: 'Running' },
            { name: 'WSO2 Identity Server', ns: 'wso2', pods: '1/1', cpu: '28%', mem: '1.4GB', status: 'Running' },
            { name: 'Kafka (KRaft)', ns: 'messaging', pods: '1/1', cpu: '12%', mem: '512MB', status: 'Running' },
            { name: 'ClickHouse 24.3', ns: 'splp', pods: '1/1', cpu: '8%', mem: '980MB', status: 'Running' },
            { name: 'Grafana', ns: 'monitoring', pods: '1/1', cpu: '4%', mem: '256MB', status: 'Running' },
            { name: 'Prometheus', ns: 'monitoring', pods: '1/1', cpu: '3%', mem: '299MB', status: 'Running' },
            { name: 'Loki', ns: 'monitoring', pods: '1/1', cpu: '2%', mem: '57MB', status: 'Running' },
            { name: 'Promtail', ns: 'monitoring', pods: '3/3', cpu: '2%', mem: '30MB', status: 'Running' },
            { name: 'SPLP Portal', ns: 'splp', pods: '1/1', cpu: '5%', mem: '128MB', status: 'Running' },
            { name: 'SPLP Backend', ns: 'splp', pods: '1/1', cpu: '6%', mem: '192MB', status: 'Running' },
            { name: 'Nginx Ingress', ns: 'kube-system', pods: '1/1', cpu: '2%', mem: '128MB', status: 'Running' },
            { name: 'cert-manager', ns: 'cert-manager', pods: '1/1', cpu: '1%', mem: '64MB', status: 'Running' },
          ].map(s => (
            <div key={s.name} className="p-3 rounded-xl border border-slate-100 hover:border-splp-200 transition-colors">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-800 truncate">{s.name}</div>
                  <div className="text-[10px] text-slate-400 font-mono">{s.ns}</div>
                </div>
                <span className="badge-green text-[10px] shrink-0 ml-1">{s.status}</span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1 text-[10px]">
                <div><span className="text-slate-400">Pods:</span> <span className="font-mono font-semibold text-slate-700">{s.pods}</span></div>
                <div><span className="text-slate-400">CPU:</span> <span className="font-mono font-semibold text-slate-700">{s.cpu}</span></div>
                <div><span className="text-slate-400">Mem:</span> <span className="font-mono font-semibold text-slate-700">{s.mem}</span></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
