import { useState } from 'react'
import { Search, ExternalLink, Activity } from 'lucide-react'
import { AGENCIES, MOCK_APIS, formatNumber } from '../lib/utils'

const AGENCY_STATS = AGENCIES.map(a => ({
  ...a,
  apiCount: MOCK_APIS.filter(api => api.agency.toLowerCase().includes(a.name.toLowerCase().split(' ')[0]) || a.name.toLowerCase().includes(api.agency.toLowerCase().split(' ')[0])).length,
  totalCalls: Math.floor(Math.random() * 45000) + 3000,
  sla: (97 + Math.random() * 3).toFixed(1),
  latency: Math.floor(Math.random() * 300) + 80,
  status: Math.random() > 0.1 ? 'connected' : 'degraded',
}))

export default function Agencies() {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<typeof AGENCY_STATS[0] | null>(null)

  const filtered = AGENCY_STATS.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.fullName.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="section-title">Direktori Instansi</h2>
          <p className="section-subtitle">Daftar instansi pemerintah yang terhubung ke SPLP</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="badge-green text-xs">10 Terhubung</span>
          <span className="badge-yellow text-xs">0 Degraded</span>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Cari instansi..."
          className="form-input pl-9"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agency List */}
        <div className="lg:col-span-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filtered.map(a => (
              <div
                key={a.id}
                onClick={() => setSelected(a)}
                className={`card card-hover cursor-pointer ${selected?.id === a.id ? 'ring-2 ring-splp-500' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
                    style={{ backgroundColor: a.color + '20', border: `2px solid ${a.color}40` }}>
                    {a.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="font-bold text-sm text-slate-900">{a.name}</h4>
                      <span className={`w-2 h-2 rounded-full shrink-0 ${a.status === 'connected' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">{a.fullName}</p>
                    <p className="text-[10px] text-slate-400">{a.ministry}</p>
                    <div className="flex items-center gap-3 mt-2 text-[10px]">
                      <span className="text-slate-500">{formatNumber(a.totalCalls)} panggilan/hari</span>
                      <span className="text-emerald-600 font-semibold">SLA {a.sla}%</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-1">
          {selected ? (
            <div className="card sticky top-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl"
                  style={{ backgroundColor: selected.color + '20', border: `2px solid ${selected.color}40` }}>
                  {selected.icon}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{selected.name}</h3>
                  <p className="text-xs text-slate-500">{selected.ministry}</p>
                  <span className={`badge text-[10px] ${selected.status === 'connected' ? 'badge-green' : 'badge-yellow'}`}>
                    {selected.status === 'connected' ? '● Terhubung' : '⚠ Degraded'}
                  </span>
                </div>
              </div>

              <div className="text-xs text-slate-600 leading-relaxed">
                <strong>{selected.fullName}</strong>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Panggilan/Hari', value: formatNumber(selected.totalCalls), color: 'text-splp-700' },
                  { label: 'SLA',            value: `${selected.sla}%`,               color: 'text-emerald-600' },
                  { label: 'Avg Latency',    value: `${selected.latency}ms`,           color: 'text-amber-600' },
                  { label: 'API Aktif',      value: `${Math.max(1, selected.apiCount)} API`, color: 'text-slate-700' },
                ].map(s => (
                  <div key={s.label} className="bg-slate-50 rounded-xl p-2.5 text-center">
                    <div className={`font-bold text-sm ${s.color}`}>{s.value}</div>
                    <div className="text-[10px] text-slate-400">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* API dari instansi ini */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">API Tersedia</p>
                <div className="space-y-1.5">
                  {(() => {
                    const direct = MOCK_APIS.filter(api =>
                      api.agency.toLowerCase() === selected.name.toLowerCase()
                    )
                    const idx = AGENCY_STATS.findIndex(a => a.id === selected.id)
                    const fallback = MOCK_APIS.filter((_, i) => i % 3 === idx % 3).slice(0, 3)
                    return (direct.length > 0 ? direct : fallback).slice(0, 4)
                  })().map(api => (
                    <div key={api.id} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 text-xs">
                      <span>{api.icon}</span>
                      <span className="flex-1 font-medium text-slate-700 truncate">{api.name}</span>
                      <span className={`badge text-[10px] ${api.status === 'active' ? 'badge-green' : 'badge-yellow'}`}>
                        {api.status === 'active' ? 'Aktif' : 'Maintenance'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Connection Info */}
              <div className="p-3 bg-splp-50 border border-splp-100 rounded-xl text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Protokol:</span>
                  <span className="font-semibold text-slate-700">HTTPS/TLS 1.3</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Auth:</span>
                  <span className="font-semibold text-slate-700">OAuth2 + PKCE</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Gateway:</span>
                  <span className="font-semibold text-slate-700">WSO2 APIM 4.3</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="card flex flex-col items-center justify-center py-16 text-center">
              <div className="text-4xl mb-3">🏛️</div>
              <p className="text-sm font-semibold text-slate-700">Pilih Instansi</p>
              <p className="text-xs text-slate-400 mt-1">Klik untuk melihat detail koneksi</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
