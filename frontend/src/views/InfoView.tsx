import { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ScanLine, Search, Package, Info, BarChart3, Leaf, Zap, AlertCircle, Camera } from 'lucide-react'
import { productsApi } from '../services/api'
import { Product } from '../types'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import CameraScanner from '../components/CameraScanner'
import { useT } from '../i18n'

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)

// ── Nutriscore ────────────────────────────────────────────────────────────────

const NUTRISCORE_COLORS: Record<string, string> = {
  a: '#00813A', b: '#85BB2F', c: '#FFCC00', d: '#EF8200', e: '#E63E11',
}

function NutriscoreBadge({ grade }: { grade: string }) {
  const g = grade.toLowerCase()
  const letters = ['a', 'b', 'c', 'd', 'e']
  return (
    <div className="flex items-center gap-0.5">
      {letters.map((l) => (
        <div
          key={l}
          style={{ backgroundColor: l === g ? NUTRISCORE_COLORS[l] : '#1e2235' }}
          className={`flex items-center justify-center font-bold text-white rounded transition-all ${
            l === g ? 'w-8 h-8 text-base' : 'w-6 h-6 text-xs opacity-50'
          }`}
        >
          {l.toUpperCase()}
        </div>
      ))}
    </div>
  )
}

// ── Nova Group ────────────────────────────────────────────────────────────────

const NOVA_COLORS: Record<number, string> = {
  1: '#00813A', 2: '#85BB2F', 3: '#EF8200', 4: '#E63E11',
}

function NovaGroupBadge({ group }: { group: number }) {
  const t = useT()
  const NOVA_LABELS: Record<number, string> = {
    1: t('info.nova_1'), 2: t('info.nova_2'), 3: t('info.nova_3'), 4: t('info.nova_4'),
  }
  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4].map((n) => (
        <div
          key={n}
          style={{ backgroundColor: n === group ? NOVA_COLORS[n] : '#1e2235' }}
          className={`flex items-center justify-center font-bold text-white rounded transition-all ${
            n === group ? 'w-7 h-7 text-sm' : 'w-5 h-5 text-xs opacity-40'
          }`}
        >
          {n}
        </div>
      ))}
      <span className="text-text-muted text-xs">{NOVA_LABELS[group] ?? `Groupe ${group}`}</span>
    </div>
  )
}

// ── Ecoscore ──────────────────────────────────────────────────────────────────

const ECOSCORE_COLORS: Record<string, string> = {
  'a+': '#00813A', a: '#85BB2F', b: '#C8DA36', c: '#FFCC00', d: '#EF8200', e: '#E63E11',
}

function EcoscoreBadge({ grade }: { grade: string }) {
  const t = useT()
  const g = grade.toLowerCase().replace('_', '+')
  const color = ECOSCORE_COLORS[g] ?? '#64748b'
  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-white text-xs font-bold"
      style={{ backgroundColor: color }}
    >
      <Leaf size={12} />
      {t('info.eco_label')} {g.toUpperCase()}
    </div>
  )
}

// ── Nutrition Table ───────────────────────────────────────────────────────────

const NUTRITION_LABELS: Record<string, { label: string; unit: string }> = {
  'energy-kcal_100g': { label: 'Énergie', unit: 'kcal' },
  'fat_100g': { label: 'Matières grasses', unit: 'g' },
  'saturated-fat_100g': { label: 'dont acides gras saturés', unit: 'g' },
  'carbohydrates_100g': { label: 'Glucides', unit: 'g' },
  'sugars_100g': { label: 'dont sucres', unit: 'g' },
  'fiber_100g': { label: 'Fibres alimentaires', unit: 'g' },
  'proteins_100g': { label: 'Protéines', unit: 'g' },
  'salt_100g': { label: 'Sel', unit: 'g' },
}

