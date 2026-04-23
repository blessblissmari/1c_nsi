import { Navigate, useLocation } from 'react-router'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { authApi } from '../api'
import { useAuthStore } from './store'

export function RequireAuth({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const location = useLocation()
  const [verifying, setVerifying] = useState(!!token && !user)

  useEffect(() => {
    let mounted = true
    if (token && !user) {
      authApi
        .me()
        .then((u) => {
          if (mounted) setUser(u)
        })
        .catch(() => {
          if (mounted) useAuthStore.getState().logout()
        })
        .finally(() => {
          if (mounted) setVerifying(false)
        })
    }
    return () => {
      mounted = false
    }
  }, [token, user, setUser])

  if (!token) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }
  if (verifying) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Загрузка…</div>
  }
  return <>{children}</>
}
