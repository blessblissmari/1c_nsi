import { Outlet } from 'react-router'
import { Navbar } from './Navbar'
import { LavaLampBackground } from './LavaLampBackground'
import { Toaster } from 'react-hot-toast'

export function AppLayout() {
  return (
    <div className="min-h-screen bg-graphite relative">
      <LavaLampBackground />
      <Navbar />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1a1c27',
            color: '#e4e4e7',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
          },
        }}
      />
      <main className="relative z-10 flex-1 overflow-y-auto pt-20 pb-8 px-4">
        <Outlet />
      </main>
    </div>
  )
}
