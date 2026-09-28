import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import fr from './fr'
import en from './en'
import es from './es'
import it from './it'
import ar from './ar'
import type { TranslationKeys } from './fr'

export type Lang = 'fr' | 'en' | 'es' | 'it' | 'ar'

export const LANG_FLAGS: Record<Lang, string> = {
  fr: '🇫🇷', en: '🇬🇧', es: '🇪🇸', it: '🇮🇹', ar: '🇸🇦',
}

const dicts: Record<Lang, Record<TranslationKeys, string>> = { fr, en, es, it, ar }

function applyLang(lang: Lang) {
  document.documentElement.lang = lang
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
}

interface LangStore {
  lang: Lang
  setLang: (l: Lang) => void
}

export const useLangStore = create<LangStore>()(
  persist(
    (set) => ({
      lang: 'fr' as Lang,
      setLang: (lang) => {
        applyLang(lang)
        set({ lang })
      },
    }),
    { name: 'omar-lang' }
  )
)

// Apply on first load from localStorage
const stored = localStorage.getItem('omar-lang')
if (stored) {
  try {
    const l = JSON.parse(stored).state?.lang as Lang
    if (l) applyLang(l)
  } catch {}
}

export function useT() {
  const lang = useLangStore((s) => s.lang)
  const d = dicts[lang] as Record<string, string>
  const fb = dicts['fr'] as Record<string, string>
  return (key: TranslationKeys, fallback?: string): string =>
    d[key] ?? fb[key] ?? fallback ?? key
}
