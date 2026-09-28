import { useLocation, useNavigate } from 'react-router-dom'
import { LogOut, ScanLine, Globe } from 'lucide-react'
import { useEffect, useState, useRef } from 'react'
import { useAuthStore } from '../../store/authStore'
import GlobalScan from '../GlobalScan'
import { useLangStore, useT, LANG_FLAGS, type Lang } from '../../i18n'

export default function Header() {
  const location = useLocation()
  const navigate = useNavigate()
  const logout = useAuthStore((s) => s.logout)
  const [time, setTime] = useState(new Date())
  const [scanOpen, setScanOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const langRef = useRef<HTMLDivElement>(null)
  const t = useT()
  const { lang, setLang } = useLangStore()

  const TITLES: Record<string, string> = {
    '/': t('nav.dashboard'),
    '/info': t('nav.info'),
    '/stock': t('nav.stock'),
    '/caisse': t('nav.caisse'),
    '/planning': t('nav.planning'),
  }

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setScanOpen(true) }
    }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [])

  // Close lang dropdown on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => { if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const title = TITLES[location.pathname] ?? 'OMAR'
  const LANGS: Lang[] = ['fr', 'en', 'es', 'it', 'ar']

  return (
    <>
      <header className="h-14 md:h-16 shrink-0 flex items-center justify-between px-4 md:px-6 bg-bg-surface border-b border-bg-border">
        {/* Mobile: logo + title */}
        <div className="flex md:hidden items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-xs">O</span>
          </div>
          <h1 className="text-text-primary font-semibold text-sm">{title}</h1>
        </div>

        {/* Desktop: title + date */}
        <div className="hidden md:block">
          <h1 className="text-text-primary font-semibold text-base">{title}</h1>
          <p className="text-text-muted text-xs mt-0.5">
            {time.toLocaleDateString(lang === 'ar' ? 'ar-DZ' : `${lang}-${lang.toUpperCase()}`, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        <div className="flex items-center gap-1.5 md:gap-2">
          {/* Global scan button */}
          <button
            onClick={() => setScanOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-elevated hover:bg-bg-border border border-bg-border text-text-secondary hover:text-text-primary transition-colors text-sm"
            title={t('header.scan_tooltip')}
          >
            <ScanLine size={15} className="text-brand-400" />
            <span className="hidden sm:inline text-xs">{t('common.scan')}</span>
            <kbd className="hidden lg:inline px-1.5 py-0.5 rounded bg-bg-card border border-bg-border text-[10px] text-text-muted">⌘K</kbd>
          </button>

          {/* Clock */}
          <div className="hidden sm:flex px-3 py-1.5 rounded-lg bg-bg-elevated border border-bg-border">
            <span className="text-text-primary font-mono text-sm tabular-nums">
              {time.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>

          {/* Language selector */}
          <div className="relative" ref={langRef}>
            <button
              onClick={() => setLangOpen(!langOpen)}
              className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg hover:bg-bg-elevated border border-transparent hover:border-bg-border text-text-muted hover:text-text-primary transition-colors"
              title={t('lang.select')}
            >
              <Globe size={16} />
              <span className="text-xs font-semibold">{LANG_FLAGS[lang]}</span>
            </button>

            {langOpen && (
              <div className="absolute right-0 top-full mt-1 w-44 rounded-xl bg-bg-card border border-bg-border shadow-xl z-50 overflow-hidden animate-slide-up">
                <div className="px-3 py-2 border-b border-bg-border">
                  <p className="text-text-muted text-xs font-medium">{t('lang.select')}</p>
                </div>
                {LANGS.map((l) => (
                  <button
                    key={l}
                    onClick={() => { setLang(l); setLangOpen(false) }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left hover:bg-bg-elevated transition-colors ${l === lang ? 'text-brand-400 bg-brand-500/5' : 'text-text-primary'}`}
                  >
                    <span className="text-base">{LANG_FLAGS[l]}</span>
                    <span>{t(`lang.${l}` as 'lang.fr')}</span>
                    {l === lang && <span className="ml-auto text-brand-400 text-xs">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Logout */}
          <button
            onClick={() => { logout(); navigate('/login') }}
            className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg hover:bg-danger-500/10 text-text-muted hover:text-danger-400 transition-colors"
            title={t('common.logout')}
          >
            <LogOut size={16} />
            <span className="hidden sm:inline text-sm">{t('common.logout')}</span>
          </button>
        </div>
      </header>

      <GlobalScan open={scanOpen} onClose={() => setScanOpen(false)} />
    </>
  )
}
