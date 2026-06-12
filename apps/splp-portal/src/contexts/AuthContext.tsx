import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { deriveBackendUrl } from '../lib/utils'
const STORAGE_KEY = 'splp_auth'

export interface AuthUser {
  token: string
  username: string
  name: string
  agency: string
  role: 'admin' | 'instansi'
  icon: string
  email: string
}

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try { setUser(JSON.parse(stored)) } catch { localStorage.removeItem(STORAGE_KEY) }
    }
    setLoading(false)
  }, [])

  const login = async (username: string, password: string) => {
    const res = await fetch(`${deriveBackendUrl()}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Login gagal' }))
      throw new Error(err.error || 'Login gagal')
    }
    const data: AuthUser = await res.json()
    setUser(data)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem(STORAGE_KEY)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
