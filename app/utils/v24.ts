// A specifikáció v2.4 üzleti szabályai (tiszta függvények, tesztelhetők):
// – adatpótlás a régebbi böngészős adatokhoz (beosztás, személyzet, rendelők);
// – a kezelés utáni tájékoztató orvosi jóváhagyása a Teendők között, 7 napos lejárattal és Archívummal (10. pont);
// – a „Mai feladat” összefoglaló és az elvégzett tételek jelölése (8. pont);
// – két kezelés összevonása egy időponttá (9. pont, B-011);
// – a Teendők jelvénye (7., 10., 21. pont).
import { addDays, fmtDate, today, uid } from './dates'
import type { Appointment, DB, Patient, PlannedItem, TreatmentRecord } from './types'
import { recordForAppt, typeById } from './logic'
import { conflictGroups } from './conflicts'
import { defaultStaff, DOC_COLORS, emptySchedule, offSchedule } from './schedule'
import { DURS } from './v22'

/** a régebbi (v2.3) böngészős adatok kiegészítése a v2.4 mezőivel – adatvesztés nélkül, minden betöltéskor lefut */
export function ensureV24(db: DB): DB {
  db.staff = db.staff || defaultStaff()
  db.staff.waiting = db.staff.waiting || []
  db.schedule = db.schedule || emptySchedule()
  const s = db.schedule
  s.doctor = s.doctor || {}; s.reception = s.reception || {}; s.overrides = s.overrides || []; s.assistantDays = s.assistantDays || []; s.overrideLog = s.overrideLog || []
  const site = db.sites[0]?.id || 'site-1'
  if (!db.rooms.some(r => r.id === 'room-2') && db.doctors.length > 1) db.rooms.push({ id: 'room-2', siteId: site, name: '2. rendelő' })
  const asz = db.staff.assistants
  db.doctors.forEach((d, i) => {
    if (!d.color) d.color = DOC_COLORS[i % DOC_COLORS.length]
    if (!d.roomId) d.roomId = db.rooms[Math.min(i, db.rooms.length - 1)]?.id
    if (!d.assistantIds) d.assistantIds = asz[i] ? [asz[i]!.id] : []
    if (d.active === undefined) d.active = true
  })
  archiveExpired(db)
  return db
}

/* ---------- 10. pont: jóváhagyásra váró tájékoztatók ---------- */
export const INFO_DAYS = 7
/** a páciens kér-e e-mailes értesítést (és van-e e-mail-címe) */
export const wantsEmail = (p?: Pick<Patient, 'remind' | 'email'> | null) => !!p && !!p.remind?.email && !!p.email?.trim()
export type InfoState = 'none' | 'pending' | 'sent' | 'expired' | 'declined'
export function infoState(r: TreatmentRecord, t0 = today()): InfoState {
  const i = r.patientInfo
  if (!i?.queued) return 'none'
  if (i.status === 'sent') return 'sent'
  if (i.archived) return i.archived
  if (i.deadline && i.deadline < t0) return 'expired'
  return 'pending'
}
/** a lejárt (7 napon túl jóváhagyás nélküli) tájékoztató az Archívumba kerül; nem megy ki, értesítés sem készül */
export function archiveExpired(db: DB, t0 = today()): number {
  let n = 0
  db.records.forEach(r => {
    const i = r.patientInfo
    if (i?.queued && i.status !== 'sent' && !i.archived && i.deadline && i.deadline < t0) {
      i.archived = 'expired'; i.archivedAt = new Date().toISOString(); n++
      i.log = [...(i.log || []), { at: new Date().toISOString(), by: 'rendszer', what: 'lejárt jóváhagyás nélkül – archívumba került, nem került kiküldésre' }]
    }
  })
  return n
}
/** a kezelés mentése után: jóváhagyási feladat csak akkor keletkezik, ha a páciens e-mailes értesítést kér és van e-mail-címe */
export function queueInfo(db: DB, r: TreatmentRecord): boolean {
  const p = db.patients.find(x => x.id === r.patientId)
  if (!r.patientInfo || !wantsEmail(p)) return false
  r.patientInfo.queued = true
  r.patientInfo.deadline = addDays(r.date, INFO_DAYS)
  r.patientInfo.log = [...(r.patientInfo.log || []), { at: new Date().toISOString(), by: 'rendszer', what: 'jóváhagyásra vár (a páciens e-mailes értesítést kér)' }]
  return true
}
export const pendingInfos = (db: DB, doctorId?: string) => db.records.filter(r => infoState(r) === 'pending' && (!doctorId || r.doctorId === doctorId)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
export const archivedInfos = (db: DB, doctorId?: string) => db.records.filter(r => ['sent', 'expired', 'declined'].includes(infoState(r)) && (!doctorId || r.doctorId === doctorId)).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))
export const INFO_ARCH_TEXT: Record<string, string> = { expired: 'nem került kiküldésre – lejárt, jóváhagyás nélkül', declined: 'nem került kiküldésre – az orvos nem tartotta szükségesnek', sent: 'kiküldve' }
/** „Jóváhagyás és küldés”: a tájékoztató e-mailben megy ki (a demóban szimulált); a jóváhagyás ténye naplózott */
export function approveAndSend(db: DB, recordId: string, doctorName: string): boolean {
  const r = db.records.find(x => x.id === recordId), i = r?.patientInfo
  if (!r || !i || infoState(r) !== 'pending') return false
  const now = new Date().toISOString()
  i.status = 'sent'; i.approvedBy = doctorName; i.approvedAt = now; i.sentAt = now; i.channels = ['e-mail']
  i.log = [...(i.log || []), { at: now, by: doctorName, what: `jóváhagyva és e-mailben elküldve${i.edited ? ' (a szöveg módosítva)' : ''}` }]
  return true
}
export function declineInfo(db: DB, recordId: string, by: string, reason: string): boolean {
  const r = db.records.find(x => x.id === recordId), i = r?.patientInfo
  if (!r || !i || infoState(r) !== 'pending') return false
  i.archived = 'declined'; i.archivedAt = new Date().toISOString(); i.declineReason = reason
  i.log = [...(i.log || []), { at: i.archivedAt, by, what: 'nem szükséges' + (reason ? ': ' + reason : '') }]
  return true
}
/** „Visszahozás jóváhagyásra”: nem küld ki semmit, új 7 napos határidőt kap a visszahozás napjától */
export function restoreInfo(db: DB, recordId: string, by: string, t0 = today()): boolean {
  const r = db.records.find(x => x.id === recordId), i = r?.patientInfo
  if (!r || !i || !i.queued || i.status === 'sent' || !(i.archived || infoState(r) === 'expired')) return false
  delete i.archived; delete i.archivedAt; delete i.declineReason
  i.deadline = addDays(t0, INFO_DAYS)
  i.log = [...(i.log || []), { at: new Date().toISOString(), by, what: `visszahozva jóváhagyásra (új határidő: ${fmtDate(i.deadline)})` }]
  return true
}

