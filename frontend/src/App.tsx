import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import Layout from './components/Layout/Layout'
import LoginView from './views/LoginView'
import Dashboard from './views/Dashboard'
import InfoView from './views/InfoView'
import StockView from './views/StockView'
import CaisseView from './views/CaisseView'
import PlanningView from './views/PlanningView'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token)
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  const token = useAuthStore((s) => s.token)

  return (
    <Routes>
      <Route path="/login" element={token ? <Navigate to="/" replace /> : <LoginView />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="info" element={<InfoView />} />
        <Route path="stock" element={<StockView />} />
        <Route path="caisse" element={<CaisseView />} />
        <Route path="planning" element={<PlanningView />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
