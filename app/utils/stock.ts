// Raktári könyvelés (spec v2.0, 2.3.3–2.3.5): gördülő súlyozott átlagár, gyártási tételek (LOT) lejárat szerinti
// kiadása, lejáró tételek, rendelési javaslat, LOT-keresés (visszahívás). Tiszta függvények, a store-ok és a seed is ezt használja.
import { addDays, dayDiff, today, uid } from './dates'
import type { DB, Item, Lot, LotUse, Movement } from './types'
import { forecastItem, futureAppts, orderInfo, pkgFor, reserveQty, surfacesFor } from './logic'

const r2 = (n: number) => Math.round(n * 100) / 100

/**
 * gördülő súlyozott átlagár: (meglévő készlet × régi átlagár + új mennyiség × új ár) ÷ teljes mennyiség.
 * Negatív (eltérésben lévő) készletnél a meglévő mennyiség 0-nak számít.
 */
export function weightedAvg(stock: number, avg: number, qty: number, unitPrice: number) {
  const s = Math.max(0, stock)
  if (s + qty <= 0) return r2(unitPrice)
  return r2((s * (avg || 0) + qty * unitPrice) / (s + qty))
}

export interface ReceiveInput { qty: number; unitPrice: number; date?: string; lot?: string; expiry?: string; note?: string }

/** bevételezés: készlet, átlagár, LOT és mozgásnapló */
export function receiveStock(db: DB, it: Item, inp: ReceiveInput): Movement {
  const date = inp.date || today()
  const price = Math.max(0, Number(inp.unitPrice) || 0)
  it.price = weightedAvg(it.stock, it.price, inp.qty, price)
  it.lastPrice = price
  it.stock += inp.qty
  const lot = (inp.lot || '').trim()
  if (lot) {
    const ex = db.lots.find(l => l.item === it.id && l.lot === lot && l.expiry === (inp.expiry || ''))
    if (ex) ex.qty += inp.qty
    else db.lots.push({ id: uid(), item: it.id, lot, expiry: inp.expiry || '', qty: inp.qty, received: date, unitPrice: price })
  }
  const m: Movement = { id: uid(), item: it.id, date, qty: inp.qty, kind: 'in', note: inp.note || 'Bevételezés', unitPrice: price, avgAfter: it.price, lot: lot || undefined, expiry: inp.expiry || undefined }
  db.movements.push(m)
  return m
}

/** a tétel tételei kiadási sorrendben: ami előbb jár le, az fogy előbb (FEFO) */
export const lotsOf = (db: Pick<DB, 'lots'>, itemId: string) =>
  db.lots.filter(l => l.item === itemId && l.qty > 0).sort((a, b) => (a.expiry || '9999').localeCompare(b.expiry || '9999') || a.received.localeCompare(b.received))

/** melyik tételekből fogyna a mennyiség (előnézet, nem módosít) */
export function previewLots(db: Pick<DB, 'lots'>, itemId: string, qty: number): LotUse[] {
  const out: LotUse[] = []
  let left = qty
  for (const l of lotsOf(db, itemId)) {
    if (left <= 0) break
    const q = Math.min(l.qty, left)
    out.push({ lot: l.lot, expiry: l.expiry, qty: q }); left -= q
  }
  return out
}

/** kiadás (felhasználás): a készlet csökken, a LOT-ok lejárat szerint fogynak */
export function consumeStock(db: DB, it: Item, qty: number): LotUse[] {
  const used = previewLots(db, it.id, qty)
  used.forEach(u => { const l = db.lots.find(x => x.item === it.id && x.lot === u.lot && x.expiry === u.expiry && x.qty > 0); if (l) l.qty -= u.qty })
  db.lots = db.lots.filter(l => l.qty > 0)
  it.stock -= qty
  return used
}

/** visszavét (utólagos módosításkor csökkent a felhasznált mennyiség): a legkorábban lejáró tételhez kerül vissza */
export function returnStock(db: DB, it: Item, qty: number, lots?: LotUse[]) {
  it.stock += qty
  let left = qty
  for (const u of (lots || []).slice().reverse()) {
    if (left <= 0) break
    const q = Math.min(u.qty, left)
    const l = db.lots.find(x => x.item === it.id && x.lot === u.lot && x.expiry === u.expiry)
    if (l) l.qty += q
    else db.lots.push({ id: uid(), item: it.id, lot: u.lot, expiry: u.expiry, qty: q, received: today(), unitPrice: it.price })
    left -= q
  }
}

/** a LOT nélküli maradék (a régi, tétel nélkül bevételezett készlet) */
export const untrackedQty = (db: Pick<DB, 'lots'>, it: Item) => Math.max(0, it.stock - lotsOf(db, it.id).reduce((s, l) => s + l.qty, 0))

/* ---------- lejárat ---------- */
export interface ExpiryRow { lot: Lot; item: Item; days: number; level: 'red' | 'yellow' | 'green' }
export function expiryRows(db: DB, within = 90): ExpiryRow[] {
  const t0 = today()
  return db.lots.filter(l => l.qty > 0 && l.expiry).map(l => {
    const item = db.items.find(i => i.id === l.item)!
    const days = dayDiff(t0, l.expiry)
    return { lot: l, item, days, level: (days < 0 ? 'red' : days <= 30 ? 'red' : days <= 60 ? 'yellow' : 'green') as ExpiryRow['level'] }
  }).filter(r => r.item && r.days <= within).sort((a, b) => a.days - b.days)
}

