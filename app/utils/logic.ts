// Üzleti szabályok: kezelési csomag, díj, készlet-előrejelzés, meg nem jelenési kockázat, emlékeztetők
import { addDays, dayDiff, fmtDate, fromYmd, norm, toMin, today } from './dates'
import type { Appointment, DB, Item, Order, Patient, Surface, SurfaceMap, TreatmentType } from './types'
import { surfaceCount } from './teeth'

export const HORIZON = 60 // nap – előrejelzési ablak

export const typeById = (db: DB, id: string) => db.types.find(t => t.id === id)
export const itemById = (db: DB, id: string) => db.items.find(i => i.id === id)
export const patientById = (db: DB, id: string) => db.patients.find(p => p.id === id)
export const doctorName = (db: DB, id: string) => db.doctors.find(d => d.id === id)?.name || ''
export const docIdx = (db: DB, id: string) => db.doctors.findIndex(d => d.id === id)
export const typeNames = (db: DB, ids: string[]) => ids.map(id => typeById(db, id)?.name).filter(Boolean).join(', ')
export const recordForAppt = (db: DB, id: string) => db.records.find(r => r.appointmentId === id)

/**
 * kezelési csomag: alkalmanként = a kezelések közti legnagyobb érték,
 * foganként = összeg × fogak száma, felszínenként = összeg × kezelt felszínek száma
 */
export function pkgFor(db: Pick<DB, 'types'>, typeIds: string[], nTeeth: number, nSurf?: number) {
  const visit: Record<string, number> = {}, mult: Record<string, number> = {}
  const nt = Math.max(1, nTeeth), ns = Math.max(1, nSurf ?? nt)
  typeIds.forEach(tid => {
    const t = db.types.find(x => x.id === tid); if (!t) return
    t.mats.forEach(m => {
      if (m.per === 'tooth') mult[m.item] = (mult[m.item] || 0) + m.qty * nt
      else if (m.per === 'surface') mult[m.item] = (mult[m.item] || 0) + m.qty * ns
      else visit[m.item] = Math.max(visit[m.item] || 0, m.qty)
    })
  })
  const out: Record<string, number> = {}
  new Set([...Object.keys(visit), ...Object.keys(mult)]).forEach(k => { out[k] = (visit[k] || 0) + (mult[k] || 0) })
  return out
}

/** díj: tömésnél a fogankénti felszínszám szerint (1 / 2 / 3+), egyébként a kezelés díja */
export function typeFee(t: TreatmentType, teeth: number[], surfaces?: SurfaceMap) {
  if (t.priceBySurf && t.needsSurface) {
    const list = teeth.length ? teeth : [0]
    return list.reduce((s, n) => {
      const c = Math.max(1, surfaces?.[n]?.length || 0)
      return s + t.priceBySurf![Math.min(3, c) - 1]!
    }, 0)
  }
  return t.price || 0
}
export function feeFor(db: DB, typeIds: string[], teeth: number[], surfaces?: SurfaceMap) {
  return typeIds.reduce((s, id) => { const t = typeById(db, id); return s + (t ? typeFee(t, teeth, surfaces) : 0) }, 0)
}
/** egy kezelési tétel díja: tömésnél a felszínek száma (1 / 2 / 3+) szerint, egyébként a művelet díja */
export function itemFee(db: Pick<DB, 'types'>, typeId: string, surfaces: Surface[] = []) {
  const t = db.types.find(x => x.id === typeId); if (!t) return 0
  if (t.priceBySurf && t.needsSurface) return t.priceBySurf[Math.min(3, Math.max(1, surfaces.length)) - 1]!
  return t.price || 0
}
/** kezelési csomag tételenként: alkalmanként = legnagyobb érték, foganként = tételenként, felszínenként = a tétel felszínei (legalább 1) */
export function pkgForItems(db: Pick<DB, 'types'>, items: { tooth: number | null; typeId: string; surfaces: Surface[] }[]) {
  const visit: Record<string, number> = {}, mult: Record<string, number> = {}
  items.forEach(it => {
    const t = db.types.find(x => x.id === it.typeId); if (!t) return
    t.mats.forEach(m => {
      if (m.per === 'tooth') mult[m.item] = (mult[m.item] || 0) + m.qty
      else if (m.per === 'surface') mult[m.item] = (mult[m.item] || 0) + m.qty * Math.max(1, it.surfaces.length)
      else visit[m.item] = Math.max(visit[m.item] || 0, m.qty)
    })
  })
  const out: Record<string, number> = {}
  new Set([...Object.keys(visit), ...Object.keys(mult)]).forEach(k => { out[k] = (visit[k] || 0) + (mult[k] || 0) })
  return out
}
export const apptPrice = (db: DB, a: Appointment) => (a.items?.length ? a.items.reduce((s, i) => s + itemFee(db, i.typeId, i.surfaces), 0) : feeFor(db, a.typeIds, a.planned?.teeth || [], a.planned?.surfaces))

