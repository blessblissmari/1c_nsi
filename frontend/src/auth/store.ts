import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CurrentUser {
  id: number
  email: string
  full_name: string | null
  is_active: boolean
  is_admin: boolean
}

interface AuthState {
  token: string | null
  user: CurrentUser | null
  setToken: (token: string | null) => void
  setUser: (user: CurrentUser | null) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setToken: (token) => set({ token }),
      setUser: (user) => set({ user }),
      logout: () => set({ token: null, user: null }),
    }),
    {
      name: 'nsi-auth',
      partialize: (s) => ({ token: s.token, user: s.user }),
    },
  ),
)
