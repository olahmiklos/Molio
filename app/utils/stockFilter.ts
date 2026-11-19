// Raktár / Készlet szűrők (spec v2.1, 10. pont): szűrőállapot, mentett szűrők, szűrés
import { addDays, norm, today } from './dates'
import type { DB, Item, SavedFilter, StockFilters } from './types'
import { forecastItem, orderInfo, reserveQty, weeklyUse, type Forecast } from './logic'

export const emptyFilters = (): StockFilters => ({
  q: '', stockMin: null, stockMax: null, priceMin: null, priceMax: null, useMin: null, useMax: null, leadMin: null, leadMax: null,
  byFrom: '', byTo: '', quick: '', belowReserve: false, notOrdered: false, siteId: '',
})
/** előre elkészített szűrők (a felhasználó átnevezheti, törölheti) */
export function builtinFilters(): SavedFilter[] {
  return [
    { id: 'urgent', name: 'Sürgősen megrendelendő', builtin: true, filters: { ...emptyFilters(), quick: 'week', notOrdered: true } },
    { id: 'low', name: 'Kifogyóban', builtin: true, filters: { ...emptyFilters(), belowReserve: true } },
  ]
}
export interface StockRow { it: Item; f: Forecast; weekly: number; reserve: number; oi: ReturnType<typeof orderInfo>; ordered: boolean }
export function stockRows(db: DB): StockRow[] {
  return db.items.map(it => { const oi = orderInfo(db, it); return { it, f: forecastItem(db, it), weekly: weeklyUse(db, it), reserve: reserveQty(db, it), oi, ordered: oi.state === 'ordered' } })
}
const inRange = (v: number, lo: number | null, hi: number | null) => (lo === null || lo === undefined || v >= lo) && (hi === null || hi === undefined || v <= hi)
export function filterRows(rows: StockRow[], f: StockFilters): StockRow[] {
  const t0 = today()
  const q = norm(f.q).trim()
  return rows.filter(r => {
    if (f.siteId && r.it.siteId !== f.siteId) return false
    if (q && !norm(r.it.name + ' ' + r.it.group).includes(q)) return false
    if (!inRange(r.it.stock, f.stockMin, f.stockMax)) return false
    if (!inRange(r.it.price, f.priceMin, f.priceMax)) return false
    if (!inRange(r.weekly, f.useMin, f.useMax)) return false
    if (!inRange(r.it.lead, f.leadMin, f.leadMax)) return false
    const by = r.f.orderBy
    if (f.byFrom && (!by || by < f.byFrom)) return false
    if (f.byTo && (!by || by > f.byTo)) return false
    if (f.quick) {
      if (!by) return false
      if (f.quick === 'overdue' && !(by < t0)) return false
      if (f.quick === 'today' && by !== t0) return false
      if (f.quick === 'week' && !(by <= addDays(t0, 7))) return false
      if (f.quick === 'month' && !(by <= addDays(t0, 30))) return false
    }
    if (f.belowReserve && !(r.it.stock <= Math.max(r.reserve, r.it.target * 0.1))) return false
    if (f.notOrdered && r.ordered) return false
    return true
  })
}
/** az aktív szűrők címkéi (külön-külön törölhetők) */
export function filterChips(f: StockFilters): { key: keyof StockFilters | 'stock' | 'price' | 'use' | 'lead' | 'by'; label: string }[] {
  const out: { key: keyof StockFilters | 'stock' | 'price' | 'use' | 'lead' | 'by'; label: string }[] = []
  const rng = (a: number | null, b: number | null, unit: string) => (a !== null && b !== null ? `${a}–${b} ${unit}` : a !== null ? `legalább ${a} ${unit}` : `legfeljebb ${b} ${unit}`)
  if (f.siteId) out.push({ key: 'siteId', label: 'Telephely szűrve' })
  if (f.q.trim()) out.push({ key: 'q', label: `Anyag: „${f.q.trim()}”` })
  if (f.stockMin !== null || f.stockMax !== null) out.push({ key: 'stock', label: 'Készlet: ' + rng(f.stockMin, f.stockMax, 'db') })
  if (f.priceMin !== null || f.priceMax !== null) out.push({ key: 'price', label: 'Átlagár: ' + rng(f.priceMin, f.priceMax, 'Ft') })
  if (f.useMin !== null || f.useMax !== null) out.push({ key: 'use', label: 'Várható fogyás: ' + rng(f.useMin, f.useMax, 'db/hét') })
  if (f.leadMin !== null || f.leadMax !== null) out.push({ key: 'lead', label: 'Beszerzési idő: ' + rng(f.leadMin, f.leadMax, 'nap') })
  if (f.byFrom || f.byTo) out.push({ key: 'by', label: `Rendeld meg legkésőbb: ${f.byFrom || '…'} – ${f.byTo || '…'}` })
  if (f.quick) out.push({ key: 'quick', label: 'Rendeld meg legkésőbb: ' + ({ overdue: 'lejárt', today: 'ma', week: 'ezen a héten (7 napon belül)', month: '30 napon belül' }[f.quick]) })
  if (f.belowReserve) out.push({ key: 'belowReserve', label: 'Készlet a tartalék / 10% alatt' })
  if (f.notOrdered) out.push({ key: 'notOrdered', label: 'Még nincs megrendelve' })
  return out
}