/* ---------- rendelési javaslat ---------- */
export interface Suggestion { item: Item; qty: number; reason: string; orderBy: string | null; level: 'red' | 'yellow' | 'green'; onOrder: number }
/**
 * Javasolt rendelés: ami a beszerzési időn belül elfogyhat, 10% alá esett vagy negatív.
 * Mennyiség = célkészlet − (készlet − a beszállításig várható fogyás) − már megrendelt mennyiség.
 */
export function orderSuggestions(db: DB): Suggestion[] {
  const t0 = today()
  const onOrder = (id: string) => db.orders.filter(o => o.status === 'ordered' || o.status === 'partial').reduce((s, o) => s + o.lines.filter(l => l.item === id).reduce((a, l) => a + Math.max(0, l.qty - (l.received || 0)), 0), 0)
  const out: Suggestion[] = []
  db.items.forEach(it => {
    const f = forecastItem(db, it)
    const oi = orderInfo(db, it)
    // a leadott megrendelés után az anyag kikerül a javaslatból – kivéve, ha a mennyiség nem elég vagy késik a szállítás (11. pont)
    if (oi.state === 'ordered') return
    const need = f.level !== 'green' || f.low || f.neg || oi.state === 'short' || oi.state === 'late'
    if (!need) return
    const until = addDays(t0, it.lead)
    let leadUse = 0
    futureAppts(db).filter(a => a.date <= until).forEach(a => {
      leadUse += pkgFor(db, a.typeIds, a.planned?.teeth.length || 1, surfacesFor(a.planned?.teeth || [], a.planned?.surfaces))[it.id] || 0
    })
    const ord = onOrder(it.id)
    let qty = Math.max(0, Math.ceil(it.target - (it.stock - leadUse) - ord))
    if (!qty && (oi.state === 'short' || oi.state === 'late')) qty = Math.max(1, Math.ceil(reserveQty(db, it) - (it.stock + ord - leadUse)))
    if (!qty) return
    const reason = oi.state === 'short' ? 'Megrendelve, de a mennyiség nem fedezi a várható fogyást – újabb megrendelés szükséges lehet'
      : oi.state === 'late' ? `Késik a szállítás (várható beérkezés: ${oi.expected})`
      : f.neg ? 'a készlet mínuszban van' : f.low ? 'a készlet a célkészlet 10%-a alatt van' : `várhatóan elfogy: ${f.runOut}`
    out.push({ item: it, qty, reason, orderBy: f.orderBy, level: f.neg || f.low || oi.state !== 'none' ? 'red' : f.level, onOrder: ord })
  })
  return out.sort((a, b) => (a.item.supplier || '').localeCompare(b.item.supplier || '', 'hu') || (a.orderBy || '9999').localeCompare(b.orderBy || '9999'))
}

/* ---------- LOT-keresés: kiknél használták fel (visszahívás) ---------- */
export interface LotHit { recordId: string; patientId: string; date: string; item: Item; lot: string; expiry: string; qty: number; teeth: number[] }
export function lotSearch(db: DB, q: string): LotHit[] {
  const s = q.trim().toLowerCase()
  if (s.length < 2) return []
  const out: LotHit[] = []
  db.records.forEach(r => r.materials.forEach(m => (m.lots || []).forEach(u => {
    if (!u.lot.toLowerCase().includes(s)) return
    const item = db.items.find(i => i.id === m.item); if (!item) return
    out.push({ recordId: r.id, patientId: r.patientId, date: r.date, item, lot: u.lot, expiry: u.expiry, qty: u.qty, teeth: r.teeth })
  })))
  return out.sort((a, b) => b.date.localeCompare(a.date))
}

/** a páciensbe került implantátumok és nyomon követett anyagok */
export function tracedFor(db: DB, pid: string, implantOnly = false) {
  const out: { date: string; item: Item; lot: string; expiry: string; qty: number; teeth: number[]; recordId: string }[] = []
  db.records.filter(r => r.patientId === pid).forEach(r => r.materials.forEach(m => {
    const item = db.items.find(i => i.id === m.item)
    if (!item || (implantOnly && !item.implant) || !m.lots?.length) return
    m.lots.forEach(u => out.push({ date: r.date, item, lot: u.lot, expiry: u.expiry, qty: u.qty, teeth: r.teeth, recordId: r.id }))
  }))
  return out.sort((a, b) => b.date.localeCompare(a.date))
}

/** a kezelés anyagköltsége átlagáron */
export const materialCost = (db: DB, mats: { item: string; qty: number }[]) =>
  mats.reduce((s, m) => s + m.qty * (db.items.find(i => i.id === m.item)?.price || 0), 0)

/** a bevételezett mennyiség a megrendeléshez rendelhető: teljes beérkezésnél a megrendelés automatikusan lezárul, részlegesnél nyitva marad */
export function applyReceiptToOrder(db: DB, orderId: string, itemId: string, qty: number, date = today()) {
  const o = db.orders.find(x => x.id === orderId); if (!o) return null
  const line = o.lines.find(l => l.item === itemId); if (!line) return null
  line.received = (line.received || 0) + qty
  if (o.lines.every(l => (l.received || 0) >= l.qty)) { o.status = 'received'; o.receivedDate = date } else o.status = 'partial'
  return o
}

/** megrendelés állapotok: címke és jelvény-osztály */
export const ORDER_ST: Record<string, [string, string]> = {
  ordered: ['megrendelve – beérkezésre vár', 'b-blue'], partial: ['részben beérkezett', 'b-yellow'], received: ['beérkezett, lezárva', 'b-green'],
  closed: ['kézzel lezárva', 'b-gray'], cancelled: ['visszavonva', 'b-gray'],
}
