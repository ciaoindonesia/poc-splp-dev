import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard, Share2, BookOpen, BarChart3,
  Activity, Building2, Settings, ChevronRight, Zap, ShieldCheck, Building, LogOut
} from 'lucide-react'
import { cn, deriveBackendUrl } from '../lib/utils'
import { useAuth } from '../contexts/AuthContext'

const BACKEND = deriveBackendUrl()

type Role = 'admin' | 'instansi'

type SvcStatus = { ok: boolean }
const DEFAULT_STATUS: Record<string, SvcStatus> = {
  'WSO2 APIM': { ok: false }, 'WSO2 IS':  { ok: false },
  'Kafka':     { ok: false }, 'ClickHouse': { ok: false },
  'Grafana':   { ok: false }, 'Prometheus': { ok: false }, 'Loki': { ok: false },
}

function useServiceHealth() {
  const [statuses, setStatuses] = useState(DEFAULT_STATUS)
  useEffect(() => {
    const check = () =>
      fetch(`${BACKEND}/api/health/services`)
        .then(r => r.json())
        .then(d => setStatuses(d.services))
        .catch(() => {})
    check()
    const t = setInterval(check, 30_000)
    return () => clearInterval(t)
  }, [])
  return statuses
}

interface NavItem {
  label: string
  path: string
  icon: React.ReactNode
  badge?: string
  roles: Role[]
}

const navItems: NavItem[] = [
  { label: 'Dashboard',       path: '/dashboard',   icon: <LayoutDashboard size={18} />, roles: ['admin', 'instansi'] },
  { label: 'Pertukaran Data', path: '/exchange',    icon: <Share2 size={18} />, badge: 'Live', roles: ['admin', 'instansi'] },
  { label: 'Katalog API',     path: '/api-catalog', icon: <BookOpen size={18} />, roles: ['admin', 'instansi'] },
  { label: 'Analytics',       path: '/analytics',   icon: <BarChart3 size={18} />, roles: ['admin'] },
  { label: 'Monitoring',      path: '/monitoring',  icon: <Activity size={18} />, roles: ['admin'] },
  { label: 'Instansi',        path: '/agencies',    icon: <Building2 size={18} />, roles: ['admin'] },
  { label: 'Pengaturan',      path: '/settings',    icon: <Settings size={18} />, roles: ['admin'] },
]

const ROLE_LABEL: Record<Role, string> = { admin: 'Administrator', instansi: 'Operator Instansi' }
const ROLE_COLOR: Record<Role, string> = { admin: 'from-splp-500 to-indigo-600', instansi: 'from-emerald-500 to-teal-600' }

interface Props {
  open: boolean
  currentPath: string
}

export default function Sidebar({ open, currentPath }: Props) {
  const svcHealth = useServiceHealth()
  const { user, logout } = useAuth()
  const role = (user?.role ?? 'instansi') as Role
  const visibleItems = navItems.filter(item => item.roles.includes(role))

  if (!open) return null
  return (
    <aside className="w-64 bg-white border-r border-slate-100 flex flex-col h-full shrink-0 shadow-sm">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-splp-600 to-indigo-700 flex items-center justify-center shadow-md shadow-splp-200">
            <Zap size={18} className="text-white" />
          </div>
          <div>
            <div className="font-bold text-slate-900 text-sm leading-tight">SPLP 2026</div>
            <div className="text-[10px] text-slate-400 font-medium leading-tight">Komdigi</div>
          </div>
        </div>
      </div>

      {/* Role Banner */}
      <div className="px-3 pt-3">
        <div className={cn('rounded-xl px-3 py-2 flex items-center gap-2 bg-gradient-to-r', role === 'admin' ? 'from-splp-50 to-indigo-50 border border-splp-100' : 'from-emerald-50 to-teal-50 border border-emerald-100')}>
          {role === 'admin'
            ? <ShieldCheck size={14} className="text-splp-600 shrink-0" />
            : <Building size={14} className="text-emerald-600 shrink-0" />}
          <div className="min-w-0">
            <div className={cn('text-[10px] font-bold uppercase tracking-wider', role === 'admin' ? 'text-splp-600' : 'text-emerald-600')}>{ROLE_LABEL[role]}</div>
            <div className="text-[10px] text-slate-500 truncate">{user?.agency || '—'}</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-3 py-2">Menu</div>
        {visibleItems.map(item => {
          const isActive = item.path === '/' ? currentPath === '/' : currentPath.startsWith(item.path)
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(isActive ? 'sidebar-link-active' : 'sidebar-link-inactive')}
            >
              <span className={cn('transition-colors', isActive ? 'text-splp-600' : 'text-slate-400')}>
                {item.icon}
              </span>
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span className="badge-green text-[10px]">{item.badge}</span>
              )}
              {isActive && <ChevronRight size={14} className="text-splp-400" />}
            </Link>
          )
        })}
      </nav>

      {/* Services Status — admin only */}
      {role === 'admin' && (
        <div className="p-3 border-t border-slate-100">
          <div className="bg-slate-50 rounded-xl p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Status Layanan</div>
            {['WSO2 APIM','WSO2 IS','Kafka','ClickHouse','Grafana','Prometheus','Loki'].map(name => {
              const up = svcHealth[name]?.ok ?? false
              return (
                <div key={name} className="flex items-center justify-between py-0.5">
                  <span className="text-[11px] text-slate-600 font-medium">{name}</span>
                  <div className="flex items-center gap-1">
                    <span className={cn('w-1.5 h-1.5 rounded-full', up ? 'bg-emerald-500 animate-pulse' : 'bg-red-400')} />
                    <span className={cn('text-[10px] font-semibold', up ? 'text-emerald-600' : 'text-red-500')}>
                      {up ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* User info + Logout */}
      <div className="p-3 border-t border-slate-100">
        <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl">
          <div className={cn('w-7 h-7 rounded-full bg-gradient-to-br flex items-center justify-center shrink-0', ROLE_COLOR[role])}>
            {role === 'admin'
              ? <ShieldCheck size={14} className="text-white" />
              : <Building size={14} className="text-white" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-slate-800 truncate">{user?.name || user?.username || '—'}</div>
            <div className="text-[10px] text-slate-400 truncate">{user?.email || user?.agency || '—'}</div>
          </div>
          <button
            onClick={logout}
            title="Keluar dari Portal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  )
}
