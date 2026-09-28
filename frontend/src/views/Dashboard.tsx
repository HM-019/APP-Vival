import { useQuery } from '@tanstack/react-query'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import {
  TrendingUp, TrendingDown, Package, ShoppingCart, AlertTriangle,
  Banknote, CreditCard, FileText, Layers, ArrowRight, Clock,
  BarChart2, Percent,
} from 'lucide-react'
import { dashboardApi } from '../services/api'
import { DashboardStats, Transaction } from '../types'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useNavigate } from 'react-router-dom'
import { useT } from '../i18n'

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)

const fmtK = (n: number) =>
  n >= 1000
    ? `${(n / 1000).toFixed(1)}k€`
    : new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

const pct = (a: number, b: number) => {
  if (b === 0) return null
  const p = ((a - b) / b) * 100
  return { value: Math.abs(p).toFixed(1), up: p >= 0 }
}

const paymentColor: Record<string, string> = {
  cash: 'badge-success', card: 'badge-brand', check: 'badge-warning', mixed: 'badge-neutral',
}
const statusColor: Record<string, string> = {
  completed: 'badge-success', partial: 'badge-warning', cancelled: 'badge-danger',
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, trend, icon: Icon, color, onClick,
}: {
  label: string
  value: string
  sub?: string
  trend?: { value: string; up: boolean } | null
  icon: React.ElementType
  color: string
  onClick?: () => void
}) {
  return (
    <div
      className={`stat-card ${onClick ? 'cursor-pointer hover:border-brand-600/30' : ''} transition-colors`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-xl ${color}`}>
          <Icon size={18} strokeWidth={1.8} />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-medium ${trend.up ? 'text-success-400' : 'text-danger-400'}`}>
            {trend.up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {trend.value}%
          </div>
        )}
      </div>
      <p className="text-text-muted text-xs uppercase tracking-wide font-medium">{label}</p>
      <p className="text-text-primary text-2xl font-bold mt-0.5 leading-none">{value}</p>
      {sub && <p className="text-text-muted text-xs mt-1.5">{sub}</p>}
    </div>
  )
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-bg-elevated border border-bg-border rounded-xl px-4 py-3 shadow-xl">
      <p className="text-text-muted text-xs mb-2">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="text-sm font-semibold" style={{ color: p.color }}>
          {p.name} : {fmt(p.value)}
        </p>
      ))}
    </div>
  )
}

// ── Payment breakdown mini card ───────────────────────────────────────────────

function PayCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: React.ElementType; color: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-bg-elevated border border-bg-border">
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon size={15} />
      </div>
      <div>
        <p className="text-text-muted text-xs">{label}</p>
        <p className="text-text-primary font-semibold text-sm">{fmt(value)}</p>
      </div>
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const t = useT()
  const navigate = useNavigate()
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: () => dashboardApi.stats().then((r) => r.data),
    refetchInterval: 60_000,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-muted text-sm">{t('common.loading')}</p>
        </div>
      </div>
    )
  }

  if (!stats) return null

  const revTrend = pct(stats.revenue_today, stats.revenue_yesterday)
  const txTrend = pct(stats.transactions_today, stats.transactions_yesterday)
  const weekRevenue = stats.daily_stats.reduce((a, d) => a + d.revenue, 0)
  const weekProfit = stats.daily_stats.reduce((a, d) => a + d.profit, 0)
  const marginPct = weekRevenue > 0 ? (weekProfit / weekRevenue) * 100 : 0

  const todayBreakdown = stats.payment_breakdown_today
  const breakdownTotal = Object.values(todayBreakdown).reduce((a, v) => a + v, 0)

  return (
    <div className="space-y-5 animate-slide-up">

      {/* ── Row 1: Key KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label={t('dashboard.revenue_today')}
          value={fmt(stats.revenue_today)}
          sub={`${t('common.yesterday')} : ${fmt(stats.revenue_yesterday)}`}
          trend={revTrend}
          icon={TrendingUp}
          color="bg-brand-500/10 text-brand-400"
          onClick={() => navigate('/caisse')}
        />
        <StatCard
          label={t('dashboard.profit_today')}
          value={fmt(stats.profit_today)}
          sub={weekRevenue > 0 ? `${t('dashboard.margin_week')} ${marginPct.toFixed(1)}%` : t('dashboard.no_purchase_data')}
          icon={Percent}
          color={stats.profit_today >= 0 ? 'bg-success-500/10 text-success-400' : 'bg-danger-500/10 text-danger-400'}
        />
        <StatCard
          label={t('dashboard.transactions')}
          value={String(stats.transactions_today)}
          sub={`${t('dashboard.avg_basket')} : ${fmt(stats.avg_basket_today)}`}
          trend={txTrend}
          icon={ShoppingCart}
          color="bg-success-500/10 text-success-400"
          onClick={() => navigate('/caisse')}
        />
        <StatCard
          label={t('dashboard.stock_alerts')}
          value={String(stats.low_stock_alerts + stats.expiry_alerts)}
          sub={`${stats.low_stock_alerts} ${t('dashboard.ruptures')} · ${stats.expiry_alerts} ${t('dashboard.peremptions')}`}
          icon={AlertTriangle}
          color={stats.low_stock_alerts > 0 ? 'bg-danger-500/10 text-danger-400' : 'bg-bg-elevated text-text-muted'}
          onClick={() => navigate('/stock')}
        />
      </div>

      {/* ── Row 2: Payment breakdown today ── */}
      {breakdownTotal > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <PayCard label={t('dashboard.cash')} value={todayBreakdown.cash} icon={Banknote} color="bg-success-500/10 text-success-400" />
          <PayCard label={t('dashboard.card')} value={todayBreakdown.card} icon={CreditCard} color="bg-brand-500/10 text-brand-400" />
          <PayCard label={t('dashboard.check')} value={todayBreakdown.check} icon={FileText} color="bg-warning-500/10 text-warning-400" />
          <PayCard label={t('dashboard.mixed')} value={todayBreakdown.mixed} icon={Layers} color="bg-bg-elevated text-text-muted" />
        </div>
      )}

      {/* ── Row 3: Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue + Profit chart */}
        <div className="lg:col-span-2 card">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h3 className="text-text-primary font-semibold">{t('dashboard.revenue_profit')}</h3>
              <p className="text-text-muted text-xs mt-0.5">{t('dashboard.last_7_days')}</p>
            </div>
            <div className="text-right">
              <p className="text-text-primary font-semibold">{fmtK(weekRevenue)}</p>
              <p className={`text-xs font-medium mt-0.5 ${weekProfit >= 0 ? 'text-success-400' : 'text-danger-400'}`}>
                {t('dashboard.ben')} {fmtK(weekProfit)}
              </p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={stats.daily_stats} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2F45" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={fmtK} width={46} />
              <Tooltip content={<ChartTooltip />} />
              <Legend formatter={(v) => <span className="text-text-muted text-xs">{v}</span>} />
              <Bar dataKey="revenue" name={t('dashboard.revenue_short')} fill="#6366F1" radius={[3, 3, 0, 0]} maxBarSize={30} />
              <Bar dataKey="profit" name={t('dashboard.profit')} fill="#22C55E" radius={[3, 3, 0, 0]} maxBarSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top products */}
        <div className="card">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-text-primary font-semibold">{t('dashboard.top_products')}</h3>
            <span className="text-text-muted text-xs">{t('dashboard.last_30_days')}</span>
          </div>
          {stats.top_products.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-text-muted text-sm">{t('common.no_data')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.top_products.map((p, i) => {
                const max = stats.top_products[0].total
                const w = max > 0 ? (p.total / max) * 100 : 0
                const colors = ['bg-brand-500', 'bg-success-500', 'bg-warning-500', 'bg-danger-500', 'bg-text-muted']
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-text-secondary text-xs truncate max-w-[130px]">{p.name}</p>
                      <div className="text-right shrink-0 ml-2">
                        <p className="text-text-primary text-xs font-semibold">{fmt(p.total)}</p>
                        <p className="text-text-muted text-[10px]">{Math.round(p.qty)} {t('dashboard.units')}</p>
                      </div>
                    </div>
                    <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${colors[i] || 'bg-bg-border'} transition-all duration-700`}
                        style={{ width: `${w}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Row 4: Transactions per day (cash vs card) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Cash vs Card area */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-text-primary font-semibold">{t('dashboard.cash_vs_card')}</h3>
              <p className="text-text-muted text-xs mt-0.5">{t('dashboard.last_7_days')}</p>
            </div>
            <BarChart2 size={16} className="text-text-muted" />
          </div>
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={stats.daily_stats} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="cashGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22C55E" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="cardGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2F45" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={fmtK} width={40} />
              <Tooltip content={<ChartTooltip />} />
              <Legend formatter={(v) => <span className="text-text-muted text-xs">{v}</span>} />
              <Area type="monotone" dataKey="cash" name={t('dashboard.cash')} stroke="#22C55E" strokeWidth={2} fill="url(#cashGrad)" dot={false} />
              <Area type="monotone" dataKey="card" name={t('dashboard.card')} stroke="#6366F1" strokeWidth={2} fill="url(#cardGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Stock + summary */}
        <div className="card space-y-4">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-text-primary font-semibold text-sm">{t('nav.stock')}</h3>
              <button onClick={() => navigate('/stock')} className="text-brand-400 text-xs flex items-center gap-1">
                {t('common.see_all')} <ArrowRight size={11} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-xl bg-bg-elevated text-center">
                <p className="text-text-primary font-bold text-xl">{stats.stock_items_count}</p>
                <p className="text-text-muted text-xs">{t('dashboard.references')}</p>
              </div>
              <div className="p-3 rounded-xl bg-bg-elevated text-center">
                <p className="text-text-primary font-bold text-base">{fmtK(stats.stock_total_value)}</p>
                <p className="text-text-muted text-xs">{t('dashboard.value')}</p>
              </div>
            </div>
          </div>
          <div className="border-t border-bg-border pt-4 space-y-2">
            <p className="text-text-muted text-xs uppercase tracking-wide font-medium mb-2">{t('dashboard.week')}</p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">{t('dashboard.total_revenue')}</span>
              <span className="text-text-primary font-semibold">{fmt(weekRevenue)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">{t('dashboard.profit')}</span>
              <span className={`font-semibold ${weekProfit >= 0 ? 'text-success-400' : 'text-danger-400'}`}>{fmt(weekProfit)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">{t('dashboard.transactions')}</span>
              <span className="text-text-primary font-semibold">
                {stats.daily_stats.reduce((a, d) => a + d.transactions, 0)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 5: Recent transactions ── */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock size={15} className="text-text-muted" />
            <h3 className="text-text-primary font-semibold">{t('dashboard.recent_transactions')}</h3>
          </div>
          <button
            onClick={() => navigate('/caisse')}
            className="flex items-center gap-1 text-brand-400 hover:text-brand-300 text-xs font-medium transition-colors"
          >
            {t('common.see_all')} <ArrowRight size={12} />
          </button>
        </div>

        {stats.recent_transactions.length === 0 ? (
          <div className="text-center py-8">
            <ShoppingCart size={30} className="text-text-muted mx-auto mb-2" />
            <p className="text-text-muted text-sm">{t('dashboard.no_transactions')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-bg-border">
                  {[t('dashboard.invoice'), t('dashboard.time'), t('dashboard.items'), t('caisse.total'), t('dashboard.payment'), t('dashboard.status')].map((h) => (
                    <th key={h} className="text-left text-text-muted text-xs font-medium uppercase tracking-wide pb-3 pr-4 last:pr-0">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-bg-border/50">
                {stats.recent_transactions.map((tx: Transaction) => (
                  <tr key={tx.id} className="table-row-hover">
                    <td className="py-3 pr-4">
                      <span className="font-mono text-brand-400 text-xs">{tx.invoice_number}</span>
                    </td>
                    <td className="py-3 pr-4 text-text-secondary text-xs">
                      {format(new Date(tx.created_at), 'HH:mm', { locale: fr })}
                    </td>
                    <td className="py-3 pr-4 text-text-secondary">
                      {tx.items.length} {t('caisse.item_count')}{tx.items.length > 1 ? 's' : ''}
                    </td>
                    <td className="py-3 pr-4">
                      <span className="text-text-primary font-semibold">{fmt(Number(tx.total))}</span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={paymentColor[tx.payment_method ?? ''] ?? 'badge-neutral'}>
                        {tx.payment_method === 'cash' ? t('dashboard.cash')
                          : tx.payment_method === 'card' ? t('dashboard.card')
                          : tx.payment_method === 'check' ? t('dashboard.check')
                          : tx.payment_method === 'mixed' ? t('dashboard.mixed')
                          : tx.payment_method ?? '—'}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className={statusColor[tx.status] ?? 'badge-neutral'}>
                        {tx.status === 'completed' ? t('dashboard.completed')
                          : tx.status === 'partial' ? t('dashboard.partial')
                          : t('dashboard.cancelled')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
