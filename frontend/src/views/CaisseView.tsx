import { useState, useRef, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ScanLine, Plus, Minus, Trash2, Search, CreditCard, Banknote, FileText,
  X, CheckCircle, History, ChevronLeft, AlertCircle, ShoppingBag, ChevronDown, Camera
} from 'lucide-react'
import { productsApi, caisseApi } from '../services/api'
import { CartItem, Product, Transaction } from '../types'
import Modal from '../components/ui/Modal'
import CameraScanner from '../components/CameraScanner'
import { format, isToday, isYesterday } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useForm } from 'react-hook-form'
import { useT } from '../i18n'

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)

type PaymentForm = {
  payment_method: string
  amount_paid: number
  notes?: string
}

const statusClass: Record<string, string> = {
  completed: 'badge-success', partial: 'badge-warning', cancelled: 'badge-danger'
}

// ── History Panel ─────────────────────────────────────────────────────────────

function HistoryPanel({ onClose }: { onClose: () => void }) {
  const t = useT()
  const [selected, setSelected] = useState<Transaction | null>(null)
  const [page, setPage] = useState(0)
  const qc = useQueryClient()

  const paymentLabel: Record<string, string> = {
    cash: t('caisse.cash'), card: t('caisse.card'), check: t('caisse.check'), mixed: t('caisse.mixed'),
  }
  const statusLabel: Record<string, string> = {
    completed: t('caisse.status_completed'), partial: t('caisse.status_partial'), cancelled: t('caisse.status_cancelled'),
  }

  const dayLabel = (dateStr: string): string => {
    const d = new Date(dateStr)
    if (isToday(d)) return `${t('caisse.today')} · ${format(d, 'dd MMMM', { locale: fr })}`
    if (isYesterday(d)) return `${t('caisse.yesterday')} · ${format(d, 'dd MMMM', { locale: fr })}`
    return format(d, 'EEEE dd MMMM yyyy', { locale: fr })
  }

  const { data: transactions = [] } = useQuery<Transaction[]>({
    queryKey: ['caisse-history', page],
    queryFn: () => caisseApi.history({ skip: page * 50, limit: 50 }).then((r) => r.data),
  })

  const cancelMut = useMutation({
    mutationFn: (id: number) => caisseApi.cancel(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['caisse-history'] })
      setSelected(null)
    },
  })

  const groups: { key: string; label: string; total: number; transactions: Transaction[] }[] = []
  for (const tx of transactions) {
    const key = format(new Date(tx.created_at), 'yyyy-MM-dd')
    let g = groups.find((g) => g.key === key)
    if (!g) {
      g = { key, label: dayLabel(tx.created_at), total: 0, transactions: [] }
      groups.push(g)
    }
    if (tx.status !== 'cancelled') g.total += Number(tx.total)
    g.transactions.push(tx)
  }

  return (
    <div className="fixed inset-0 md:inset-y-0 md:left-auto md:w-[600px] bg-bg-surface border-l border-bg-border flex flex-col z-40 shadow-2xl animate-fade-in">
      <div className="flex items-center justify-between px-5 py-4 border-b border-bg-border shrink-0">
        <h2 className="text-text-primary font-semibold">{t('caisse.history_title')}</h2>
        <button onClick={onClose} className="btn-ghost p-1.5"><X size={18} /></button>
      </div>

      <div className="flex-1 overflow-auto">
        {selected ? (
          <div className="p-5">
            <button
              onClick={() => setSelected(null)}
              className="flex items-center gap-2 text-text-secondary hover:text-text-primary text-sm mb-5 transition-colors"
            >
              <ChevronLeft size={14} /> {t('caisse.back')}
            </button>
            <div className="card mb-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-mono text-brand-400 text-sm">{selected.invoice_number}</p>
                  <p className="text-text-muted text-xs mt-1">
                    {format(new Date(selected.created_at), "dd/MM/yyyy 'à' HH:mm", { locale: fr })}
                  </p>
                </div>
                <span className={statusClass[selected.status] ?? 'badge-neutral'}>
                  {statusLabel[selected.status] ?? selected.status}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-bg-border text-sm">
                <div>
                  <p className="text-text-muted text-xs">{t('caisse.detail_total')}</p>
                  <p className="text-text-primary font-bold">{fmt(Number(selected.total))}</p>
                </div>
                <div>
                  <p className="text-text-muted text-xs">{t('caisse.detail_paid')}</p>
                  <p className="text-text-primary font-bold">{fmt(Number(selected.amount_paid))}</p>
                </div>
                <div>
                  <p className="text-text-muted text-xs">{t('caisse.detail_method')}</p>
                  <p className="text-text-primary font-medium">{paymentLabel[selected.payment_method ?? ''] ?? '—'}</p>
                </div>
              </div>
              {selected.notes && (
                <p className="mt-3 text-text-muted text-xs italic border-t border-bg-border pt-3">{selected.notes}</p>
              )}
            </div>
            <div className="card p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-bg-border">
                    {[t('caisse.col_article'), t('caisse.col_qty'), t('caisse.col_unit_price'), t('caisse.detail_total')].map((h) => (
                      <th key={h} className="text-left text-text-muted text-xs font-medium px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-bg-border/50">
                  {selected.items.map((item) => (
                    <tr key={item.id} className="table-row-hover">
                      <td className="px-4 py-2.5 text-text-primary">
                        {item.product_name}
                        {item.is_custom && <span className="ml-2 badge-brand text-[10px]">Custom</span>}
                      </td>
                      <td className="px-4 py-2.5 text-text-secondary">{item.quantity}</td>
                      <td className="px-4 py-2.5 text-text-secondary">{fmt(Number(item.unit_price))}</td>
                      <td className="px-4 py-2.5 text-text-primary font-medium">{fmt(Number(item.total_price))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {selected.status !== 'cancelled' && (
              <button
                onClick={() => { if (confirm(t('caisse.cancel_confirm'))) cancelMut.mutate(selected.id) }}
                className="btn-danger w-full mt-4"
                disabled={cancelMut.isPending}
              >
                {t('caisse.cancel_btn')}
              </button>
            )}
          </div>
        ) : (
          <div>
            {transactions.length === 0 ? (
              <div className="text-center py-16 text-text-muted">
                <History size={28} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">{t('caisse.no_transactions')}</p>
              </div>
            ) : (
              groups.map((group) => (
                <div key={group.key}>
                  <div className="sticky top-0 bg-bg-elevated/95 backdrop-blur-sm border-y border-bg-border px-5 py-2.5 flex items-center justify-between">
                    <span className="text-text-secondary text-sm font-medium capitalize">{group.label}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-text-muted text-xs">
                        {group.transactions.filter((tx) => tx.status !== 'cancelled').length} {t('caisse.item_count')}(s)
                      </span>
                      <span className="text-text-primary font-semibold text-sm">{fmt(group.total)}</span>
                    </div>
                  </div>
                  {group.transactions.map((tx) => (
                    <button
                      key={tx.id}
                      onClick={() => setSelected(tx)}
                      className={`w-full flex items-center justify-between px-5 py-4 hover:bg-bg-elevated transition-colors text-left border-b border-bg-border/30 ${
                        tx.status === 'cancelled' ? 'opacity-40' : ''
                      }`}
                    >
                      <div>
                        <p className="font-mono text-brand-400 text-sm">{tx.invoice_number}</p>
                        <p className="text-text-muted text-xs mt-0.5">
                          {format(new Date(tx.created_at), 'HH:mm')}
                          {' · '}{tx.items.length} {t('caisse.item_count')}{tx.items.length > 1 ? 's' : ''}
                          {tx.payment_method && ` · ${paymentLabel[tx.payment_method]}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-text-primary font-bold">{fmt(Number(tx.total))}</p>
                        <span className={`${statusClass[tx.status] ?? 'badge-neutral'} mt-1`}>
                          {statusLabel[tx.status] ?? tx.status}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {!selected && transactions.length >= 50 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-bg-border shrink-0">
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="btn-ghost p-2">
            <ChevronLeft size={16} />
          </button>
          <span className="text-text-muted text-xs">Page {page + 1}</span>
          <button onClick={() => setPage((p) => p + 1)} disabled={transactions.length < 50} className="btn-ghost p-2">
            <ChevronDown size={16} className="rotate-[-90deg]" />
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main View ─────────────────────────────────────────────────────────────────

export default function CaisseView() {
  const t = useT()
  const [scanQuery, setScanQuery] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [scanError, setScanError] = useState('')
  const [showPayment, setShowPayment] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showCustom, setShowCustom] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null)
  const [scanning, setScanning] = useState(false)
  const [showScanner, setShowScanner] = useState(true)
  const scanRef = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()
  const [searchParams] = useSearchParams()

  const PAYMENT_METHODS = [
    { value: 'cash', label: t('caisse.cash'), icon: Banknote },
    { value: 'card', label: t('caisse.card'), icon: CreditCard },
    { value: 'check', label: t('caisse.check'), icon: FileText },
    { value: 'mixed', label: t('caisse.mixed'), icon: ShoppingBag },
  ]

  const paymentLabel: Record<string, string> = {
    cash: t('caisse.cash'), card: t('caisse.card'), check: t('caisse.check'), mixed: t('caisse.mixed'),
  }

  useEffect(() => { scanRef.current?.focus() }, [])

  const total = cart.reduce((a, item) => a + item.unit_price * item.quantity, 0)

  const addToCart = useCallback((product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product_id === product.id && !i.is_custom)
      if (existing) {
        return prev.map((i) => i.id === existing.id ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [...prev, {
        id: `${Date.now()}-${Math.random()}`,
        product_id: product.id,
        product_name: product.name,
        product_barcode: product.barcode,
        quantity: 1,
        unit_price: product.selling_price ?? 0,
        is_custom: false,
      }]
    })
  }, [])

  useEffect(() => {
    const bc = searchParams.get('scan')
    if (!bc) return
    window.history.replaceState({}, '', window.location.pathname)
    setScanning(true)
    productsApi.scan(bc)
      .then(({ data }) => addToCart(data))
      .catch(() => setScanError(`"${bc}" ${t('caisse.not_found')}`))
      .finally(() => setScanning(false))
  }, [addToCart]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!scanQuery.trim()) return
    setScanning(true)
    setScanError('')
    try {
      const { data } = await productsApi.scan(scanQuery.trim())
      addToCart(data)
      setScanQuery('')
    } catch {
      setScanError(`"${scanQuery}" ${t('caisse.not_found')}`)
    } finally {
      setScanning(false)
      scanRef.current?.focus()
    }
  }

  const updateQty = (id: string, delta: number) => {
    setCart((prev) => prev
      .map((i) => i.id === id ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i)
      .filter((i) => i.quantity > 0)
    )
  }

  const updatePrice = (id: string, price: number) => {
    setCart((prev) => prev.map((i) => i.id === id ? { ...i, unit_price: price } : i))
  }

  const removeItem = (id: string) => setCart((prev) => prev.filter((i) => i.id !== id))

  const payForm = useForm<PaymentForm>({ defaultValues: { payment_method: 'cash', amount_paid: 0 } })

  const transactionMut = useMutation({
    mutationFn: (data: PaymentForm) => caisseApi.createTransaction({
      items: cart.map((i) => ({
        product_id: i.product_id ?? null,
        product_name: i.product_name,
        product_barcode: i.product_barcode ?? null,
        quantity: i.quantity,
        unit_price: i.unit_price,
        is_custom: i.is_custom,
      })),
      payment_method: data.payment_method,
      amount_paid: data.amount_paid,
      notes: data.notes,
    }),
    onSuccess: (res) => {
      setLastTransaction(res.data)
      setCart([])
      setShowPayment(false)
      payForm.reset({ payment_method: 'cash', amount_paid: 0 })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      scanRef.current?.focus()
    },
  })

  const amountPaid = payForm.watch('amount_paid')
  const change = Math.max(0, Number(amountPaid) - total)

  const customForm = useForm<{ name: string; price: number; qty: number }>({ defaultValues: { qty: 1 } })
  const addCustom = (data: { name: string; price: number; qty: number }) => {
    setCart((prev) => [...prev, {
      id: `custom-${Date.now()}`,
      product_name: data.name,
      quantity: data.qty,
      unit_price: data.price,
      is_custom: true,
    }])
    setShowCustom(false)
    customForm.reset({ qty: 1 })
  }

  if (showCamera) {
    return (
      <CameraScanner
        onScan={(code) => {
          setShowCamera(false)
          setScanning(true)
          productsApi.scan(code)
            .then(({ data }) => addToCart(data))
            .catch(() => setScanError(`"${code}" ${t('caisse.not_found')}`))
            .finally(() => setScanning(false))
        }}
        onClose={() => setShowCamera(false)}
      />
    )
  }

  return (
    <div className="flex flex-col md:flex-row gap-4 h-full animate-slide-up">
      {/* Left sidebar: scanner + actions */}
      <div className={`md:w-72 shrink-0 flex flex-col gap-3 ${showScanner ? '' : 'hidden md:flex'}`}>
        {/* Scanner */}
        <div className="card">
          <p className="text-text-secondary text-xs font-medium uppercase tracking-wide mb-3">{t('caisse.scan_label')}</p>
          <form onSubmit={handleScan} className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <ScanLine size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  ref={scanRef}
                  type="text"
                  value={scanQuery}
                  onChange={(e) => { setScanQuery(e.target.value); setScanError('') }}
                  placeholder={t('stock.barcode_placeholder')}
                  className="input pl-10"
                  autoComplete="off"
                  inputMode="numeric"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowCamera(true)}
                className="btn-secondary px-3 shrink-0"
                title={t('caisse.camera_title')}
              >
                <Camera size={16} />
              </button>
            </div>
            {scanError && (
              <p className="text-danger-400 text-xs flex items-center gap-1.5">
                <AlertCircle size={12} /> {scanError}
              </p>
            )}
            <button type="submit" disabled={scanning || !scanQuery} className="btn-primary w-full">
              {scanning
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <><ScanLine size={15} /> {t('caisse.add')}</>
              }
            </button>
          </form>
        </div>

        {/* Actions */}
        <div className="card space-y-1.5">
          <p className="text-text-secondary text-xs font-medium uppercase tracking-wide mb-2">{t('caisse.actions')}</p>
          <button onClick={() => { setShowCustom(true); setShowScanner(false) }} className="btn-secondary w-full justify-start gap-3">
            <Plus size={15} className="text-brand-400" />
            {t('caisse.custom_item')}
          </button>
          <button onClick={() => { setShowHistory(true); setShowScanner(false) }} className="btn-secondary w-full justify-start gap-3">
            <History size={15} className="text-text-secondary" />
            {t('caisse.history')}
          </button>
          <button
            onClick={() => { if (cart.length > 0 && !confirm(t('caisse.empty_cart_confirm'))) return; setCart([]) }}
            disabled={cart.length === 0}
            className="btn-ghost w-full justify-start gap-3 text-danger-400/80 hover:text-danger-400 disabled:opacity-30"
          >
            <Trash2 size={15} />
            {t('caisse.clear')}
          </button>
        </div>

        {/* Last transaction */}
        {lastTransaction && (
          <div className="card border-success-500/20 bg-success-500/5">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle size={15} className="text-success-400" />
              <p className="text-success-400 text-sm font-medium">{t('caisse.transaction_ok')}</p>
            </div>
            <p className="font-mono text-xs text-text-muted">{lastTransaction.invoice_number}</p>
            <p className="text-text-primary font-bold text-lg mt-0.5">{fmt(Number(lastTransaction.total))}</p>
            {Number(lastTransaction.change_given) > 0 && (
              <p className="text-warning-400 text-sm mt-1">{t('caisse.change_given')} : {fmt(Number(lastTransaction.change_given))}</p>
            )}
          </div>
        )}

        {/* Mobile: go to cart button */}
        {cart.length > 0 && (
          <button
            onClick={() => setShowScanner(false)}
            className="md:hidden btn-primary py-3.5 justify-between shrink-0"
          >
            <span className="font-semibold">
              {t('caisse.view_cart')} · {cart.length} {t('caisse.item_count')}{cart.length > 1 ? 's' : ''}
            </span>
            <span className="font-bold text-lg">{fmt(total)}</span>
          </button>
        )}
      </div>

      {/* Right: Cart */}
      <div className={`flex-1 flex flex-col gap-3 min-w-0 ${showScanner ? 'hidden md:flex' : 'flex'}`}>
        {/* Mobile toggle */}
        <div className="flex md:hidden items-center gap-2">
          <button onClick={() => setShowScanner(true)} className="btn-secondary gap-2 text-sm">
            <ScanLine size={14} /> {t('caisse.scan_label')}
          </button>
          <h3 className="text-text-primary font-semibold ml-2">
            {t('caisse.cart')} {cart.length > 0 && <span className="text-text-muted font-normal text-sm">({cart.length})</span>}
          </h3>
        </div>

        {/* Cart header (desktop) */}
        <div className="hidden md:flex items-center justify-between">
          <h3 className="text-text-primary font-semibold">
            {t('caisse.cart')}
            {cart.length > 0 && <span className="ml-2 text-text-muted font-normal text-sm">({cart.length} {t('caisse.item_count')}{cart.length > 1 ? 's' : ''})</span>}
          </h3>
        </div>

        <div className="card flex-1 p-0 overflow-hidden flex flex-col">
          {cart.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-text-muted py-12">
              <ShoppingBag size={36} className="mb-3 opacity-30" />
              <p className="font-medium text-text-secondary">{t('caisse.empty_label')}</p>
              <p className="text-sm mt-1">{t('caisse.scan_to_start')}</p>
            </div>
          ) : (
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-bg-card z-10">
                  <tr className="border-b border-bg-border">
                    {[t('caisse.col_article'), t('caisse.col_unit_price'), t('caisse.col_qty'), t('caisse.detail_total'), ''].map((h) => (
                      <th key={h} className="text-left text-text-muted text-xs font-medium uppercase tracking-wide px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-bg-border/40">
                  {cart.map((item) => (
                    <tr key={item.id} className="table-row-hover group">
                      <td className="px-4 py-3">
                        <p className="text-text-primary font-medium">{item.product_name}</p>
                        {item.product_barcode && <p className="text-text-muted text-xs font-mono">{item.product_barcode}</p>}
                        {item.is_custom && <span className="badge-brand text-[10px]">Custom</span>}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          step="0.01"
                          value={item.unit_price}
                          onChange={(e) => updatePrice(item.id, Number(e.target.value))}
                          className="w-20 input py-1.5 px-2 text-center text-sm"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => updateQty(item.id, -1)} className="w-7 h-7 rounded-lg bg-bg-elevated hover:bg-bg-border flex items-center justify-center text-text-secondary transition-colors">
                            <Minus size={12} />
                          </button>
                          <span className="w-7 text-center text-text-primary font-medium text-sm">{item.quantity}</span>
                          <button onClick={() => updateQty(item.id, 1)} className="w-7 h-7 rounded-lg bg-bg-elevated hover:bg-bg-border flex items-center justify-center text-text-secondary transition-colors">
                            <Plus size={12} />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-text-primary font-semibold">{fmt(item.unit_price * item.quantity)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => removeItem(item.id)}
                          className="opacity-0 group-hover:opacity-100 btn-ghost p-1.5 text-danger-400/60 hover:text-danger-400 transition-all"
                        >
                          <X size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {cart.length > 0 && (
            <div className="border-t border-bg-border px-4 py-3 bg-bg-elevated/50 flex items-center justify-between shrink-0">
              <p className="text-text-muted text-sm">{cart.reduce((a, i) => a + i.quantity, 0)} {t('caisse.units')}</p>
              <div className="text-right">
                <p className="text-text-muted text-xs uppercase tracking-wide">{t('caisse.detail_total')}</p>
                <p className="text-text-primary font-bold text-2xl">{fmt(total)}</p>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => { payForm.setValue('amount_paid', total); setShowPayment(true) }}
          disabled={cart.length === 0}
          className="btn-success py-4 text-base font-semibold shrink-0"
        >
          <CheckCircle size={20} />
          {t('caisse.checkout_btn')} — {fmt(total)}
        </button>
      </div>

      {/* History Panel */}
      {showHistory && <HistoryPanel onClose={() => { setShowHistory(false); setShowScanner(true) }} />}

      {/* Payment Modal */}
      <Modal open={showPayment} onClose={() => setShowPayment(false)} title={t('caisse.checkout_title')} size="sm">
        <form onSubmit={payForm.handleSubmit((d) => transactionMut.mutate(d))} className="space-y-5">
          <div className="bg-bg-elevated rounded-xl p-4 text-center">
            <p className="text-text-muted text-sm">{t('caisse.amount_label')}</p>
            <p className="text-text-primary font-bold text-3xl mt-1">{fmt(total)}</p>
          </div>

          <div>
            <label className="label">{t('caisse.payment_method')}</label>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map(({ value, label, icon: Icon }) => {
                const sel = payForm.watch('payment_method') === value
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => payForm.setValue('payment_method', value)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                      sel
                        ? 'bg-brand-600/15 border-brand-600/40 text-brand-400'
                        : 'bg-bg-elevated border-bg-border text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    <Icon size={16} />
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="label">{t('caisse.amount_paid')}</label>
            <input
              type="number"
              step="0.01"
              inputMode="decimal"
              {...payForm.register('amount_paid', { valueAsNumber: true, min: 0 })}
              className="input text-right text-lg font-semibold"
            />
            {payForm.watch('payment_method') === 'cash' && Number(amountPaid) >= total && total > 0 && (
              <div className="mt-2 bg-success-500/10 border border-success-500/20 rounded-lg px-3 py-2">
                <p className="text-success-400 text-sm font-medium">{t('caisse.change')} : {fmt(change)}</p>
              </div>
            )}
            {Number(amountPaid) > 0 && Number(amountPaid) < total && (
              <div className="mt-2 bg-warning-500/10 border border-warning-500/20 rounded-lg px-3 py-2">
                <p className="text-warning-400 text-sm">{t('caisse.remaining')} : {fmt(total - Number(amountPaid))}</p>
              </div>
            )}
          </div>

          <div>
            <label className="label">{t('caisse.notes')}</label>
            <input type="text" {...payForm.register('notes')} className="input" placeholder={t('caisse.notes_placeholder')} />
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={() => setShowPayment(false)} className="btn-secondary flex-1">{t('common.cancel')}</button>
            <button type="submit" disabled={transactionMut.isPending} className="btn-success flex-1">
              {transactionMut.isPending ? t('caisse.processing') : t('caisse.validate')}
            </button>
          </div>
          {transactionMut.error && (
            <p className="text-danger-400 text-sm text-center">
              {(transactionMut.error as any)?.response?.data?.detail ?? t('caisse.error')}
            </p>
          )}
        </form>
      </Modal>

      {/* Custom Item Modal */}
      <Modal open={showCustom} onClose={() => { setShowCustom(false); setShowScanner(true) }} title={t('caisse.custom_item')} size="sm">
        <form onSubmit={customForm.handleSubmit(addCustom)} className="space-y-4">
          <div>
            <label className="label">{t('caisse.designation')} *</label>
            <input type="text" {...customForm.register('name', { required: true })} className="input" placeholder={t('caisse.custom_placeholder')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{t('caisse.price_label')} *</label>
              <input type="number" step="0.01" inputMode="decimal" {...customForm.register('price', { required: true, valueAsNumber: true, min: 0 })} className="input" placeholder="0.00" />
            </div>
            <div>
              <label className="label">{t('common.quantity')}</label>
              <input type="number" inputMode="numeric" {...customForm.register('qty', { valueAsNumber: true, min: 1 })} className="input" placeholder="1" />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => { setShowCustom(false); setShowScanner(true) }} className="btn-secondary flex-1">{t('common.cancel')}</button>
            <button type="submit" className="btn-primary flex-1">{t('common.add')}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