/** a felszínszám a csomaghoz: ha nincs megadva, a fogak száma */
export const surfacesFor = (teeth: number[], surfaces?: SurfaceMap) => {
  const c = surfaceCount(surfaces, teeth)
  return c || Math.max(1, teeth.length)
}

/* ---------- Ráhagyási idő ---------- */
export function bufferFor(db: DB, typeIds: string[], patient?: Patient | null) {
  const tb = Math.max(0, ...typeIds.map(id => typeById(db, id)?.buffer || 0))
  const pb = patient?.needsBuffer ? db.settings.patientBuffer : 0
  return Math.max(tb, pb) // a hosszabb számít, nem adódnak össze
}
export const apptEnd = (a: Pick<Appointment, 'start' | 'dur'>) => toMin(a.start) + a.dur
export const apptBlockEnd = (a: Pick<Appointment, 'start' | 'dur' | 'buffer'>) => toMin(a.start) + a.dur + (a.buffer || 0)

/* ---------- Előrejelzés ---------- */
export function futureAppts(db: DB) {
  const t0 = today(), end = addDays(t0, HORIZON)
  const done = new Set(db.records.map(r => r.appointmentId).filter(Boolean))
  return db.appointments.filter(a => a.date >= t0 && a.date <= end && !done.has(a.id) && a.status !== 'noshow')
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
}
export interface Forecast { planned: number; runOut: string | null; orderBy: string | null; level: 'red' | 'yellow' | 'green'; low: boolean; neg: boolean }
const plannedUse = (db: DB, it: Item, until: string) => futureAppts(db).filter(a => a.date <= until).reduce((s, a) => {
  const nT = a.planned?.teeth.length || 1
  return s + (pkgFor(db, a.typeIds, nT, surfacesFor(a.planned?.teeth || [], a.planned?.surfaces))[it.id] || 0)
}, 0)
/** várható fogyás hetente: az elmúlt 8 hét felhasználása és a következő 8 hét előjegyzett kezeléseinek csomagja alapján (spec v2.1, 10. pont) */
export function weeklyUse(db: DB, it: Item): number {
  const t0 = today(), since = addDays(t0, -56)
  const past = db.movements.filter(m => m.item === it.id && m.kind === 'use' && m.date >= since && m.date <= t0).reduce((s, m) => s + Math.max(0, -m.qty), 0)
  return Math.round(((past + plannedUse(db, it, addDays(t0, 56))) / 16) * 100) / 100
}
/** a biztonsági tartalék mennyiségben (darabban); nincs megadva: 0 */
export function reserveQty(db: DB, it: Item): number {
  const sf = it.safety; if (!sf || !(sf.value > 0)) return 0
  return sf.mode === 'weeks' ? Math.ceil(sf.value * weeklyUse(db, it)) : sf.value
}
export const reserveLabel = (it: Item) => (it.safety && it.safety.value > 0 ? (it.safety.mode === 'weeks' ? `${it.safety.value} hét fogyása` : `${it.safety.value} ${it.unit}`) : '')

export function forecastItem(db: DB, it: Item): Forecast {
  const t0 = today()
  const reserve = reserveQty(db, it)
  const free = it.stock - reserve // a biztonsági tartalék nem számít használhatónak
  let cum = 0, runOut: string | null = null
  if (free <= 0) runOut = t0
  futureAppts(db).forEach(a => {
    const nT = a.planned?.teeth.length || 1
    const q = pkgFor(db, a.typeIds, nT, surfacesFor(a.planned?.teeth || [], a.planned?.surfaces))[it.id] || 0
    if (!q) return
    cum += q
    if (!runOut && cum > free) runOut = a.date
  })
  const orderBy = runOut ? addDays(runOut, -it.lead) : null
  let level: Forecast['level'] = 'green'
  if (orderBy) { const dd = dayDiff(t0, orderBy); level = dd <= 3 ? 'red' : dd <= 7 ? 'yellow' : 'green' }
  const low = it.stock < it.target * 0.1
  return { planned: cum, runOut, orderBy, level, low, neg: it.stock < 0 }
}

