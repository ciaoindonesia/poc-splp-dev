import { useState, useEffect, useRef } from 'react'
import {
  ArrowUpRight, ArrowDownRight, Activity, Share2,
  CheckCircle2, AlertTriangle, Clock, Database, Zap, Server,
  TrendingUp, RefreshCw
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { formatNumber, formatBytes, formatTimestamp, deriveBackendUrl } from '../lib/utils'
import {
  generateExchangeEvent, generateHourlyData,
  INITIAL_EVENTS, type ExchangeEvent
} from '../lib/mockData'

const BACKEND = deriveBackendUrl()

type SvcHealth = { ok: boolean; latency?: number; error?: string }
type HealthMap = Record<string, SvcHealth>

const COMPONENTS: { name: string; key: string; detail: string; icon: string }[] = [
  { name: 'WSO2 API Manager 4.7', key: 'WSO2 APIM',    detail: 'Port 9443 · OAuth2/Publisher', icon: '🔌' },
  { name: 'WSO2 Identity Server', key: 'WSO2 IS',      detail: 'Port 9444 · OAuth2/OIDC',      icon: '🔐' },
  { name: 'Apache Kafka (KRaft)', key: 'Kafka',        detail: '8 topics · 1 broker',          icon: '📨' },
  { name: 'ClickHouse 24.3',      key: 'ClickHouse',   detail: 'splp DB · HTTP :8123',         icon: '🗄️' },
  { name: 'Grafana',              key: 'Grafana',      detail: 'Port 3000 · dashboards',       icon: '📊' },
  { name: 'Prometheus',           key: 'Prometheus',   detail: 'metrics · node + k8s',         icon: '📈' },
  { name: 'Loki',                 key: 'Loki',         detail: 'log aggregation · 7d',         icon: '📋' },
  { name: 'SPLP Backend',         key: 'SPLP Backend', detail: 'Node.js · Express API',        icon: '⚙️' },
]

const HOURLY = generateHourlyData()

function StatCard({ icon, label, value, sub, trend, color }: {
  icon: React.ReactNode; label: string; value: string | number
  sub?: string; trend?: { val: number; up: boolean }; color: string
}) {
  return (
    <div className="stat-card card-hover">
      <div className={`stat-icon ${color}`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide truncate">{label}</p>
        <p className="text-2xl font-bold text-slate-900 mt-0.5 leading-none">{typeof value === 'number' ? formatNumber(value) : value}</p>
        {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
        {trend && (
          <div className={`flex items-center gap-1 mt-1 text-xs font-semibold ${trend.up ? 'text-emerald-600' : 'text-red-500'}`}>
            {trend.up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            <span>{Math.abs(trend.val)}% dari kemarin</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [events, setEvents] = useState<ExchangeEvent[]>(INITIAL_EVENTS)
  const [totalToday, setTotalToday] = useState(47832)
  const [successRate, setSuccessRate] = useState(99.2)
  const feedRef = useRef<HTMLDivElement>(null)
  const [health, setHealth] = useState<HealthMap>({})

  useEffect(() => {
    const interval = setInterval(() => {
      const ev = generateExchangeEvent()
      setEvents(prev => [ev, ...prev].slice(0, 50))
      setTotalToday(n => n + Math.floor(Math.random() * 3) + 1)
      setSuccessRate(r => Math.min(99.9, Math.max(97.0, r + (Math.random() - 0.5) * 0.1)))
    }, 1500)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const fetchHealth = () =>
      fetch(`${BACKEND}/api/health/services`)
        .then(r => r.json())
        .then(d => setHealth(d.services ?? {}))
        .catch(() => {})
    fetchHealth()
    const t = setInterval(fetchHealth, 30_000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-splp-900 via-splp-800 to-indigo-900 rounded-2xl p-6 text-white overflow-hidden relative">
        <div className="absolute inset-0 opacity-10">
          {[...Array(20)].map((_, i) => (
            <div key={i} className="absolute rounded-full bg-white"
              style={{ width: `${20 + i * 5}px`, height: `${20 + i * 5}px`, top: `${Math.random() * 100}%`, left: `${Math.random() * 100}%`, opacity: 0.3 }} />
          ))}
        </div>
        <div className="relative z-10 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="badge bg-white/20 text-white text-[10px] border border-white/30">🇮🇩 Kementerian Komunikasi dan Digital</span>
            </div>
            <h2 className="text-2xl font-bold leading-tight">Sistem Penghubung Layanan Pemerintah</h2>
            <p className="text-splp-200 mt-1 text-sm">Platform integrasi data antar instansi pemerintah berbasis API Gateway & Event Streaming</p>
            <div className="flex flex-wrap gap-3 mt-4">
              {[
                { icon: '🔌', label: 'WSO2 API Manager', desc: 'Sinkron' },
                { icon: '📨', label: 'Apache Kafka', desc: 'Asinkron' },
                { icon: '🔐', label: 'WSO2 Identity Server', desc: 'SSO/OAuth2' },
                { icon: '📊', label: 'Grafana + ClickHouse', desc: 'Monitoring' },
              ].map(tech => (
                <div key={tech.label} className="flex items-center gap-1.5 bg-white/10 border border-white/20 rounded-lg px-2.5 py-1.5">
                  <span>{tech.icon}</span>
                  <div>
                    <div className="text-xs font-semibold">{tech.label}</div>
                    <div className="text-[10px] text-splp-300">{tech.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="hidden lg:flex flex-col items-end gap-2">
            <div className="bg-white/10 border border-white/20 rounded-xl p-3 text-center min-w-[120px]">
              <p className="text-3xl font-black text-white">{formatNumber(totalToday)}</p>
              <p className="text-[11px] text-splp-200 font-medium">Pertukaran Hari Ini</p>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-300 text-sm font-semibold">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
              Sistem Aktif
            </div>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Share2 size={20} className="text-splp-600" />}
          label="Total Pertukaran" value={totalToday}
          sub="Hari ini (semua API)"
          trend={{ val: 12.3, up: true }}
          color="bg-splp-50"
        />
        <StatCard
          icon={<CheckCircle2 size={20} className="text-emerald-600" />}
          label="Success Rate" value={`${successRate.toFixed(1)}%`}
          sub="SLA target: ≥99%"
          trend={{ val: 0.3, up: true }}
          color="bg-emerald-50"
        />
        <StatCard
          icon={<Clock size={20} className="text-amber-600" />}
          label="Avg. Latency" value="142ms"
          sub="P99: 380ms"
          trend={{ val: 5.1, up: false }}
          color="bg-amber-50"
        />
        <StatCard
          icon={<Activity size={20} className="text-indigo-600" />}
          label="API Aktif" value={12}
          sub="10 instansi terhubung"
          trend={{ val: 2, up: true }}
          color="bg-indigo-50"
        />
      </div>

      {/* Chart + Live Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Exchange Volume Chart */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="section-title text-base">Volume Pertukaran Data (24 Jam)</h3>
              <p className="section-subtitle text-xs">Sync (REST via WSO2) & Async (Kafka)</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <RefreshCw size={12} /> Update setiap 1.5s
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={HOURLY} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="syncGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="asyncGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} interval={3} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                formatter={(v: number, name: string) => [formatNumber(v), name === 'sync' ? 'Sync (WSO2)' : name === 'async' ? 'Async (Kafka)' : 'Error']}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }}
                formatter={(v) => v === 'sync' ? 'Sync (WSO2)' : v === 'async' ? 'Async (Kafka)' : 'Error'}
              />
              <Area type="monotone" dataKey="sync" stroke="#6366f1" strokeWidth={2} fill="url(#syncGrad)" />
              <Area type="monotone" dataKey="async" stroke="#10b981" strokeWidth={2} fill="url(#asyncGrad)" />
              <Bar dataKey="error" fill="#ef4444" barSize={3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* System Health */}
        <div className="card">
          <h3 className="section-title text-base mb-4">Status Komponen</h3>
          <div className="space-y-2.5">
            {COMPONENTS.map(s => {
              const svc = health[s.key]
              const up  = svc?.ok ?? false
              const lat = svc?.latency
              const loading = Object.keys(health).length === 0
              return (
                <div key={s.name} className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                  <span className="text-lg">{s.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-800 truncate">{s.name}</span>
                      {loading
                        ? <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-pulse" />
                        : <span className={`w-1.5 h-1.5 rounded-full ${up ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                      }
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {svc?.error ? `⚠ ${svc.error.split(' ').slice(0,3).join(' ')}` : s.detail}
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold shrink-0 ${
                    loading ? 'text-slate-400' : up ? 'text-emerald-600' : 'text-red-500'
                  }`}>
                    {loading ? '...' : up ? `${lat}ms` : 'Offline'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Agency Grid + Live Events */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Connected Agencies */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title text-base">Instansi Terhubung</h3>
            <span className="badge-blue">10 Aktif</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { name: 'Dukcapil', calls: 45230, color: '#3b82f6', icon: '🏛️' },
              { name: 'BPJS Kesehatan', calls: 38900, color: '#10b981', icon: '🏥' },
              { name: 'DJP', calls: 29800, color: '#f59e0b', icon: '💰' },
              { name: 'BPJS TK', calls: 18200, color: '#6366f1', icon: '👷' },
              { name: 'POLRI', calls: 15600, color: '#14b8a6', icon: '🚔' },
              { name: 'Kemensos', calls: 7800, color: '#f97316', icon: '🤝' },
              { name: 'Kemenkes', calls: 3200, color: '#ec4899', icon: '⚕️' },
              { name: 'Kemenkumham', calls: 9100, color: '#6b7280', icon: '⚖️' },
            ].map(a => (
              <div key={a.name} className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-100 hover:border-splp-200 hover:bg-splp-50/30 transition-all cursor-pointer">
                <span className="text-xl">{a.icon}</span>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-800 truncate">{a.name}</div>
                  <div className="text-[10px] text-slate-400">{formatNumber(a.calls)} panggilan</div>
                  <div className="w-full bg-slate-100 rounded-full h-1 mt-1">
                    <div className="h-1 rounded-full transition-all" style={{ width: `${Math.min(100, (a.calls / 45230) * 100)}%`, backgroundColor: a.color }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Event Feed */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title text-base">Feed Real-Time</h3>
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
              Live
            </div>
          </div>
          <div ref={feedRef} className="space-y-1.5 max-h-64 overflow-y-auto scrollbar-hide">
            {events.slice(0, 15).map(ev => (
              <div key={ev.id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors text-xs">
                <div className={`shrink-0 w-1.5 h-1.5 rounded-full ${ev.status === 'success' ? 'bg-emerald-500' : ev.status === 'error' ? 'bg-red-500' : 'bg-amber-500'}`} />
                <span className={`shrink-0 badge text-[10px] ${ev.type === 'sync' ? 'badge-blue' : 'badge-purple'}`}>
                  {ev.type === 'sync' ? 'REST' : 'Kafka'}
                </span>
                <span className="text-slate-500 shrink-0 font-mono">{formatTimestamp(ev.timestamp)}</span>
                <span className="text-slate-700 font-medium truncate">{ev.source} → {ev.target}</span>
                <span className="shrink-0 text-slate-400 font-mono">{ev.latency}ms</span>
                <span className={`shrink-0 font-semibold ${ev.status === 'success' ? 'text-emerald-600' : ev.status === 'error' ? 'text-red-600' : 'text-amber-600'}`}>
                  {ev.status === 'success' ? '✓' : ev.status === 'error' ? '✗' : '⋯'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Transactions Table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="section-title text-base">Transaksi Terbaru</h3>
          <span className="text-xs text-slate-400">Update otomatis</span>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID Transaksi</th>
                <th>Waktu</th>
                <th>Mode</th>
                <th>Sumber</th>
                <th>Target</th>
                <th>API</th>
                <th>Latensi</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {events.slice(0, 8).map(ev => (
                <tr key={ev.id}>
                  <td><span className="font-mono text-xs text-slate-500">{ev.transactionId.slice(0, 12)}</span></td>
                  <td className="font-mono text-xs">{formatTimestamp(ev.timestamp)}</td>
                  <td>
                    <span className={`badge text-[10px] ${ev.type === 'sync' ? 'badge-blue' : 'badge-purple'}`}>
                      {ev.type === 'sync' ? '⚡ REST' : '📨 Kafka'}
                    </span>
                  </td>
                  <td className="font-medium">{ev.source}</td>
                  <td className="font-medium">{ev.target}</td>
                  <td className="text-slate-500 text-xs">{ev.api}</td>
                  <td>
                    <span className={`font-mono font-semibold ${ev.latency > 300 ? 'text-amber-600' : 'text-slate-700'}`}>
                      {ev.latency}ms
                    </span>
                  </td>
                  <td>
                    <span className={`badge text-[10px] ${ev.status === 'success' ? 'badge-green' : ev.status === 'error' ? 'badge-red' : 'badge-yellow'}`}>
                      {ev.status === 'success' ? '✓ Berhasil' : ev.status === 'error' ? '✗ Gagal' : '⋯ Pending'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
