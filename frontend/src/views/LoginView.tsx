import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, User, Lock } from 'lucide-react'
import { authApi } from '../services/api'
import { useAuthStore } from '../store/authStore'
import { useT } from '../i18n'

export default function LoginView() {
  const t = useT()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const usernameRef = useRef<HTMLInputElement>(null)
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => { usernameRef.current?.focus() }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username || !password) return
    setLoading(true)
    setError('')
    try {
      const { data } = await authApi.login(username, password)
      setAuth(data.access_token)
      navigate('/')
    } catch {
      setError(t('login.error'))
      setPassword('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center">
      <div className="w-full max-w-sm animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-600 mb-4 shadow-lg shadow-brand-600/30">
            <span className="text-white font-bold text-2xl tracking-tight">O</span>
          </div>
          <h1 className="text-text-primary font-bold text-2xl">OMAR</h1>
          <p className="text-text-secondary text-sm mt-1">{t('login.subtitle')}</p>
        </div>

        {/* Card */}
        <div className="bg-bg-card border border-bg-border rounded-2xl p-8 shadow-2xl">
          <h2 className="text-text-primary font-semibold mb-6">{t('login.title')}</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label className="label">{t('login.username')}</label>
              <div className="relative">
                <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                <input
                  ref={usernameRef}
                  type="text"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setError('') }}
                  placeholder={t('login.username_placeholder')}
                  className="input pl-10"
                  autoComplete="username"
                  autoCapitalize="none"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="label">{t('login.password')}</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError('') }}
                  placeholder="••••••••"
                  className="input pl-10 pr-10"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-danger-500/10 border border-danger-500/20 rounded-lg px-3 py-2">
                <p className="text-danger-400 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !username || !password}
              className="btn-primary w-full py-3 text-base mt-2"
            >
              {loading ? (
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                t('login.submit')
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-text-muted text-xs mt-6">
          OMAR v1.0 — Accès sécurisé
        </p>
      </div>
    </div>
  )
}