/* ---------- Megrendelések követése (spec v2.1, 11. pont) ---------- */
export interface OrderInfo { open: number; expected: string | null; orders: Order[]; state: 'none' | 'ordered' | 'short' | 'late' }
/** nyitott (leadott, még nem teljesen beérkezett) megrendelések egy anyagra, és hogy fedezik-e a várható fogyást */
export function orderInfo(db: DB, it: Item): OrderInfo {
  const orders = db.orders.filter(o => (o.status === 'ordered' || o.status === 'partial') && o.lines.some(l => l.item === it.id))
  const open = orders.reduce((s, o) => s + o.lines.filter(l => l.item === it.id).reduce((a, l) => a + Math.max(0, l.qty - (l.received || 0)), 0), 0)
  if (!open) return { open: 0, expected: null, orders: [], state: 'none' }
  const t0 = today()
  const expected = orders.map(o => o.expected || addDays(o.date, it.lead)).sort()[0]!
  if (expected < t0) return { open, expected, orders, state: 'late' }
  const short = it.stock + open - plannedUse(db, it, addDays(t0, it.lead)) < reserveQty(db, it)
  return { open, expected, orders, state: short ? 'short' : 'ordered' }
}
/** a megrendelendő anyagok: a rendelés leadása után kikerülnek, kivéve ha a mennyiség nem elég, késik a szállítás vagy a készlet mínuszban van */
export const attention = (db: DB) => db.items.filter(it => {
  const f = forecastItem(db, it)
  if (!(f.level === 'red' || f.low || f.neg)) return false
  return f.neg || orderInfo(db, it).state !== 'ordered'
})

/* ---------- Meg nem jelenés kockázata (2.1.2) ---------- */
export function apptStartDate(a: Pick<Appointment, 'date' | 'start'>) {
  const d = fromYmd(a.date), m = toMin(a.start || '10:00'); d.setHours(Math.floor(m / 60), m % 60, 0, 0); return d
}
export function attendanceStats(db: DB, pid: string) {
  const since = addDays(today(), -365), evs = db.events.filter(e => e.patientId === pid)
  const pastAp = db.appointments.filter(x => x.patientId === pid && x.date < today())
  return {
    noshow: evs.filter(e => e.kind === 'noshow' && e.date >= since).length + pastAp.filter(x => x.status === 'noshow' && x.date >= since).length,
    latec: evs.filter(e => e.kind === 'latecancel' && e.date >= since).length,
    late: evs.filter(e => e.kind === 'late' && e.min >= 10 && e.date >= since).length + pastAp.filter(x => (x.late || 0) >= 10 && x.date >= since).length,
    attended: evs.filter(e => e.kind === 'attended').length + db.records.filter(r => r.patientId === pid).length,
  }
}
export interface Risk { p: number; level: 'low' | 'mid' | 'high'; factors: string[] }
export function riskFor(db: DB, a: Pick<Appointment, 'patientId' | 'date' | 'start' | 'created' | 'remind'> & { cancelSignal?: Appointment['cancelSignal'] }): Risk {
  const s = attendanceStats(db, a.patientId), f: string[] = []
  let r = 0.06
  if (s.noshow) { r += 0.22 * s.noshow; f.push(`${s.noshow}× nem jelent meg az elmúlt 12 hónapban`) }
  if (s.latec) { r += 0.10 * s.latec; f.push(`${s.latec}× 24 órán belül mondta le`) }
  if (s.late) { r += 0.05 * s.late; f.push(`${s.late}× legalább 10 percet késett`) }
  if (!s.attended) { r += 0.08; f.push('új páciens, még nincs előzménye') }
  else if (s.attended >= 4 && !s.noshow && !s.latec) { r -= 0.03; f.push(`${s.attended} korábbi megjelenés, megbízható`) }
  const lead = dayDiff(a.created || today(), a.date)
  if (lead > 21) { r += 0.05; f.push(`${lead} nappal előre foglalt`) }
  const rem = a.remind || { sms: false, email: false }
  if (!rem.sms && !rem.email) { r += 0.06; f.push('nem kér emlékeztetőt') }
  if (a.cancelSignal) { r = Math.max(r, 0.85); f.push('„NEM” választ küldött az emlékeztetőre') }
  r = Math.max(0.03, Math.min(0.9, r))
  return { p: r, level: r >= 0.3 ? 'high' : r >= 0.15 ? 'mid' : 'low', factors: f }
}
/** többször késett az elmúlt 12 hónapban → a program felajánlja a „ráhagyást igényel” jelölést */
export const suggestBufferFlag = (db: DB, p: Patient) => !p.needsBuffer && attendanceStats(db, p.id).late >= 2

