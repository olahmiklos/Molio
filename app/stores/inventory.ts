// Raktár: készlet, előrejelzés, rendelési határidő, bevételezés, törzsadatok és kezelési csomagok (2.3)
import { defineStore } from 'pinia'
import { useDataStore } from './data'
import { addDays, dayDiff, dow, today, uid } from '~/utils/dates'
import type { Item, TreatmentType } from '~/utils/types'
import { attention, forecastItem, futureAppts, pkgFor, surfacesFor } from '~/utils/logic'
import { SITE_ID } from '~/utils/defaults'
import { expiryRows, lotSearch, lotsOf, orderSuggestions, receiveStock, untrackedQty, weightedAvg, type ReceiveInput } from '~/utils/stock'

export const useInventoryStore = defineStore('inventory', () => {
  const data = useDataStore()
  const db = computed(() => data.db)

  const itemById = (id: string) => db.value.items.find(i => i.id === id)
  const typeById = (id: string) => db.value.types.find(t => t.id === id)
  const groups = computed(() => [...new Set(db.value.items.map(i => i.group))])
  const suppliers = computed(() => [...new Set(db.value.items.map(i => i.supplier).filter(Boolean))])
  const alerts = computed(() => attention(db.value))
  const forecast = (it: Item) => forecastItem(db.value, it)

  /** sürgősség szerint rendezve */
  const rows = computed(() => {
    const list = db.value.items.map(it => ({ it, f: forecastItem(db.value, it) }))
    const rank = (r: typeof list[number]) => (r.f.neg ? 0 : r.f.level === 'red' ? 1 : r.f.low ? 2 : r.f.level === 'yellow' ? 3 : 4)
    return list.sort((a, b) => rank(a) - rank(b) || (a.f.orderBy || '9999').localeCompare(b.f.orderBy || '9999') || a.it.name.localeCompare(b.it.name, 'hu'))
  })
  const stockValue = computed(() => db.value.items.reduce((s, i) => s + Math.max(0, i.stock) * (i.price || 0), 0))
  const movementsOf = (id: string) => db.value.movements.filter(m => m.item === id).sort((a, b) => b.date.localeCompare(a.date))

  /** bevételezés egységárral (gördülő átlagár), gyártási számmal és lejárattal */
  function receive(itemId: string, inp: ReceiveInput) {
    const it = itemById(itemId); if (!it || !(inp.qty > 0)) return null
    return receiveStock(db.value, it, inp)
  }
  const previewAvg = (it: Item, qty: number, unitPrice: number) => weightedAvg(it.stock, it.price, qty, unitPrice)
  function addItem(it: Omit<Item, 'id' | 'siteId' | 'generic'>, lot?: { lot: string; expiry: string }) {
    const n: Item = { ...it, id: 'i' + uid(), siteId: SITE_ID, generic: false, lastPrice: it.price }
    db.value.items.push(n)
    db.value.movements.push({ id: uid(), item: n.id, date: today(), qty: n.stock, kind: 'in', note: 'Nyitókészlet', unitPrice: n.price, avgAfter: n.price, lot: lot?.lot || undefined, expiry: lot?.expiry || undefined })
    if (lot?.lot && n.stock > 0) db.value.lots.push({ id: uid(), item: n.id, lot: lot.lot, expiry: lot.expiry, qty: n.stock, received: today(), unitPrice: n.price })
    return n
  }

  /* ---------- gyártási tételek, lejárat, rendelési javaslat, megrendelések ---------- */
  const lots = (id: string) => lotsOf(db.value, id)
  const untracked = (it: Item) => untrackedQty(db.value, it)
  const expiring = computed(() => expiryRows(db.value, 90))
  const suggestions = computed(() => orderSuggestions(db.value))
  const openOrders = computed(() => db.value.orders.filter(o => o.status === 'ordered').sort((a, b) => b.date.localeCompare(a.date)))
  const searchLot = (q: string) => lotSearch(db.value, q)
  /** a munkatárs jelzi, hogy leadta a rendelést (a program maga nem rendel) */
  function markOrdered(supplier: string, lines: { item: string; qty: number }[], orderedBy: string, note: string) {
    const o = { id: uid(), date: today(), supplier, lines: lines.filter(l => l.qty > 0), orderedBy, status: 'ordered' as const, note }
    db.value.orders.push(o); return o
  }
  function closeOrder(id: string) { const o = db.value.orders.find(x => x.id === id); if (o) o.status = 'received' }
  /** a még nem használt anyag törölhető */
  function deleteItemCheck(id: string): string | null {
    const used = db.value.types.filter(t => t.mats.some(m => m.item === id)).map(t => t.name)
    if (used.length) return 'Nem törölhető, mert kezelési csomagban szerepel: ' + used.join(', ')
    if (db.value.records.some(r => r.materials.some(m => m.item === id))) return 'Nem törölhető, mert már rögzített kezelésben felhasználták.'
    return null
  }
  function deleteItem(id: string) {
    db.value.items = db.value.items.filter(i => i.id !== id)
    db.value.movements = db.value.movements.filter(m => m.item !== id)
    db.value.lots = db.value.lots.filter(l => l.item !== id)
  }

  function addType() {
    const t: TreatmentType = { id: 't' + uid(), name: 'Új kezelés', dur: 30, buffer: 0, price: 0, kw: [], mats: [], color: '#4f93bd' }
    db.value.types.push(t)
    return t
  }
  function deleteTypeCheck(id: string) {
    return db.value.appointments.some(a => a.typeIds.includes(id)) || db.value.records.some(r => r.typeIds.includes(id))
      ? 'Ez a kezeléstípus használatban van (időpont vagy kezelés), nem törölhető.' : null
  }
  function deleteType(id: string) { db.value.types = db.value.types.filter(t => t.id !== id) }
  const pkgCost = (t: TreatmentType) => t.mats.reduce((s, m) => s + m.qty * (itemById(m.item)?.price || 0), 0)

  /** heti fogyás: elmúlt 8 hét felhasználása és a következő 8 hét tervezett fogyása */
  function weekly(it: Item) {
    const t0 = today(), w0 = addDays(t0, 1 - dow(t0)), weeks: { s: string; past: number; plan: number }[] = []
    for (let i = -8; i < 9; i++) weeks.push({ s: addDays(w0, i * 7), past: 0, plan: 0 })
    const idx = (s: string) => Math.floor(dayDiff(weeks[0]!.s, s) / 7)
    db.value.movements.filter(m => m.item === it.id && m.qty < 0 && m.kind === 'use').forEach(m => { const k = idx(m.date); if (k >= 0 && k < weeks.length) weeks[k]!.past += -m.qty })
    futureAppts(db.value).forEach(a => {
      const q = pkgFor(db.value, a.typeIds, a.planned?.teeth.length || 1, surfacesFor(a.planned?.teeth || [], a.planned?.surfaces))[it.id] || 0
      const k = idx(a.date); if (q && k >= 0 && k < weeks.length) weeks[k]!.plan += q
    })
    return { weeks, w0 }
  }

  return { itemById, typeById, groups, suppliers, alerts, forecast, rows, stockValue, movementsOf, receive, previewAvg, addItem, lots, untracked, expiring, suggestions, openOrders, searchLot, markOrdered, closeOrder, deleteItemCheck, deleteItem, addType, deleteTypeCheck, deleteType, pkgCost, weekly }
})
