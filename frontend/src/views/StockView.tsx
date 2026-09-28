import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Package, Plus, Search, Edit2, Trash2, ScanLine, ChevronDown, ChevronUp, ArrowLeft, Camera } from 'lucide-react'
import { productsApi, stockApi } from '../services/api'
import { Product, Lot } from '../types'
import Modal from '../components/ui/Modal'
import CameraScanner from '../components/CameraScanner'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useForm } from 'react-hook-form'
import { useT } from '../i18n'

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)

type LotForm = { quantity: number; purchase_price?: number; expiry_date?: string; supplier?: string }
type ProductForm = { barcode: string; name: string; brand?: string; category?: string; selling_price?: number; unit?: string }

/* ── Lot row ── */
function LotRow({ lot, onEdit, onDelete }: { lot: Lot; onEdit: () => void; onDelete: () => void }) {
  const t = useT()
  const expired = lot.expiry_date && parseISO(lot.expiry_date) < new Date()
  const soon = lot.expiry_date && !expired && parseISO(lot.expiry_date) < new Date(Date.now() + 30 * 86400000)
  return (
    <tr className="table-row-hover">
      <td className="py-2.5 pl-10 pr-4">
        <span className={`font-semibold ${lot.quantity === 0 ? 'text-danger-400' : lot.quantity < 5 ? 'text-warning-400' : 'text-success-400'}`}>
          {lot.quantity}
        </span>
      </td>
      <td className="py-2.5 pr-4 text-text-secondary text-sm">{lot.purchase_price ? fmt(lot.purchase_price) : '—'}</td>
      <td className="py-2.5 pr-4 text-xs">
        <span className="text-brand-400 font-medium">{format(parseISO(lot.created_at), 'dd/MM/yy', { locale: fr })}</span>
      </td>
      <td className="py-2.5 pr-4">
        {lot.expiry_date ? (
          <span className={`badge ${expired ? 'badge-danger' : soon ? 'badge-warning' : 'badge-success'}`}>
            {format(parseISO(lot.expiry_date), 'dd/MM/yyyy')}
          </span>
        ) : <span className="text-text-muted text-xs">—</span>}
      </td>
      <td className="py-2.5 pr-4 text-text-secondary text-xs">{lot.supplier ?? '—'}</td>
      <td className="py-2.5 text-right">
        <div className="flex items-center justify-end gap-1">
          <button onClick={onEdit} className="btn-ghost p-1.5" title={t('common.edit')}><Edit2 size={13} /></button>
          <button onClick={onDelete} className="btn-ghost p-1.5 hover:text-danger-400" title={t('common.delete')}><Trash2 size={13} /></button>
        </div>
      </td>
    </tr>
  )
}