/* ---------- Emlékeztetők ---------- */
export interface RemindInfo { ch: string[]; send?: Date; second?: boolean; status: 'none' | 'cancelled' | 'sent' | 'scheduled'; label: string; cls: string }
export function remindInfo(a: Appointment): RemindInfo {
  const rem = a.remind || { sms: false, email: false }, ch = [rem.sms && 'SMS', rem.email && 'e-mail'].filter(Boolean) as string[]
  if (!ch.length) return { ch, status: 'none', label: 'Nem kér', cls: 'b-gray' }
  const send = new Date(apptStartDate(a).getTime() - (rem.timing === '48' ? 48 : 24) * 3600000)
  const second = rem.timing === '24+2'
  if (a.cancelSignal) return { ch, send, second, status: 'cancelled', label: 'Lemondást jelzett', cls: 'b-red' }
  if (a.sentAt) return { ch, send, second, status: 'sent', label: 'Emlékeztető kiküldve (demó)', cls: 'b-blue' }
  if (send <= new Date()) return { ch, send, second, status: 'sent', label: 'Emlékeztető kiküldve (szimulált)', cls: 'b-blue' }
  return { ch, send, second, status: 'scheduled', label: 'Ütemezve', cls: 'b-gray' }
}
export function fillTpl(db: DB, t: string, a: Pick<Appointment, 'patientId' | 'date' | 'start' | 'doctorId' | 'typeIds'>) {
  const p = patientById(db, a.patientId), st = db.settings
  const map: Record<string, string> = { 'név': p?.name || '', 'dátum': fmtDate(a.date), 'idő': a.start, 'orvos': doctorName(db, a.doctorId), 'kezelés': typeNames(db, a.typeIds), 'klinika': st.clinic, 'cím': st.address, 'telefon': st.phone }
  return String(t || '').replace(/\{([^}]+)\}/g, (m, k) => (map[k] !== undefined ? map[k]! : m))
}

/* ---------- Gyors betegösszefoglaló segédei ---------- */
export function firstSentence(t: string) { const m = String(t || '').match(/^[^.!?]+[.!?]?/); return m ? m[0].trim() : '' }
export function extractTodo(t: string) {
  const ss = String(t || '').split(/(?<=[.!?])\s+/)
  return ss.find(x => /(kontroll|javasolt|visszarendel|ellenőrz|múlva|következő alkalom|teendő)/i.test(x) && !/^éves állapotfelmérés/i.test(x)) || ''
}

/* ---------- Válasz az időpont-emlékeztetőre (spec v2.1, 9. pont) ---------- */
const lev1 = (a: string, b: string) => {
  if (a === b) return true
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0, j = 0, d = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue }
    if (++d > 1) return false
    if (a.length > b.length) i++; else if (a.length < b.length) j++; else { i++; j++ }
  }
  return d + (a.length - i) + (b.length - j) <= 1
}
/** „NEM” válasz felismerése: kis- és nagybetűtől, ékezettől és kisebb eltérésektől független („nem”, „Nem tudok jönni”, „nem jövök”, „nemm”) */
export function isCancelReply(text: string): boolean {
  const t = norm(text).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!t) return false
  const toks = t.split(' ')
  if (toks[0]!.length <= 4 && lev1(toks[0]!, 'nem')) return true
  return /(^| )(nem (tudok|tudunk|jovok|jovunk|megyek|megyunk|fogok)|lemond|sajnos nem|nem leszek)/.test(t)
}
