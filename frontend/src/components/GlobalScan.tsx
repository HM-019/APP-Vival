import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ScanLine, Package, ShoppingCart, Info, X, AlertCircle, Camera } from 'lucide-react'
import { productsApi } from '../services/api'
import { Product } from '../types'
import CameraScanner from './CameraScanner'
import { useT } from '../i18n'

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)

interface Props {
  open: boolean
  onClose: () => void
}

export default function GlobalScan({ open, onClose }: Props) {
  const t = useT()
  const [query, setQuery] = useState('')
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showCamera, setShowCamera] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (open) {
      setQuery('')
      setProduct(null)
      setError('')
      setTimeout(() => inputRef.current?.focus(), 80)
    }
  }, [open])

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [open, onClose])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError('')
    setProduct(null)
    try {
      const { data } = await productsApi.scan(query.trim())
      setProduct(data)
    } catch {
      setError(t('global.not_found'))
    } finally {
      setLoading(false)
    }
  }

  const go = (path: string) => {
    onClose()
    navigate(path)
  }

  if (!open) return null

  if (showCamera) {
    return (
      <CameraScanner
        onScan={(code) => { setShowCamera(false); setQuery(code); handleSearch({ preventDefault: () => {} } as React.FormEvent) }}
        onClose={() => setShowCamera(false)}
      />
    )
  }

  const stockStatus =
    !product ? null
    : product.lots.length === 0 ? { label: t('global.not_stocked'), cls: 'text-text-muted' }
    : product.total_stock === 0 ? { label: t('global.out_of_stock'), cls: 'text-danger-400' }
    : product.total_stock < 5 ? { label: `${product.total_stock} (${t('global.low_stock')})`, cls: 'text-warning-400' }
    : { label: `${product.total_stock} ${t('global.in_stock')}`, cls: 'text-success-400' }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-16 px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-bg-card border border-bg-border rounded-2xl shadow-2xl animate-slide-up overflow-hidden">
        {/* Search bar */}
        <form onSubmit={handleSearch} className="flex items-center gap-3 px-4 py-3 border-b border-bg-border">
          <ScanLine size={18} className="text-brand-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setError(''); setProduct(null) }}
            placeholder={t('global.search_placeholder')}
            className="flex-1 bg-transparent text-text-primary placeholder:text-text-muted focus:outline-none text-sm"
            autoComplete="off"
          />
          {loading ? (
            <span className="w-4 h-4 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin shrink-0" />
          ) : query ? (
            <button type="submit" className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-medium transition-colors">
              {t('global.search_btn')}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setShowCamera(true)}
            className="shrink-0 p-1.5 rounded-lg hover:bg-bg-elevated text-text-muted hover:text-brand-400 transition-colors"
            title={t('global.camera_title')}
          >
            <Camera size={16} />
          </button>
          <button type="button" onClick={onClose} className="shrink-0 p-1 rounded-lg hover:bg-bg-elevated text-text-muted hover:text-text-primary transition-colors">
            <X size={16} />
          </button>
        </form>

        {/* Error */}
        {error && (
          <div className="px-4 py-3 flex items-center gap-2 text-danger-400 text-sm border-b border-bg-border">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        {/* Product result */}
        {product && (
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-3">
              {product.image_url ? (
                <img src={product.image_url} alt="" className="w-14 h-14 rounded-xl object-contain bg-white p-1 shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-bg-elevated flex items-center justify-center shrink-0">
                  <Package size={20} className="text-text-muted" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-text-primary font-semibold text-sm leading-snug">{product.name}</p>
                {product.brand && <p className="text-text-muted text-xs mt-0.5">{product.brand}</p>}
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="font-mono text-xs text-text-muted">{product.barcode}</span>
                  {stockStatus && (
                    <span className={`text-xs font-medium ${stockStatus.cls}`}>{stockStatus.label}</span>
                  )}
                </div>
              </div>
              {product.selling_price != null && (
                <p className="text-brand-400 font-bold text-lg shrink-0">{fmt(Number(product.selling_price))}</p>
              )}
            </div>

            {/* Navigation actions */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => go(`/info?q=${encodeURIComponent(product.barcode)}`)}
                className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl bg-bg-elevated hover:bg-bg-border border border-bg-border text-text-secondary hover:text-text-primary transition-colors"
              >
                <Info size={20} />
                <span className="text-xs font-medium">Info</span>
              </button>
              <button
                onClick={() => go(`/caisse?scan=${encodeURIComponent(product.barcode)}`)}
                className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white transition-colors"
              >
                <ShoppingCart size={20} />
                <span className="text-xs font-medium">Caisse</span>
              </button>
              <button
                onClick={() => go(`/stock?scan=${encodeURIComponent(product.barcode)}`)}
                className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl bg-bg-elevated hover:bg-bg-border border border-bg-border text-warning-400 hover:text-warning-300 transition-colors"
              >
                <Package size={20} />
                <span className="text-xs font-medium">Stock</span>
              </button>
            </div>
          </div>
        )}

        {!product && !error && (
          <div className="px-4 py-3 flex items-center gap-2 text-text-muted text-xs">
            <span>{t('global.hint')}</span>
            <kbd className="ml-auto px-1.5 py-0.5 rounded bg-bg-elevated border border-bg-border text-[10px] shrink-0">Ctrl K</kbd>
          </div>
        )}
      </div>
    </div>
  )
}
