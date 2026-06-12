import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import DataExchange from './pages/DataExchange'
import Analytics from './pages/Analytics'
import Monitoring from './pages/Monitoring'
import Agencies from './pages/Agencies'
import ApiCatalog from './pages/ApiCatalog'
import Settings from './pages/Settings'

function AdminOnly() {
  const { user } = useAuth()
  return user?.role === 'admin' ? <Outlet /> : <Navigate to="/dashboard" replace />
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

function ProtectedRoutes() {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-splp-600 flex items-center justify-center text-white text-lg">🔗</div>
        <p className="text-sm text-slate-500 animate-pulse">Memuat SPLP Portal...</p>
      </div>
    </div>
  )
  if (!user) return <Login />
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"    element={<Dashboard />} />
        <Route path="exchange"     element={<DataExchange />} />
        <Route path="api-catalog"  element={<ApiCatalog />} />
        <Route element={<AdminOnly />}>
          <Route path="analytics"  element={<Analytics />} />
          <Route path="monitoring" element={<Monitoring />} />
          <Route path="agencies"   element={<Agencies />} />
          <Route path="settings"   element={<Settings />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <ProtectedRoutes />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
