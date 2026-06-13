import { Menu, Bell, RefreshCw, Wifi, LogOut } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

interface Props {
  onToggleSidebar: () => void
  currentTime: Date
  sidebarOpen: boolean
}

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/':           { title: 'Dashboard',                subtitle: 'Ringkasan sistem pertukaran data pemerintah' },
  '/exchange':   { title: 'Pertukaran Data',          subtitle: 'Kirim & terima data antar instansi (Sync & Async)' },
  '/apis':       { title: 'Katalog API',              subtitle: 'Manajemen API Gateway via WSO2 API Manager' },
  '/analytics':  { title: 'Analytics & Laporan',      subtitle: 'Analitik pertukaran data via ClickHouse' },
  '/monitoring': { title: 'Monitoring',               subtitle: 'Dashboard monitoring via Grafana' },
  '/agencies':   { title: 'Direktori Instansi',       subtitle: 'Daftar instansi pemerintah yang terhubung' },
  '/settings':   { title: 'Pengaturan Sistem',        subtitle: 'Konfigurasi integrasi dan keamanan' },
}

export default function Header({ onToggleSidebar, currentTime, sidebarOpen }: Props) {
  const [notifOpen, setNotifOpen]   = useState(false)
  const [userMenuOpen, setUserMenu] = useState(false)
  const { user, logout } = useAuth()
  const path = window.location.pathname
  const info = PAGE_TITLES[path] ?? PAGE_TITLES['/']

  return (
    <header className="bg-white border-b border-slate-100 px-6 py-3.5 flex items-center gap-4 shrink-0 shadow-sm z-30 relative">
      <button
        onClick={onToggleSidebar}
        className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
        title={sidebarOpen ? 'Tutup sidebar' : 'Buka sidebar'}
      >
        <Menu size={18} />
      </button>

      <div className="flex-1 min-w-0">
        <h1 className="text-base font-bold text-slate-900 leading-tight">{info.title}</h1>
        <p className="text-xs text-slate-400 truncate">{info.subtitle}</p>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {/* Live indicator */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-lg">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-xs font-semibold text-emerald-700">Live</span>
        </div>

        {/* Clock */}
        <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-500 font-mono bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
          <Wifi size={12} className="text-splp-500" />
          <span className="font-semibold text-slate-700">
            {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>

        {/* Refresh */}
        <button
          onClick={() => window.location.reload()}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          title="Refresh"
        >
          <RefreshCw size={16} />
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen(o => !o)}
            className="relative p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <Bell size={16} />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
          </button>
          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <span className="font-semibold text-sm text-slate-800">Notifikasi</span>
                <span className="badge-red">3 Baru</span>
              </div>
              <div className="divide-y divide-slate-50 max-h-64 overflow-auto">
                {[
                  { icon: '⚠️', msg: 'Latency API Verifikasi NIK meningkat (>400ms)', time: '2 menit lalu', type: 'warn' },
                  { icon: '✅', msg: 'Kafka broker berhasil terhubung ke kluster', time: '5 menit lalu', type: 'success' },
                  { icon: '🔔', msg: 'SLA BPJS Kesehatan API turun ke 98.1%', time: '12 menit lalu', type: 'info' },
                ].map((n, i) => (
                  <div key={i} className="px-4 py-3 hover:bg-slate-50 cursor-pointer">
                    <div className="flex gap-2.5">
                      <span className="text-base">{n.icon}</span>
                      <div>
                        <p className="text-xs text-slate-700 leading-relaxed">{n.msg}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{n.time}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-4 py-2 bg-slate-50 text-center">
                <button className="text-xs text-splp-600 font-semibold hover:underline">Lihat semua notifikasi</button>
              </div>
            </div>
          )}
        </div>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setUserMenu(o => !o)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-slate-50 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-splp-500 to-indigo-600 flex items-center justify-center">
              <span className="text-white text-xs font-bold">
                {user?.name?.charAt(0).toUpperCase() ?? 'A'}
              </span>
            </div>
            <div className="hidden lg:block text-left">
              <p className="text-xs font-semibold text-slate-800 leading-tight">{user?.name ?? 'Admin'}</p>
              <p className="text-[10px] text-slate-400">{user?.agency ?? 'SPLP'}</p>
            </div>
          </button>
          {userMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 z-[200] overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-800">{user?.name}</p>
                <p className="text-[10px] text-slate-500">{user?.email}</p>
                <span className="badge-blue text-[10px] mt-1 inline-block">{user?.role === 'admin' ? 'Administrator' : 'Instansi'}</span>
              </div>
              <button
                onClick={() => { setUserMenu(false); logout() }}
                className="w-full flex items-center gap-2 px-4 py-3 text-xs text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut size={13} />
                Keluar dari Portal
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
