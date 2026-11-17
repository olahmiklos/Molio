// Üzleti szabályok: kezelési csomag, díj, készlet-előrejelzés, meg nem jelenési kockázat, emlékeztetők
import { addDays, dayDiff, fmtDate, fromYmd, toMin, today } from './dates'
import type { Appointment, DB, Item, Patient, SurfaceMap, TreatmentType } from './types'
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
export const apptPrice = (db: DB, a: Appointment) => feeFor(db, a.typeIds, a.planned?.teeth || [], a.planned?.surfaces)

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
export function forecastItem(db: DB, it: Item): Forecast {
  const t0 = today()
  let cum = 0, runOut: string | null = null
  if (it.stock <= 0) runOut = t0
  futureAppts(db).forEach(a => {
    const nT = a.planned?.teeth.length || 1
    const q = pkgFor(db, a.typeIds, nT, surfacesFor(a.planned?.teeth || [], a.planned?.surfaces))[it.id] || 0
    if (!q) return
    cum += q
    if (!runOut && cum > it.stock) runOut = a.date
  })
  const orderBy = runOut ? addDays(runOut, -it.lead) : null
  let level: Forecast['level'] = 'green'
  if (orderBy) { const dd = dayDiff(t0, orderBy); level = dd <= 3 ? 'red' : dd <= 7 ? 'yellow' : 'green' }
  const low = it.stock < it.target * 0.1
  return { planned: cum, runOut, orderBy, level, low, neg: it.stock < 0 }
}
export const attention = (db: DB) => db.items.filter(it => { const f = forecastItem(db, it); return f.level === 'red' || f.low || f.neg })

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
export function riskFor(db: DB, a: Pick<Appointment, 'patientId' | 'date' | 'start' | 'created' | 'remind' | 'confirmed'>): Risk {
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
  if (a.confirmed) { r *= 0.4; f.push('visszaigazolta az időpontot') }
  r = Math.max(0.03, Math.min(0.9, r))
  return { p: r, level: r >= 0.3 ? 'high' : r >= 0.15 ? 'mid' : 'low', factors: f }
}
/** többször késett az elmúlt 12 hónapban → a program felajánlja a „ráhagyást igényel” jelölést */
export const suggestBufferFlag = (db: DB, p: Patient) => !p.needsBuffer && attendanceStats(db, p.id).late >= 2

/* ---------- Emlékeztetők ---------- */
export interface RemindInfo { ch: string[]; send?: Date; second?: boolean; status: 'none' | 'confirmed' | 'sent' | 'scheduled'; label: string; cls: string }
export function remindInfo(a: Appointment): RemindInfo {
  const rem = a.remind || { sms: false, email: false }, ch = [rem.sms && 'SMS', rem.email && 'e-mail'].filter(Boolean) as string[]
  if (!ch.length) return { ch, status: 'none', label: 'Nem kér', cls: 'b-gray' }
  const send = new Date(apptStartDate(a).getTime() - (rem.timing === '48' ? 48 : 24) * 3600000)
  const second = rem.timing === '24+2'
  if (a.confirmed) return { ch, send, second, status: 'confirmed', label: 'Visszaigazolva', cls: 'b-green' }
  if (a.sentAt) return { ch, send, second, status: 'sent', label: 'Elküldve (demó)', cls: 'b-blue' }
  if (send <= new Date()) return { ch, send, second, status: 'sent', label: 'Elküldve (szimulált)', cls: 'b-blue' }
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