function NutritionTable({ json }: { json: string }) {
  const t = useT()
  let data: Record<string, number>
  try { data = JSON.parse(json) } catch { return null }

  const entries = Object.keys(NUTRITION_LABELS)
    .filter((k) => data[k] != null)
    .map((k) => ({ ...NUTRITION_LABELS[k], value: data[k] }))

  if (entries.length === 0) return null

  return (
    <div>
      <p className="text-text-muted text-xs uppercase tracking-wide font-medium mb-3 flex items-center gap-2">
        <Zap size={12} />
        {t('info.nutrition_label')}
      </p>
      <div className="rounded-xl overflow-hidden border border-bg-border">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-bg-border/50">
            {entries.map(({ label, unit, value }, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-bg-elevated/30' : ''}>
                <td className="px-4 py-2 text-text-secondary">{label}</td>
                <td className="px-4 py-2 text-text-primary font-medium text-right tabular-nums">
                  {typeof value === 'number' ? value.toFixed(value < 1 ? 2 : 1) : value} {unit}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main View ─────────────────────────────────────────────────────────────────

export default function InfoView() {
  const t = useT()
  const [query, setQuery] = useState('')
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showCamera, setShowCamera] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [searchParams] = useSearchParams()

  const doScan = async (barcode: string) => {
    setLoading(true)
    setError('')
    try {
      const { data } = await productsApi.scan(barcode)
      setProduct(data)
      setQuery('')
    } catch (err: any) {
      setError(err.response?.data?.detail ?? t('info.not_found'))
      setProduct(null)
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  useEffect(() => {
    const q = searchParams.get('q')
    if (q) doScan(q)
    else inputRef.current?.focus()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    doScan(query.trim())
  }

  const totalStock = product?.lots.reduce((a, l) => a + l.quantity, 0) ?? 0
  const avgBuyPrice = product?.lots.length
    ? product.lots.filter((l) => l.purchase_price).reduce((a, l, _, arr) => a + (l.purchase_price ?? 0) / arr.length, 0)
    : null
  const margin = avgBuyPrice && product?.selling_price
    ? ((product.selling_price - avgBuyPrice) / product.selling_price) * 100
    : null

  if (showCamera) {
    return (
      <CameraScanner
        onScan={(code) => { setShowCamera(false); doScan(code) }}
        onClose={() => setShowCamera(false)}
      />
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-slide-up">
      {/* Scanner */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-brand-500/10 text-brand-400 shrink-0">
            <ScanLine size={20} />
          </div>
          <div>
            <h2 className="text-text-primary font-semibold text-sm">{t('info.scanner_title')}</h2>
            <p className="text-text-muted text-xs mt-0.5">{t('info.scanner_subtitle')}</p>
          </div>
        </div>
        <form onSubmit={handleScan} className="flex gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('info.placeholder')}
              className="input pl-9"
              autoComplete="off"
              inputMode="numeric"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowCamera(true)}
            className="btn-secondary px-3 shrink-0"
            title={t('info.camera_title')}
          >
            <Camera size={16} />
          </button>
          <button type="submit" disabled={loading || !query} className="btn-primary px-5 shrink-0">
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <ScanLine size={16} />
            )}
          </button>
        </form>
        {error && (
          <p className="mt-3 text-danger-400 text-sm flex items-center gap-2">
            <AlertCircle size={14} />
            {error}
          </p>
        )}
      </div>

      {product && (
        <>
          {/* Hero image */}
          {product.image_url && (
            <div className="card p-0 overflow-hidden">
              <div className="h-56 md:h-72 bg-white flex items-center justify-center">
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="h-full w-full object-contain p-4"
                />
              </div>
            </div>
          )}

          {/* Main info */}
          <div className="card space-y-5">
            {/* Title + price */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h2 className="text-text-primary font-bold text-xl leading-tight">{product.name}</h2>
                {product.brand && <p className="text-text-secondary text-sm mt-1">{product.brand}</p>}
                <div className="flex items-center flex-wrap gap-2 mt-2">
                  {product.category && (
                    <span className="badge-brand">{product.category}</span>
                  )}
                  {product.unit && (
                    <span className="badge-neutral">{product.unit}</span>
                  )}
                  <span className="font-mono text-xs px-2 py-1 rounded-lg bg-bg-elevated text-text-muted border border-bg-border">
                    {product.barcode}
                  </span>
                </div>
              </div>
              {product.selling_price != null && (
                <div className="shrink-0 bg-brand-600/10 border border-brand-600/20 rounded-xl px-4 py-3 text-center">
                  <p className="text-text-muted text-xs uppercase tracking-wide">{t('info.sell_price_label')}</p>
                  <p className="text-brand-400 font-bold text-2xl mt-0.5">{fmt(product.selling_price)}</p>
                  {margin != null && (
                    <p className={`text-xs mt-1 font-medium ${margin >= 20 ? 'text-success-400' : margin >= 10 ? 'text-warning-400' : 'text-danger-400'}`}>
                      {t('info.margin')} {margin.toFixed(1)}%
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Stock row */}
            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-bg-border">
              <div className="text-center p-3 rounded-xl bg-bg-elevated">
                <p className={`font-bold text-2xl ${totalStock === 0 ? 'text-danger-400' : totalStock < 5 ? 'text-warning-400' : 'text-success-400'}`}>
                  {totalStock}
                </p>
                <p className="text-text-muted text-xs mt-0.5">{t('info.in_stock')}</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-bg-elevated">
                <p className="font-bold text-2xl text-text-primary">{product.lots.length}</p>
                <p className="text-text-muted text-xs mt-0.5">{t('info.lots_count')}</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-bg-elevated">
                <p className="font-bold text-xl text-text-primary">
                  {avgBuyPrice != null ? fmt(avgBuyPrice) : '—'}
                </p>
                <p className="text-text-muted text-xs mt-0.5">{t('info.avg_buy')}</p>
              </div>
            </div>

            {/* Scores */}
            {(product.nutriscore_grade || product.nova_group || product.ecoscore_grade) && (
              <div className="pt-4 border-t border-bg-border space-y-3">
                {product.nutriscore_grade && (
                  <div>
                    <p className="text-text-muted text-xs uppercase tracking-wide mb-2">{t('info.nutriscore_label')}</p>
                    <NutriscoreBadge grade={product.nutriscore_grade} />
                  </div>
                )}
                {product.nova_group != null && (
                  <div>
                    <p className="text-text-muted text-xs uppercase tracking-wide mb-2">{t('info.nova_label')}</p>
                    <NovaGroupBadge group={product.nova_group} />
                  </div>
                )}
                {product.ecoscore_grade && (
                  <div>
                    <p className="text-text-muted text-xs uppercase tracking-wide mb-2">{t('info.ecoscore_label')}</p>
                    <EcoscoreBadge grade={product.ecoscore_grade} />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Nutritional values */}
          {product.nutrition_per_100g && (
            <div className="card">
              <NutritionTable json={product.nutrition_per_100g} />
            </div>
          )}

          {/* Allergens & labels */}
          {(product.allergens || product.labels) && (
            <div className="card space-y-3">
              {product.allergens && (
                <div>
                  <p className="text-text-muted text-xs uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <AlertCircle size={12} />
                    {t('info.allergens_label')}
                  </p>
                  <p className="text-warning-400 text-sm leading-relaxed">{product.allergens}</p>
                </div>
              )}
              {product.labels && (
                <div>
                  <p className="text-text-muted text-xs uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Info size={12} />
                    {t('info.labels_label')}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {product.labels.split(',').map((l) => (
                      <span key={l} className="badge-success">{l.trim()}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Ingredients */}
          {product.description && (
            <div className="card">
              <p className="text-text-muted text-xs uppercase tracking-wide mb-3">{t('info.ingredients_label')}</p>
              <p className="text-text-secondary text-sm leading-relaxed">{product.description}</p>
            </div>
          )}

          {/* Lots */}
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 size={15} className="text-text-muted" />
              <h3 className="text-text-primary font-semibold text-sm">{t('info.lots_title')}</h3>
              <span className={`ml-auto badge ${totalStock < 5 ? 'badge-danger' : totalStock < 15 ? 'badge-warning' : 'badge-success'}`}>
                {totalStock} {t('info.units')}
              </span>
            </div>

            {product.lots.length === 0 ? (
              <p className="text-text-muted text-sm text-center py-6">{t('info.no_lots')}</p>
            ) : (
              <div className="overflow-x-auto -mx-5 px-5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-bg-border">
                      {[t('stock.lot_col_qty'), t('stock.lot_col_purchase'), t('info.purchased_on'), t('stock.lot_col_expiry'), t('info.supplier')].map((h) => (
                        <th key={h} className="text-left text-text-muted text-xs font-medium uppercase tracking-wide pb-3 pr-4 last:pr-0">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-bg-border/50">
                    {[...product.lots]
                      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                      .map((lot) => {
                        const expired = lot.expiry_date && parseISO(lot.expiry_date) < new Date()
                        const soon = lot.expiry_date && !expired && parseISO(lot.expiry_date) < new Date(Date.now() + 30 * 86400000)
                        return (
                          <tr key={lot.id} className="table-row-hover">
                            <td className="py-3 pr-4">
                              <span className={`font-semibold ${lot.quantity === 0 ? 'text-danger-400' : lot.quantity < 5 ? 'text-warning-400' : 'text-success-400'}`}>
                                {lot.quantity}
                              </span>
                            </td>
                            <td className="py-3 pr-4 text-text-secondary text-sm">{lot.purchase_price ? fmt(lot.purchase_price) : '—'}</td>
                            <td className="py-3 pr-4 text-xs">
                              <span className="text-brand-400 font-medium">{format(parseISO(lot.created_at), 'dd/MM/yy', { locale: fr })}</span>
                            </td>
                            <td className="py-3 pr-4">
                              {lot.expiry_date ? (
                                <span className={`badge ${expired ? 'badge-danger' : soon ? 'badge-warning' : 'badge-success'}`}>
                                  {format(parseISO(lot.expiry_date), 'dd/MM/yyyy')}
                                </span>
                              ) : <span className="text-text-muted text-xs">—</span>}
                            </td>
                            <td className="py-3 text-text-secondary text-xs">{lot.supplier ?? '—'}</td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {!product && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="p-5 rounded-2xl bg-bg-card border border-bg-border mb-4">
            <ScanLine size={40} className="text-text-muted" />
          </div>
          <p className="text-text-secondary font-medium">{t('info.scan_prompt')}</p>
          <p className="text-text-muted text-sm mt-1">{t('info.scan_hint')}</p>
        </div>
      )}
    </div>
  )
}
