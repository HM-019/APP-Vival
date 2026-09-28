import { NavLink, useLocation } from 'react-router-dom'
import { ScanLine, Package, ShoppingCart, Calendar, LayoutDashboard } from 'lucide-react'
import { useT } from '../../i18n'

const NAV = [
  { to: '/', icon: LayoutDashboard, key: 'nav.dashboard' as const, exact: true },
  { to: '/info', icon: ScanLine, key: 'nav.info' as const },
  { to: '/stock', icon: Package, key: 'nav.stock' as const },
  { to: '/caisse', icon: ShoppingCart, key: 'nav.caisse' as const },
  { to: '/planning', icon: Calendar, key: 'nav.planning' as const },
]

const MOBILE_NAV = NAV

export default function Sidebar() {
  const t = useT()
  const location = useLocation()

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col bg-bg-surface border-r border-bg-border">
        {/* Logo */}
        <div className="h-16 flex items-center px-5 border-b border-bg-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm tracking-tight">O</span>
            </div>
            <div>
              <p className="text-text-primary font-bold text-sm leading-none">OMAR</p>
              <p className="text-text-muted text-[11px] mt-0.5">Gestion Commerce</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map(({ to, icon: Icon, key, exact }) => {
            const isActive = exact ? location.pathname === to : location.pathname.startsWith(to)
            return (
              <NavLink
                key={to}
                to={to}
                className={`
                  flex items-center gap-3 px-3.5 py-3 rounded-lg text-sm font-medium transition-all duration-100
                  ${isActive
                    ? 'bg-brand-600/15 text-brand-400 border border-brand-600/20'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated border border-transparent'
                  }
                `}
              >
                <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                <span>{t(key)}</span>
                {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-400" />}
              </NavLink>
            )
          })}
        </nav>

        <div className="px-5 py-3 border-t border-bg-border shrink-0">
          <p className="text-text-muted text-[10px]">OMAR v1.0</p>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 z-50 flex md:hidden bg-bg-surface border-t border-bg-border h-16 safe-area-pb">
        {MOBILE_NAV.map(({ to, icon: Icon, key, exact }) => {
          const isActive = exact ? location.pathname === to : location.pathname.startsWith(to)
          return (
            <NavLink
              key={to}
              to={to}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
                isActive ? 'text-brand-400' : 'text-text-muted'
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
              <span>{t(key)}</span>
            </NavLink>
          )
        })}
      </nav>
    </>
  )
}
