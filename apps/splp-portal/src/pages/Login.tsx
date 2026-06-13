import { useState, FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Eye, EyeOff, Loader2, Shield } from 'lucide-react'

const DEMO_ACCOUNTS = [
  { username: 'admin',       password: 'admin123',     label: 'Admin SPLP',              icon: '🏛️' },
  { username: 'dukcapil',    password: 'instansi123',  label: 'Operator Dukcapil',       icon: '🏛️' },
  { username: 'bpjs',        password: 'instansi123',  label: 'Operator BPJS Kesehatan', icon: '🏥' },
  { username: 'djp',         password: 'instansi123',  label: 'Operator DJP',            icon: '💰' },
  { username: 'polri',       password: 'instansi123',  label: 'Operator POLRI',          icon: '🚔' },
  { username: 'kemensos',    password: 'instansi123',  label: 'Operator Kemensos',       icon: '🤝' },
  { username: 'kemenkes',    password: 'instansi123',  label: 'Operator Kemenkes',       icon: '⚕️' },
  { username: 'kemendagri',  password: 'instansi123',  label: 'Operator Kemendagri',     icon: '🏠' },
  { username: 'kemenkumham', password: 'instansi123',  label: 'Operator Kemenkumham',    icon: '⚖️' },
]

export default function Login() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(username.trim(), password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login gagal')
    } finally {
      setLoading(false)
    }
  }

  const fillDemo = (u: string, p: string) => {
    setUsername(u)
    setPassword(p)
    setError(null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-splp-950 to-indigo-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-splp-600 shadow-xl mb-4">
            <span className="text-2xl">🔗</span>
          </div>
          <h1 className="text-2xl font-bold text-white">SPLP 2026</h1>
          <p className="text-slate-400 text-sm mt-1">Sistem Pertukaran Layanan Pemerintah</p>
          <div className="flex items-center justify-center gap-1.5 mt-2">
            <Shield size={12} className="text-splp-400" />
            <span className="text-xs text-splp-400 font-medium">Diproteksi oleh WSO2 Identity Server 7.3</span>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Masuk ke Portal</h2>
            <p className="text-sm text-slate-500 mt-0.5">Gunakan akun instansi Anda</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Masukkan username..."
                className="form-input"
                autoFocus
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Masukkan password..."
                  className="form-input pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-700">
                <span className="text-base">⚠️</span>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center text-sm disabled:opacity-60"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
              {loading ? 'Memverifikasi...' : 'Masuk'}
            </button>
          </form>

          {/* Demo accounts */}
          <div>
            <div className="relative mb-3">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-100" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-3 text-xs text-slate-400">Akun Demo (WSO2 IS)</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map(a => (
                <button
                  key={a.username}
                  type="button"
                  onClick={() => fillDemo(a.username, a.password)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs transition-all hover:border-splp-300 hover:bg-splp-50 text-left ${
                    username === a.username ? 'border-splp-400 bg-splp-50 text-splp-700 font-semibold' : 'border-slate-100 text-slate-600'
                  }`}
                >
                  <span>{a.icon}</span>
                  <span className="truncate">{a.label}</span>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 text-center mt-2">
              Klik akun demo lalu klik <strong>Masuk</strong> — admin: <code className="font-mono">admin123</code> | instansi: <code className="font-mono">instansi123</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
