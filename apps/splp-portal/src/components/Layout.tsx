import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())
  const location = useLocation()

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar open={sidebarOpen} currentPath={location.pathname} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          onToggleSidebar={() => setSidebarOpen(o => !o)}
          currentTime={currentTime}
          sidebarOpen={sidebarOpen}
        />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
