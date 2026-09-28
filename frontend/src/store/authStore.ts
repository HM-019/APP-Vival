import { create } from 'zustand'

interface AuthState {
  token: string | null
  setAuth: (token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('omar_token'),

  setAuth: (token) => {
    localStorage.setItem('omar_token', token)
    set({ token })
  },

  logout: () => {
    localStorage.removeItem('omar_token')
    set({ token: null })
  },
}))
