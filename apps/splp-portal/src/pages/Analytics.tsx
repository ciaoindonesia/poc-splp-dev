import { useState, useEffect } from 'react'
import { BarChart3, TrendingUp, Database, Loader2, RefreshCw } from 'lucide-react'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, AreaChart, Area, Line
} from 'recharts'
import { formatNumber, deriveBackendUrl } from '../lib/utils'
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

interface Summary {
  total_requests: number; success_count: number; error_count: number
  avg_latency_ms: number; p99_latency_ms: number; success_rate: number
}
interface AnalyticsData {
  summary: Summary
  byAgency: { agency: string; calls: number }[]
  topApis:  { api_name: string; calls: number; success: number; error: number; avg_ms: number }[]
  latencyDist: { range: string; count: number }[]
}

export default function Analytics() {
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d')
  const [daily,  setDaily]  = useState<{ date: string; total: number; success: number; error: number }[]>([])
  const [data,   setData]   = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,  setError]  = useState<string | null>(null)

  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90

  const fetchData = async () => {
    setLoading(true); setError(null)
    try {
      const BACKEND = deriveBackendUrl()
      const [sumRes, dailyRes] = await Promise.all([
        fetch(`${BACKEND}/api/analytics/summary`),
        fetch(`${BACKEND}/api/analytics/daily?days=${days}`),
      ])
      if (!sumRes.ok || !dailyRes.ok) throw new Error('Gagal mengambil data dari backend')
      const [sum, dl] = await Promise.all([sumRes.json(), dailyRes.json()])
      if (sum.error) throw new Error(sum.error)
      setData(sum)
      setDaily(Array.isArray(dl) ? dl : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [period])

  const dailySliced = period === '7d' ? daily.slice(-7) : daily

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="section-title">Analytics & Laporan</h2>
          <p className="section-subtitle">Analitik berbasis ClickHouse — data diperbarui real-time</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchData} className="btn-secondary text-xs" disabled={loading}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <div className="flex bg-slate-100 rounded-xl p-1">
            {(['7d', '30d', '90d'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${period === p ? 'bg-white shadow-sm text-splp-700' : 'text-slate-500'}`}
              >
                {p === '7d' ? '7 Hari' : p === '30d' ? '30 Hari' : '90 Hari'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-white border border-slate-200 rounded-xl px-3 py-2">
            <Database size={12} className="text-orange-500" />
            <span className="font-semibold text-slate-700">ClickHouse 24.3</span>
          </div>
        </div>
      </div>

      {/* Loading / Error */}
      {loading && <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={14} className="animate-spin" /> Memuat data dari ClickHouse...</div>}
      {error && <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-700">⚠️ {error}</div>}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Permintaan', value: data ? formatNumber(Number(data.summary.total_requests)) : '…', sub: `${period} terakhir`, icon: <BarChart3 size={18} className="text-splp-600" />, color: 'bg-splp-50' },
          { label: 'Berhasil', value: data ? formatNumber(Number(data.summary.success_count)) : '…', sub: `Success rate ${data ? data.summary.success_rate : '…'}%`, icon: <span className="text-lg">✅</span>, color: 'bg-emerald-50' },
          { label: 'Avg Latency', value: data ? `${data.summary.avg_latency_ms}ms` : '…', sub: `P99: ${data ? data.summary.p99_latency_ms : '…'}ms`, icon: <TrendingUp size={18} className="text-amber-600" />, color: 'bg-amber-50' },
          { label: 'Error', value: data ? formatNumber(Number(data.summary.error_count)) : '…', sub: `${data ? (100 - Number(data.summary.success_rate)).toFixed(2) : '…'}% error rate`, icon: <span className="text-lg">⚠️</span>, color: 'bg-red-50' },
        ].map(s => (
          <div key={s.label} className="stat-card card-hover">
            <div className={`stat-icon ${s.color}`}>{s.icon}</div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{s.label}</p>
              <p className="text-2xl font-bold text-slate-900 mt-0.5">{s.value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{s.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Daily Trend */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="section-title text-base">Tren Pertukaran Data Harian</h3>
            <p className="section-subtitle text-xs">Query ClickHouse: SELECT date, count(*) FROM splp.api_access_logs GROUP BY date</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={dailySliced} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} interval={period === '7d' ? 0 : 4} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={v => formatNumber(v)} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}
              formatter={(v: number, n: string) => [formatNumber(v), n === 'total' ? 'Total' : n === 'success' ? 'Berhasil' : 'Gagal']}
            />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }}
              formatter={(v) => v === 'total' ? 'Total' : v === 'success' ? 'Berhasil' : 'Gagal'}
            />
            <Area type="monotone" dataKey="total" stroke="#6366f1" fill="url(#totalGrad)" strokeWidth={2} />
            <Line type="monotone" dataKey="success" stroke="#10b981" strokeWidth={2} dot={false} />
            <Bar dataKey="error" fill="#ef4444" barSize={3} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* API Usage + Agency Traffic */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top APIs */}
        <div className="card">
          <h3 className="section-title text-base mb-4">Top API berdasarkan Penggunaan</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={(data?.topApis ?? []).map(a => ({ api: a.api_name.length > 16 ? a.api_name.slice(0,15)+'…' : a.api_name, success: Number(a.success), error: Number(a.error) }))} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => formatNumber(v)} />
              <YAxis type="category" dataKey="api" tick={{ fontSize: 10, fill: '#475569' }} width={110} />
              <Tooltip formatter={(v: number, n: string) => [formatNumber(v), n === 'success' ? 'Berhasil' : 'Gagal']} contentStyle={{ fontSize: 12 }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="success" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} name="success" />
              <Bar dataKey="error" stackId="a" fill="#ef4444" radius={[0, 4, 4, 0]} name="error" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Agency Traffic */}
        <div className="card">
          <h3 className="section-title text-base mb-4">Traffic per Instansi</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={(data?.byAgency ?? []).map(a => ({ name: a.agency, value: Number(a.calls) }))}
                cx="50%"
                cy="50%"
                outerRadius={90}
                innerRadius={50}
                dataKey="value"
                nameKey="name"
                paddingAngle={2}
              >
                {(data?.byAgency ?? []).map((_: unknown, i: number) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number, n: string) => [formatNumber(v), n]} contentStyle={{ fontSize: 12 }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Latency Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="section-title text-base mb-4">Distribusi Latensi</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data?.latencyDist ?? []} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="range" tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => formatNumber(v)} />
              <Tooltip formatter={(v: number) => [formatNumber(v), 'Requests']} contentStyle={{ fontSize: 12 }} />
              <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* ClickHouse Query Panel */}
        <div className="card">
          <h3 className="section-title text-base mb-4">Query ClickHouse</h3>
          <div className="space-y-3">
            {[
              {
                label: 'Total requests hari ini',
                query: `SELECT count(*) as total\nFROM splp.api_access_logs\nWHERE timestamp >= today()`,
                result: '47,832'
              },
              {
                label: 'Top 3 API by latency',
                query: `SELECT api_name, avg(response_time_ms) AS avg_ms\nFROM splp.api_access_logs\nGROUP BY api_name\nORDER BY avg_ms DESC LIMIT 3`,
                result: 'Rekam Medis: 430ms, Bansos: 320ms, Perizinan: 280ms'
              },
              {
                label: 'Error rate per agency',
                query: `SELECT agency_source,\n  countIf(status_code >= 400) / count(*) * 100 AS err_pct\nFROM splp.api_access_logs\nGROUP BY agency_source\nORDER BY err_pct DESC`,
                result: 'PPATK: 3.2%, Kemensos: 2.1%, DJP: 1.8%'
              },
            ].map((q, i) => (
              <div key={i} className="rounded-xl border border-slate-100 overflow-hidden">
                <div className="px-3 py-2 bg-slate-50 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600">{q.label}</span>
                  <span className="badge-blue text-[10px]">ClickHouse</span>
                </div>
                <pre className="text-[10px] font-mono text-slate-600 p-3 bg-white overflow-x-auto">{q.query}</pre>
                <div className="px-3 py-2 bg-emerald-50 border-t border-emerald-100">
                  <span className="text-[10px] text-emerald-700 font-semibold">→ {q.result}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
