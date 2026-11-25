// Beosztás (spec v2.4 21. pont): orvosok, asszisztensek, recepciósok heti sablonja és napi eltérései; a foglalás a beosztáshoz kötve.
// Tiszta függvények (tesztelhetők). Alapbeállítás: az orvos kedd–péntek 10:00–20:00 rendel; hétfő, szombat, vasárnap szabad nap.
import { addDays, DAYS, dow, fromMin, toMin, today } from './dates'
import type { Appointment, DB, Period, Schedule, Staff, WeekTpl } from './types'

export const DEFAULT_PERIOD: Period = ['10:00', '20:00']
/** az új orvosnál előre kitöltött heti sablon */
export const defaultDoctorTpl = (): WeekTpl => ({ 1: [], 2: [[...DEFAULT_PERIOD]], 3: [[...DEFAULT_PERIOD]], 4: [[...DEFAULT_PERIOD]], 5: [[...DEFAULT_PERIOD]], 6: [], 7: [] })
export const defaultReceptionTpl = (): WeekTpl => defaultDoctorTpl()
export const emptySchedule = (): Schedule => ({ doctor: {}, reception: {}, overrides: [], assistantDays: [], overrideLog: [] })
export const defaultStaff = (): Staff => ({
  assistants: [{ id: 'asz-kata', name: 'Kovács Kata', active: true }, { id: 'asz-reka', name: 'Fehér Réka', active: true }],
  receptionists: [{ id: 'rec-anna', name: 'Bodnár Anna', active: true }],
  waiting: [{ id: 'w-1', name: '1. váró' }],
})
/** pasztell színek a beosztáshoz és a naptárhoz */
export const PASTEL = ['#9fd8b4', '#f6b3cf', '#b9d7f2', '#ffd59e', '#cdb8f0', '#a8e3dd', '#f4c7a1', '#d6e6a3']
export const DOC_COLORS = ['#3fa463', '#ec2f7b', '#2a8ccc', '#f5891f', '#8b4fe0', '#13b0a5']

/** a 30 perces rács időpontjai (06:00–22:00) a beosztás-szerkesztőhöz */
export const GRID = Array.from({ length: 33 }, (_, i) => fromMin(6 * 60 + i * 30))

const sched = (db: DB) => db.schedule || emptySchedule()
export const doctorTpl = (db: DB, docId: string): WeekTpl => sched(db).doctor[docId] || defaultDoctorTpl()
export const receptionTpl = (db: DB, recId: string): WeekTpl => sched(db).reception[recId] || defaultReceptionTpl()