/* ---------- 8. pont: „Mai feladat” ---------- */
export interface PlanMark { tooth: number | null; typeId: string; label: string; state: 'done' | 'missing' | 'notdone'; note?: string }
/** a tervezett tétel elvégzettnek számít, ha az eredményben azonos művelet szerepel (és ha a terv fogszámot tartalmaz, azonos fogon) */
export function planMarks(db: DB, plan: Pick<PlannedItem, 'tooth' | 'typeId'>[], done: { tooth: number | null; typeId: string }[], notDone: Record<string, string | undefined> = {}): PlanMark[] {
  return plan.map(p => {
    const key = `${p.tooth ?? 0}:${p.typeId}`
    const label = `${typeById(db, p.typeId)?.name || p.typeId}${p.tooth ? ' – ' + p.tooth : ''}`
    if (key in notDone) return { ...p, label, state: 'notdone' as const, note: notDone[key] || '' }
    const ok = done.some(d => d.typeId === p.typeId && (!p.tooth || d.tooth === p.tooth))
    return { ...p, label, state: ok ? 'done' as const : 'missing' as const }
  })
}
/** az előző alkalom „következő lépése”: a legutóbbi lezárt kezelés „Nem történt meg” megjegyzései */
export function previousNextSteps(db: DB, patientId: string, beforeRecordId?: string | null): string[] {
  const recs = db.records.filter(r => r.patientId === patientId && r.id !== beforeRecordId).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))
  const last = recs[0]
  if (!last?.notDone?.length) return []
  return last.notDone.map(n => `${typeById(db, n.typeId)?.name || n.typeId}${n.tooth ? ' (' + n.tooth + ')' : ''}: nem történt meg${n.note ? ' – ' + n.note : ''} (${fmtDate(last.date)})`)
}

/* ---------- 9. pont: összevonás egy időponttá ---------- */
/** a tételek időtartama kezelésenként összeadva (30 perces sávra felkerekítve) */
export function itemsDuration(db: DB, items: Pick<PlannedItem, 'typeId'>[]): number {
  const sum = items.reduce((s, i) => s + (typeById(db, i.typeId)?.dur || 0), 0)
  return sum ? (DURS.find(x => x >= sum) || 300) : 30
}
export interface MergePlan { dur: number; buffer: number; items: PlannedItem[]; typeIds: string[] }
/** összevonás: a kezdés a meglévő időpont kezdése, az időtartam a két kezelés időtartamának összege, a ráhagyás a nagyobbik (nem összeadva) */
export function mergePlan(db: DB, existing: Appointment, add: { items: PlannedItem[]; typeIds: string[]; buffer: number }, doctorId: string): MergePlan {
  const base = existing.items?.length ? existing.items : existing.typeIds.map(t => ({ tooth: null, typeId: t, surfaces: [] }))
  const addItems = add.items.length ? add.items : add.typeIds.map(t => ({ tooth: null, typeId: t, surfaces: [] }))
  const items = [...base, ...addItems].map(i => ({ ...i, surfaces: [...i.surfaces], doctorId }))
  const addDur = itemsDuration(db, addItems)
  const sum = existing.dur + addDur
  return { dur: DURS.find(x => x >= sum) || Math.ceil(sum / 30) * 30, buffer: Math.max(existing.buffer || 0, add.buffer || 0), items, typeIds: [...new Set(items.map(i => i.typeId))] }
}

/* ---------- a Teendők jelvénye ---------- */
export function todoAlerts(db: DB): { total: number; parts: string[] } {
  if (!db) return { total: 0, parts: [] }
  const isDone = (a: Appointment) => !!recordForAppt(db, a.id)
  const conf = conflictGroups(db, { isDone }).filter(g => !g.ok).length
  const infos = pendingInfos(db).length
  const off = offSchedule(db, isDone).length
  const sig = db.appointments.filter(a => a.cancelSignal && a.date >= today() && !isDone(a)).length
  const parts = [conf && `${conf} időpont-ütközés`, infos && `${infos} tájékoztató vár jóváhagyásra`, off && `${off} időpont a beosztáson kívül`, sig && `${sig} lemondást jelzett`].filter(Boolean) as string[]
  return { total: conf + infos + off + sig, parts }
}
export const logAppt = (a: Appointment, by: string, note: string) => { a.log = [...(a.log || []), { at: new Date().toISOString(), by, note }] }
export const newId = uid
