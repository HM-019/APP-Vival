import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { ScanLine, Package, ShoppingCart, Calendar, LayoutDashboard } from 'lucide-react'
import Sidebar from './Sidebar'
import Header from './Header'

const mobileNav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { to: '/info', icon: ScanLine, label: 'Info' },
  { to: '/stock', icon: Package, label: 'Stock' },
  { to: '/caisse', icon: ShoppingCart, label: 'Caisse' },
  { to: '/planning', icon: Calendar, label: 'Planning' },
]

function MobileBottomNav() {
  const location = useLocation()
  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 flex md:hidden bg-bg-surface border-t border-bg-border h-16 safe-area-bottom">
      {mobileNav.map(({ to, icon: Icon, label, exact }) => {
        const isActive = exact ? location.pathname === to : location.pathname.startsWith(to)
        return (
          <NavLink
            key={to}
            to={to}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
              isActive ? 'text-brand-400' : 'text-text-muted'
            }`}
          >
            <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
            <span className="text-[10px] font-medium">{label}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}

export default function Layout() {
  return (
    <div className="flex h-screen bg-bg-primary overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <Header />
        <main className="flex-1 overflow-auto p-4 md:p-6 pb-20 md:pb-6 animate-fade-in">
          <Outlet />
        </main>
      </div>
      <MobileBottomNav />
    </div>
  )
}