/** az adott személy időszakai egy napon: a napi eltérés a sablon helyett érvényes */
export function periodsOn(db: DB, kind: 'doctor' | 'reception', personId: string, date: string): Period[] {
  const o = sched(db).overrides.find(x => x.kind === kind && x.personId === personId && x.date === date)
  if (o) return o.periods
  const tpl = kind === 'doctor' ? doctorTpl(db, personId) : receptionTpl(db, personId)
  return tpl[String(dow(date))] || []
}
export const hasOverride = (db: DB, kind: 'doctor' | 'reception' | 'assistant', personId: string, date: string) => sched(db).overrides.some(x => x.kind === kind && x.personId === personId && x.date === date)
/** rendel-e az orvos a beosztás szerint a teljes időtartam alatt (kezelés + ráhagyás egy időszakon belül) */
export function isWorking(db: DB, doctorId: string, date: string, start: string, total: number): boolean {
  const s = toMin(start), e = s + Math.max(1, total)
  return periodsOn(db, 'doctor', doctorId, date).some(([a, b]) => toMin(a) <= s && e <= toMin(b))
}
/** a naptár egy 30 perces sávja rendelési időbe esik-e (a csíkozott, nem foglalható sávhoz) */
export const slotWorking = (db: DB, doctorId: string, date: string, m: number) => periodsOn(db, 'doctor', doctorId, date).some(([a, b]) => toMin(a) <= m && m + 30 <= toMin(b))
export const periodsText = (p: Period[]) => (p.length ? p.map(([a, b]) => `${a}–${b}`).join(', ') : 'nincs rendelés')
/** „kedd–péntek 10:00–20:00” jellegű összefoglaló a heti sablonról */
export function weekText(tpl: WeekTpl): string {
  const groups: { from: number; to: number; txt: string }[] = []
  for (let d = 1; d <= 7; d++) {
    const txt = (tpl[String(d)] || []).length ? periodsText(tpl[String(d)]!) : ''
    const last = groups[groups.length - 1]
    if (txt && last && last.txt === txt && last.to === d - 1) last.to = d
    else if (txt) groups.push({ from: d, to: d, txt })
  }
  if (!groups.length) return 'nincs rendelési idő'
  return groups.map(g => `${DAYS[g.from - 1]}${g.to > g.from ? '–' + DAYS[g.to - 1] : ''} ${g.txt}`).join('; ')
}
/** tiltáskor a szavas magyarázat: „Dr. … ezen a napon nem rendel – a beosztás: …” */
export function notWorkingText(db: DB, doctorId: string, date: string): string {
  const name = db.doctors.find(d => d.id === doctorId)?.name || 'Az orvos'
  const p = periodsOn(db, 'doctor', doctorId, date)
  return p.length ? `${name} ebben az időszakban nem rendel – a beosztás ezen a napon: ${periodsText(p)}` : `${name} ezen a napon nem rendel – a beosztás: ${weekText(doctorTpl(db, doctorId))}`
}
/** a legközelebbi rendelési idő az orvosnál (szabad helytől függetlenül): [dátum, kezdés] */
export function nextWorkingStart(db: DB, doctorId: string, fromDate: string, total: number, days = 60): [string, string] | null {
  for (let i = 0; i <= days; i++) {
    const d = addDays(fromDate, i)
    for (const [a, b] of periodsOn(db, 'doctor', doctorId, d)) if (toMin(a) + total <= toMin(b)) return [d, a]
  }
  return null
}
/** a beosztáson kívülre eső, még el nem végzett jövőbeli időpontok (sürgős felülbírálás nélkül) – Teendő: „Időpont a beosztáson kívül” */
export function offSchedule(db: DB, isDone: (a: Appointment) => boolean): Appointment[] {
  const t0 = today()
  return db.appointments.filter(a => a.date >= t0 && !a.urgent && a.status !== 'noshow' && !isDone(a) && !isWorking(db, a.doctorId, a.date, a.start, a.dur + (a.buffer || 0)))
}
/** a beosztás módosítása előtt: hány meglévő jövőbeli időpont kerülne a beosztáson kívülre (a módosítás próbaképpen alkalmazva) */
export function affectedBy(db: DB, apply: (s: Schedule) => void, isDone: (a: Appointment) => boolean): Appointment[] {
  const before = new Set(offSchedule(db, isDone).map(a => a.id))
  const copy: Schedule = JSON.parse(JSON.stringify(sched(db)))
  apply(copy)
  const tmp = { ...db, schedule: copy } as DB
  return offSchedule(tmp, isDone).filter(a => !before.has(a.id))
}
/** az asszisztensek napi beosztása: a kifejezett napi beosztás, különben az orvoshoz rendelt asszisztens az orvos rendelési idejében */
export function assistantsOn(db: DB, date: string): { assistantId: string; doctorId: string; periods: Period[]; explicit: boolean }[] {
  const s = sched(db), out: { assistantId: string; doctorId: string; periods: Period[]; explicit: boolean }[] = []
  const explicit = s.assistantDays.filter(x => x.date === date)
  explicit.forEach(x => out.push({ ...x, explicit: true }))
  db.doctors.filter(d => d.active !== false).forEach(d => {
    if (explicit.some(x => x.doctorId === d.id)) return
    const p = periodsOn(db, 'doctor', d.id, date)
    if (!p.length) return
    ;(d.assistantIds || []).forEach(aid => { if (!explicit.some(x => x.assistantId === aid)) out.push({ assistantId: aid, doctorId: d.id, periods: p, explicit: false }) })
  })
  return out
}
const overlapP = (a: Period[], b: Period[]) => a.some(([s1, e1]) => b.some(([s2, e2]) => toMin(s1) < toMin(e2) && toMin(s2) < toMin(e1)))
/** egy asszisztens nem lehet egyszerre két helyen: az átfedő napi beosztások (figyelmeztetés, nem tiltás) */
export function assistantClashes(db: DB, date: string): string[] {
  const list = assistantsOn(db, date), out: string[] = []
  list.forEach((x, i) => list.slice(i + 1).forEach(y => { if (x.assistantId === y.assistantId && x.doctorId !== y.doctorId && overlapP(x.periods, y.periods)) out.push(x.assistantId) }))
  return [...new Set(out)]
}
/** recepció lefedettsége: a rendelési időszakok azon részei, amikor senki nem ül a pultnál */
export function receptionGaps(db: DB, date: string): Period[] {
  const docs = db.doctors.filter(d => d.active !== false).flatMap(d => periodsOn(db, 'doctor', d.id, date))
  const rec = (db.staff?.receptionists || []).filter(r => r.active).flatMap(r => periodsOn(db, 'reception', r.id, date))
  const gaps: Period[] = []
  for (let m = 6 * 60; m < 22 * 60; m += 30) {
    const open = docs.some(([a, b]) => toMin(a) <= m && m + 30 <= toMin(b))
    const cov = rec.some(([a, b]) => toMin(a) <= m && m + 30 <= toMin(b))
    if (open && !cov) { const last = gaps[gaps.length - 1]; if (last && toMin(last[1]) === m) last[1] = fromMin(m + 30); else gaps.push([fromMin(m), fromMin(m + 30)]) }
  }
  return gaps
}
/** a naptár megjelenítési tartománya: a beállított első és utolsó sáv, a beosztások szélső értékeivel bővítve */
export function displayRange(db: DB): [number, number] {
  let s = db.settings.startHour * 60, e = db.settings.endHour * 60
  const tpls = [...db.doctors.map(d => doctorTpl(db, d.id))]
  tpls.forEach(t => Object.values(t).forEach(ps => ps.forEach(([a, b]) => { s = Math.min(s, toMin(a)); e = Math.max(e, toMin(b)) })))
  return [Math.floor(s / 30) * 30, Math.ceil(e / 30) * 30]
}