/* ── Product row ── */
function ProductRow({
  product, onAddLot, onEditProduct, onDeleteProduct, onEditQty,
}: {
  product: Product
  onAddLot: () => void
  onEditProduct: () => void
  onDeleteProduct: () => void
  onEditQty: () => void
}) {
  const t = useT()
  const [expanded, setExpanded] = useState(false)
  const qc = useQueryClient()
  const deleteLotMut = useMutation({
    mutationFn: (id: number) => stockApi.deleteLot(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })
  const [editLot, setEditLot] = useState<Lot | null>(null)

  const totalStock = product.lots.reduce((a, l) => a + l.quantity, 0)
  const expired = product.lots.some(l => l.expiry_date && parseISO(l.expiry_date) < new Date() && l.quantity > 0)
  const soon = !expired && product.lots.some(l => l.expiry_date && parseISO(l.expiry_date) < new Date(Date.now() + 30 * 86400000) && l.quantity > 0)

  return (
    <>
      <tr className="table-row-hover border-b border-bg-border/50">
        <td className="py-3.5 pr-2">
          <button onClick={() => setExpanded(!expanded)} className="btn-ghost p-1">
            {expanded ? <ChevronUp size={14} className="text-brand-400" /> : <ChevronDown size={14} />}
          </button>
        </td>
        <td className="py-3.5 pr-4">
          <div className="flex items-center gap-3">
            {product.image_url ? (
              <img src={product.image_url} alt={product.name} className="w-8 h-8 rounded-lg object-contain bg-bg-elevated shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-bg-elevated flex items-center justify-center shrink-0">
                <Package size={14} className="text-text-muted" />
              </div>
            )}
            <div>
              <p className="text-text-primary font-medium text-sm">{product.name}</p>
              {product.brand && <p className="text-text-muted text-xs">{product.brand}</p>}
            </div>
          </div>
        </td>
        <td className="py-3.5 pr-4">
          <span className="font-mono text-text-muted text-xs">{product.barcode}</span>
        </td>
        <td className="py-3.5 pr-4">
          <button
            onClick={onEditQty}
            className="group flex items-center gap-1.5 hover:bg-bg-elevated rounded-lg px-2 py-1 transition-colors"
            title={t('stock.qty_title')}
          >
            <span className={`font-bold text-sm ${totalStock === 0 ? 'text-danger-400' : totalStock < 5 ? 'text-warning-400' : 'text-success-400'}`}>
              {totalStock}
            </span>
            <Edit2 size={10} className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        </td>
        <td className="py-3.5 pr-4">
          {product.selling_price ? (
            <span className="text-text-primary font-medium text-sm">{fmt(product.selling_price)}</span>
          ) : <span className="text-text-muted text-xs">—</span>}
        </td>
        <td className="py-3.5 pr-2">
          <div className="flex items-center gap-1 flex-wrap">
            {product.lots.length === 0 && <span className="badge-neutral text-xs">{t('stock.status_none')}</span>}
            {product.lots.length > 0 && totalStock === 0 && <span className="badge-danger text-xs">{t('stock.status_out')}</span>}
            {totalStock > 0 && totalStock < 5 && <span className="badge-warning text-xs">{t('stock.status_low')}</span>}
            {expired && <span className="badge-danger text-xs">{t('stock.status_expired')}</span>}
            {soon && !expired && <span className="badge-warning text-xs">{t('stock.status_soon')}</span>}
            {product.lots.length > 0 && totalStock >= 5 && !expired && !soon && <span className="badge-success text-xs">{t('stock.status_ok')}</span>}
          </div>
        </td>
        <td className="py-3.5 text-right pr-3">
          <div className="flex items-center justify-end gap-1">
            <button onClick={onEditProduct} className="btn-ghost p-1.5" title={t('common.edit')}><Edit2 size={13} /></button>
            <button onClick={onAddLot} className="btn-primary py-1 px-2.5 text-xs" title="Réceptionner">
              <Plus size={12} /> Lot
            </button>
            <button onClick={onDeleteProduct} className="btn-ghost p-1.5 hover:text-danger-400" title={t('common.delete')}><Trash2 size={13} /></button>
          </div>
        </td>
      </tr>

      {expanded && product.lots.length > 0 && (
        <tr>
          <td colSpan={7} className="p-0">
            <div className="bg-bg-elevated/40 border-y border-bg-border/60">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-bg-border/40">
                    {[t('stock.lot_col_qty'), t('stock.lot_col_purchase'), t('stock.lot_col_received'), t('stock.lot_col_expiry'), t('stock.lot_col_supplier'), ''].map((h, i) => (
                      <th key={i} className={`text-left text-text-muted text-xs font-medium py-2 pr-4 last:pr-2 ${i === 0 ? 'pl-10' : ''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...product.lots]
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                    .map((lot) => (
                      <LotRow
                        key={lot.id}
                        lot={lot}
                        onEdit={() => setEditLot(lot)}
                        onDelete={() => { if (confirm(t('stock.delete_lot_confirm'))) deleteLotMut.mutate(lot.id) }}
                      />
                    ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}

      {editLot && <EditLotModal lot={editLot} onClose={() => setEditLot(null)} />}
    </>
  )
}

/* ── Edit lot modal ── */
function EditLotModal({ lot, onClose }: { lot: Lot; onClose: () => void }) {
  const t = useT()
  const qc = useQueryClient()
  const { register, handleSubmit } = useForm<LotForm>({
    defaultValues: { quantity: lot.quantity, purchase_price: lot.purchase_price ?? undefined, expiry_date: lot.expiry_date ?? undefined, supplier: lot.supplier ?? undefined },
  })
  const mut = useMutation({
    mutationFn: (data: LotForm) => stockApi.updateLot(lot.id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); onClose() },
  })
  return (
    <Modal open onClose={onClose} title={`${t('stock.edit_lot_title')} #${lot.id}`} size="sm">
      <form onSubmit={handleSubmit((d) => mut.mutate(d))} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">{t('stock.lot_col_qty')}</label>
            <input type="number" {...register('quantity', { valueAsNumber: true })} className="input" min={0} />
          </div>
          <div>
            <label className="label">{t('stock.purchase_price_label')}</label>
            <input type="number" step="0.01" {...register('purchase_price', { valueAsNumber: true })} className="input" />
          </div>
        </div>
        <div>
          <label className="label">{t('stock.expiry_label')}</label>
          <input type="date" {...register('expiry_date')} className="input" />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">{t('common.cancel')}</button>
          <button type="submit" disabled={mut.isPending} className="btn-primary flex-1">{t('common.save')}</button>
        </div>
      </form>
    </Modal>
  )
}

/* ── Reception modal (scan-first) ── */
function ReceptionModal({ initialProduct, onClose }: { initialProduct: Product | null; onClose: () => void }) {
  const t = useT()
  const qc = useQueryClient()
  const [product, setProduct] = useState<Product | null>(initialProduct)
  const [barcode, setBarcode] = useState('')
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState('')
  const [showCamera, setShowCamera] = useState(false)
  const [editPrice, setEditPrice] = useState(false)
  const [newSellPrice, setNewSellPrice] = useState('')
  const [formReady, setFormReady] = useState(false)
  const scanInputRef = useRef<HTMLInputElement>(null)
  const formReadyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { register, handleSubmit, reset } = useForm<LotForm>()

  const mut = useMutation({
    mutationFn: (data: LotForm) => stockApi.addLot({ ...data, product_id: product!.id }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); onClose() },
  })
  const updatePriceMut = useMutation({
    mutationFn: (price: number) => productsApi.update(product!.id, { selling_price: price }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })

  useEffect(() => {
    if (!product) {
      setTimeout(() => scanInputRef.current?.focus(), 80)
    } else {
      setNewSellPrice(product.selling_price ? String(product.selling_price) : '')
      setEditPrice(false)
      setFormReady(false)
      // Disable inputs for 450ms to absorb any trailing scanner keystrokes
      if (formReadyTimer.current) clearTimeout(formReadyTimer.current)
      formReadyTimer.current = setTimeout(() => setFormReady(true), 450)
    }
    return () => { if (formReadyTimer.current) clearTimeout(formReadyTimer.current) }
  }, [product])

  const onSubmit = handleSubmit(async (data) => {
    if (editPrice) {
      const price = parseFloat(newSellPrice)
      if (!isNaN(price) && price > 0) await updatePriceMut.mutateAsync(price)
    }
    mut.mutate(data)
  })

  const identifyProduct = async (bc: string) => {
    if (!bc.trim()) return
    setScanning(true)
    setError('')
    // Blur active element to clear any pending keyboard input from the scanner
    ;(document.activeElement as HTMLElement)?.blur()
    try {
      const { data } = await productsApi.scan(bc.trim())
      setProduct(data)
      reset()
    } catch {
      setError(t('stock.not_found'))
    } finally {
      setScanning(false)
    }
  }

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault()
    identifyProduct(barcode)
  }

  if (showCamera) {
    return (
      <CameraScanner
        onScan={(code) => { setShowCamera(false); identifyProduct(code) }}
        onClose={() => setShowCamera(false)}
      />
    )
  }

  return (
    <Modal open onClose={onClose} title={t('stock.reception_title')} size="sm">
      {!product ? (
        <div className="space-y-4">
          <p className="text-text-muted text-sm">{t('stock.reception_hint')}</p>
          <form onSubmit={handleScan} className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <ScanLine size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-400" />
                <input
                  ref={scanInputRef}
                  type="text"
                  inputMode="numeric"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  className="input pl-10 font-mono tracking-widest text-lg"
                  placeholder={t('stock.barcode_placeholder')}
                  autoComplete="off"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowCamera(true)}
                className="btn-secondary px-3"
                title={t('stock.camera_title')}
              >
                <Camera size={18} />
              </button>
            </div>
            {error && <p className="text-danger-400 text-sm">{error}</p>}
            <button type="submit" disabled={scanning || !barcode.trim()} className="btn-primary w-full">
              {scanning ? t('stock.searching') : t('stock.identify')}
            </button>
          </form>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Product card */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-bg-elevated border border-bg-border">
            {!initialProduct && (
              <button onClick={() => { setProduct(null); setBarcode('') }} className="btn-ghost p-1.5 shrink-0">
                <ArrowLeft size={16} />
              </button>
            )}
            {product.image_url ? (
              <img src={product.image_url} alt={product.name} className="w-14 h-14 rounded-xl object-contain bg-white shrink-0" />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-bg-card flex items-center justify-center shrink-0">
                <Package size={20} className="text-text-muted" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-text-primary font-semibold text-sm leading-tight">{product.name}</p>
              {product.brand && <p className="text-text-muted text-xs mt-0.5">{product.brand}</p>}
              {product.unit && <p className="text-text-muted text-xs">{product.unit}</p>}
              <p className="text-text-muted font-mono text-xs mt-0.5 opacity-60">{product.barcode}</p>
            </div>
          </div>

          {/* Lot form — inputs disabled for 450ms after scan to absorb trailing scanner keystrokes */}
          <form onSubmit={onSubmit} className="space-y-4">
            {!formReady && (
              <div className="flex items-center gap-2 text-text-muted text-xs animate-pulse">
                <span className="w-3 h-3 border border-brand-400/40 border-t-brand-400 rounded-full animate-spin shrink-0" />
                {t('stock.ready_hint')}
              </div>
            )}
            {/* Qty + purchase price */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label text-sm font-semibold">{t('stock.lot_col_qty')} *</label>
                <input
                  type="number"
                  inputMode="numeric"
                  {...register('quantity', { required: true, valueAsNumber: true, min: 1 })}
                  className="input text-2xl font-bold text-center h-14 disabled:opacity-40"
                  placeholder="0"
                  min={1}
                  disabled={!formReady}
                />
              </div>
              <div>
                <label className="label text-sm font-semibold">{t('stock.purchase_price_label')}</label>
                <input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  {...register('purchase_price', { valueAsNumber: true })}
                  className="input text-2xl font-bold text-center h-14 disabled:opacity-40"
                  placeholder="0.00"
                  disabled={!formReady}
                />
              </div>
            </div>

            {/* Selling price — show current with optional change */}
            <div className="rounded-xl border border-bg-border bg-bg-elevated/40 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-text-muted mb-0.5">{t('stock.sell_price_current')}</p>
                  <p className="text-text-primary font-semibold text-sm">
                    {product.selling_price
                      ? fmt(Number(product.selling_price))
                      : <span className="text-text-muted font-normal">{t('stock.price_undefined')}</span>}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditPrice(!editPrice)}
                  disabled={!formReady}
                  className={`btn-secondary text-xs px-3 py-1.5 shrink-0 disabled:opacity-40 ${editPrice ? 'text-danger-400 hover:bg-danger-500/10' : ''}`}
                >
                  {editPrice ? t('common.cancel') : (product.selling_price ? t('stock.price_change') : t('stock.price_set'))}
                </button>
              </div>
              {editPrice && (
                <div className="mt-3 pt-3 border-t border-bg-border">
                  <label className="label text-xs">{t('stock.new_sell_price')}</label>
                  <input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    value={newSellPrice}
                    onChange={(e) => setNewSellPrice(e.target.value)}
                    className="input text-xl font-bold text-center"
                    placeholder="0.00"
                  />
                </div>
              )}
            </div>

            {/* Expiry + supplier */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">{t('stock.expiry_label')}</label>
                <input type="date" {...register('expiry_date')} className="input" disabled={!formReady} />
              </div>
              <div>
                <label className="label">{t('stock.lot_col_supplier')}</label>
                <input type="text" {...register('supplier')} className="input disabled:opacity-40" placeholder="Nom..." disabled={!formReady} />
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="btn-secondary flex-1">{t('common.cancel')}</button>
              <button type="submit" disabled={!formReady || mut.isPending || updatePriceMut.isPending} className="btn-primary flex-1 disabled:opacity-40">
                {mut.isPending || updatePriceMut.isPending ? t('stock.adding') : t('stock.add_to_stock')}
              </button>
            </div>
          </form>
        </div>
      )}
    </Modal>
  )
}

/* ── Quantity edit modal ── */
function QtyModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const t = useT()
  const qc = useQueryClient()
  const totalStock = product.lots.reduce((a, l) => a + l.quantity, 0)
  const [value, setValue] = useState(String(totalStock))
  const mut = useMutation({
    mutationFn: (qty: number) => stockApi.setQuantity(product.id, qty),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); onClose() },
  })
  return (
    <Modal open onClose={onClose} title={t('stock.qty_title')} size="sm">
      <div className="flex items-center gap-3 p-3 rounded-xl bg-bg-elevated border border-bg-border mb-4">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-10 h-10 rounded-lg object-contain bg-white shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-bg-card flex items-center justify-center shrink-0">
            <Package size={14} className="text-text-muted" />
          </div>
        )}
        <div>
          <p className="text-text-primary font-medium text-sm">{product.name}</p>
          <p className="text-text-muted text-xs">{t('stock.current_stock')} <span className="font-semibold text-text-primary">{totalStock}</span></p>
        </div>
      </div>
      <div className="space-y-4">
        <div>
          <label className="label">{t('stock.qty_label')}</label>
          <input
            type="number"
            inputMode="numeric"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="input text-3xl font-bold text-center h-16"
            min={0}
            autoFocus
          />
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">{t('common.cancel')}</button>
          <button
            onClick={() => mut.mutate(parseInt(value) || 0)}
            disabled={mut.isPending || value === String(totalStock)}
            className="btn-primary flex-1"
          >
            {mut.isPending ? '...' : t('stock.qty_save')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

/* ── Main view ── */
export default function StockView() {
  const t = useT()
  const [search, setSearch] = useState('')
  const [receptionProduct, setReceptionProduct] = useState<Product | null>(null)
  const [receptionOpen, setReceptionOpen] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [qtyProduct, setQtyProduct] = useState<Product | null>(null)
  const [showCamera, setShowCamera] = useState(false)
  const qc = useQueryClient()
  const [searchParams] = useSearchParams()

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ['products', search],
    queryFn: () => productsApi.list(search).then((r) => r.data),
    refetchInterval: 30_000,
  })

  useEffect(() => {
    const bc = searchParams.get('scan')
    if (!bc) return
    window.history.replaceState({}, '', window.location.pathname)
    productsApi.scan(bc).then(({ data }) => {
      setReceptionProduct(data)
      setReceptionOpen(true)
    }).catch(() => {
      setReceptionProduct(null)
      setReceptionOpen(true)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const productForm = useForm<ProductForm>()
  const createProductMut = useMutation({
    mutationFn: (data: ProductForm) => productsApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); setShowAddProduct(false); productForm.reset() },
  })
  const updateProductMut = useMutation({
    mutationFn: (data: ProductForm) => productsApi.update(editProduct!.id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); setEditProduct(null) },
  })
  const deleteProductMut = useMutation({
    mutationFn: (id: number) => productsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })

  const totalValue = products.reduce((a, p) => a + p.lots.reduce((b, l) => b + (l.quantity * (l.purchase_price ?? 0)), 0), 0)

  // Camera scan from header
  if (showCamera) {
    return (
      <CameraScanner
        onScan={(code) => {
          setShowCamera(false)
          productsApi.scan(code).then(({ data }) => {
            setReceptionProduct(data)
            setReceptionOpen(true)
          }).catch(() => {
            setReceptionProduct(null)
            setReceptionOpen(true)
          })
        }}
        onClose={() => setShowCamera(false)}
      />
    )
  }

  return (
    <div className="space-y-5 animate-slide-up">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('stock.search_placeholder')}
            className="input pl-10"
          />
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <div className="hidden sm:flex px-4 py-2 rounded-lg bg-bg-card border border-bg-border text-sm">
            <span className="text-text-muted">{t('stock.value')} : </span>
            <span className="text-text-primary font-semibold ml-1">{fmt(totalValue)}</span>
          </div>
          <button onClick={() => setShowCamera(true)} className="btn-secondary px-3" title={t('stock.camera_title')}>
            <Camera size={16} />
          </button>
          <button onClick={() => { setReceptionProduct(null); setReceptionOpen(true) }} className="btn-primary">
            <ScanLine size={16} /> <span className="hidden sm:inline">{t('stock.receive')}</span>
          </button>
          <button onClick={() => { setShowAddProduct(true); productForm.reset() }} className="btn-secondary">
            <Plus size={16} /> <span className="hidden sm:inline">{t('stock.new_product')}</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-bg-border">
                <th className="w-10" />
                {[t('stock.col_product'), t('stock.col_barcode'), t('stock.col_stock'), t('stock.col_sell_price'), t('stock.col_status'), ''].map((h, i) => (
                  <th
                    key={i}
                    className="text-left text-text-muted text-xs font-medium uppercase tracking-wide px-4 py-3.5 last:pr-5 first:pl-0"
                  >{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="py-12 text-center">
                  <div className="w-6 h-6 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin mx-auto" />
                </td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-text-muted">
                  <Package size={28} className="mx-auto mb-2 opacity-50" />
                  {search ? t('stock.no_results') : t('stock.no_products')}
                </td></tr>
              ) : products.map((p) => (
                <ProductRow
                  key={p.id}
                  product={p}
                  onAddLot={() => { setReceptionProduct(p); setReceptionOpen(true) }}
                  onEditProduct={() => {
                    setEditProduct(p)
                    productForm.reset({ barcode: p.barcode, name: p.name, brand: p.brand ?? '', category: p.category ?? '', selling_price: p.selling_price ?? undefined, unit: p.unit ?? '' })
                  }}
                  onDeleteProduct={() => {
                    if (confirm(t('stock.delete_product_confirm'))) deleteProductMut.mutate(p.id)
                  }}
                  onEditQty={() => setQtyProduct(p)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reception modal */}
      {receptionOpen && (
        <ReceptionModal
          initialProduct={receptionProduct}
          onClose={() => { setReceptionOpen(false); setReceptionProduct(null) }}
        />
      )}

      {/* Qty edit modal */}
      {qtyProduct && <QtyModal product={qtyProduct} onClose={() => setQtyProduct(null)} />}

      {/* Add / Edit product modal */}
      <Modal
        open={showAddProduct || !!editProduct}
        onClose={() => { setShowAddProduct(false); setEditProduct(null) }}
        title={editProduct ? t('stock.edit_title') : t('stock.new_title')}
      >
        <form
          onSubmit={productForm.handleSubmit((d) => editProduct ? updateProductMut.mutate(d) : createProductMut.mutate(d))}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">{t('common.barcode')} *</label>
              <input type="text" {...productForm.register('barcode', { required: true })} className="input font-mono" placeholder="3017620422003" disabled={!!editProduct} />
            </div>
            <div className="col-span-2">
              <label className="label">{t('common.product')} *</label>
              <input type="text" {...productForm.register('name', { required: true })} className="input" placeholder="Nom du produit" />
            </div>
            <div>
              <label className="label">{t('stock.brand')}</label>
              <input type="text" {...productForm.register('brand')} className="input" />
            </div>
            <div>
              <label className="label">{t('stock.category')}</label>
              <input type="text" {...productForm.register('category')} className="input" />
            </div>
            <div>
              <label className="label">{t('stock.col_sell_price')} (€)</label>
              <input type="number" step="0.01" {...productForm.register('selling_price', { valueAsNumber: true })} className="input" placeholder="0.00" />
            </div>
            <div>
              <label className="label">{t('stock.unit_label')}</label>
              <input type="text" {...productForm.register('unit')} className="input" placeholder="1L, 500g..." />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setShowAddProduct(false); setEditProduct(null) }} className="btn-secondary flex-1">{t('common.cancel')}</button>
            <button type="submit" disabled={createProductMut.isPending || updateProductMut.isPending} className="btn-primary flex-1">
              {editProduct ? t('common.save') : t('common.add')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
