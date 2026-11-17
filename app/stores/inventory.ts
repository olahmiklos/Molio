// Raktár: készlet, előrejelzés, rendelési határidő, bevételezés, törzsadatok és kezelési csomagok (2.3)
import { defineStore } from 'pinia'
import { useDataStore } from './data'
import { addDays, dayDiff, dow, today, uid } from '~/utils/dates'
import type { Item, TreatmentType } from '~/utils/types'
import { attention, forecastItem, futureAppts, pkgFor, surfacesFor } from '~/utils/logic'
import { SITE_ID } from '~/utils/defaults'

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

  function receive(itemId: string, qty: number, date: string, note: string) {
    const it = itemById(itemId); if (!it || !(qty > 0)) return
    it.stock += qty
    db.value.movements.push({ id: uid(), item: it.id, date: date || today(), qty, kind: 'in', note: note || 'Bevételezés' })
  }
  function addItem(it: Omit<Item, 'id' | 'siteId' | 'generic'>) {
    const n: Item = { ...it, id: 'i' + uid(), siteId: SITE_ID, generic: false }
    db.value.items.push(n)
    db.value.movements.push({ id: uid(), item: n.id, date: today(), qty: n.stock, kind: 'in', note: 'Nyitókészlet' })
    return n
  }
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

  return { itemById, typeById, groups, suppliers, alerts, forecast, rows, stockValue, movementsOf, receive, addItem, deleteItemCheck, deleteItem, addType, deleteTypeCheck, deleteType, pkgCost, weekly }
})
