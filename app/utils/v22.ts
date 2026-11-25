// A specifikáció v2.2 üzleti szabályai: a páciens időpontjainak ellenőrzése, javasolt tételek forrása és ütemezése,
// tájékoztató üzenet, egységes Teendők lista, diktálási piszkozat (tiszta függvények, tesztelhetők)
import { addDays, dayDiff, fmtDate, toMin, today } from './dates'
import type { Appointment, DB, InformLog, PlannedItem, Suggestion } from './types'
import { bufferFor, doctorName, recordForAppt, typeById, typeNames } from './logic'
import { isOpenSuggestion, isOverdue, isPendingSuggestion, needsFollowUp, sugFee, URGENCY } from './suggest'
import { recallRows } from './office'
import { OLD_SUGGEST_TPL, SUGGEST_TPL } from './defaults'
import { conflictGroups, conflictUrgency } from './conflicts'
import { notWorkingText, offSchedule } from './schedule'

export const DURS = [30, 60, 90, 120, 150, 180, 210, 240, 300]
export const DELETE_RESTORE_DAYS = 30
export const DRAFT_DAYS = 7
export const NEAR_DAYS = 7

/* ---------- 1. pont: a páciens meglévő jövőbeli időpontjai ---------- */
/** a páciens jövőbeli, még nem rögzített, nem elmaradt időpontjai (legközelebbi elöl) */
export function patientFuture(db: DB, pid: string, excludeId?: string | null): Appointment[] {
  const t0 = today()
  return db.appointments
    .filter(a => a.patientId === pid && a.id !== excludeId && a.date >= t0 && !recordForAppt(db, a.id) && a.status !== 'noshow')
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
}
export interface PatientDayCheck {
  /** a páciens következő (másik) időpontja */
  next?: Appointment
  /** azonos napi másik időpont(ok) – az orvos naptárától függetlenül */
  same: Appointment[]
  /** időben átfedő másik időpont (a páciensnél) */
  overlap?: Appointment
  /** nem azonos napi, de az új időponttól számított 7 napon belüli időpontok */
  near: Appointment[]
  /** minden más jövőbeli időpont */
  all: Appointment[]
}
export function patientDayCheck(db: DB, pid: string | null, date: string, start: string, dur: number, excludeId?: string | null): PatientDayCheck {
  if (!pid || !date) return { same: [], near: [], all: [] }
  const all = patientFuture(db, pid, excludeId)
  const s = toMin(start || '00:00'), e = s + (dur || 30)
  const same = all.filter(a => a.date === date)
  const overlap = same.find(a => !(e <= toMin(a.start) || toMin(a.start) + a.dur <= s))
  const near = all.filter(a => a.date !== date && Math.abs(dayDiff(date, a.date)) <= NEAR_DAYS)
  return { next: all[0], same, overlap, near, all }
}
/** a páciensnek ugyanazon a napon több foglalása van (naptári jelölés) */
export function multiOnDay(db: DB, a: Pick<Appointment, 'id' | 'patientId' | 'date'>): boolean {
  return db.appointments.some(b => b.id !== a.id && b.patientId === a.patientId && b.date === a.date)
}

/* ---------- 6–7. pont: javasolt tételek ---------- */
export const performerOf = (db: DB, s: Suggestion): string | null =>
  s.performerId || db.patients.find(p => p.id === s.patientId)?.doctorId || s.doctorId || null

export function itemFromSuggestion(db: DB, s: Suggestion): PlannedItem {
  return { tooth: s.tooth, typeId: s.typeId, surfaces: [...s.surfaces], suggestionId: s.id, doctorId: performerOf(db, s) }
}
/** a páciens ütemezhető javasolt tételei: nyitott vagy elhalasztott + az adott időponthoz már kötöttek */
export function schedulable(db: DB, pid: string, apptId?: string | null): Suggestion[] {
  return db.suggestions
    .filter(s => s.patientId === pid && (isPendingSuggestion(s) || (!!apptId && s.status === 'booked' && s.appointmentId === apptId)))
    .sort((a, b) => URGENCY[a.urgency].rank - URGENCY[b.urgency].rank || (a.due || '9999').localeCompare(b.due || '9999'))
}
/** „3 tételből 2 ütemezve”: a páciens összes élő javaslata (ütemezett + nyitott) */
export function scheduleRatio(db: DB, pid: string): { total: number; scheduled: number; open: Suggestion[] } {
  const live = db.suggestions.filter(s => s.patientId === pid && (isPendingSuggestion(s) || (s.status === 'booked' && !!s.appointmentId && db.appointments.some(a => a.id === s.appointmentId))))
  const scheduled = live.filter(s => s.status === 'booked').length
  return { total: live.length, scheduled, open: live.filter(s => s.status !== 'booked') }
}
/** a javasolt tétel forrásai időrendben: az eredeti vizit és az „újra megerősítve” bejegyzések */
export interface SugSource { date: string; recordId: string | null; label: string; doctor: string; again: boolean }
export function sugSources(db: DB, s: Suggestion): SugSource[] {
  const label = (rid: string | null) => {
    const r = rid ? db.records.find(x => x.id === rid) : null
    return r ? (typeNames(db, r.typeIds) || 'Kezelés') : 'Kezelés'
  }
  const rec0 = s.recordId ? db.records.find(x => x.id === s.recordId) : null
  const first: SugSource = { date: rec0?.date || s.createdAt, recordId: s.recordId, label: label(s.recordId), doctor: doctorName(db, rec0?.doctorId || s.doctorId), again: false }
  const more = (s.confirms || []).map(c => ({ date: c.date, recordId: c.recordId, label: label(c.recordId), doctor: doctorName(db, c.doctorId), again: true }))
  return [first, ...more].sort((a, b) => a.date.localeCompare(b.date))
}
/** „Állapotfelmérésen javasolva, 2026. nov. 19.” */
export function sugSourceText(db: DB, s: Suggestion): string {
  const src = sugSources(db, s)
  const f = src[0]!
  const txt = `${f.label} alkalmán javasolva, ${fmtDate(f.date)}${f.doctor ? ' (' + f.doctor + ')' : ''}`
  return src.length > 1 ? `${txt}; újra megerősítve: ${src.slice(1).map(x => fmtDate(x.date)).join(', ')}` : txt
}
/** a vizit „Ezen az alkalmon javasolt további kezelések” blokkja: állapot és ütemezés */
export function sugsOfRecord(db: DB, recordId: string): { s: Suggestion; where: string }[] {
  return db.suggestions.filter(s => s.recordId === recordId || (s.confirms || []).some(c => c.recordId === recordId)).map(s => {
    const a = s.appointmentId ? db.appointments.find(x => x.id === s.appointmentId) : null
    const where = s.status === 'booked' && a ? `időpont foglalva: ${fmtDate(a.date)} ${a.start}`
      : s.status === 'done' ? 'elvégezve' : s.status === 'declined' ? 'a páciens elutasította' : s.status === 'dropped' ? 'elvetve'
        : s.status === 'postponed' ? 'a páciens elhalasztotta' : 'még nincs időpont'
    return { s, where }
  })
}

/** az időpont adatainak újraszámolása a tételekből (típusok, tervezett fogak, időtartam, ráhagyás) */
export function recalcAppt(db: DB, a: Appointment): void {
  const items = a.items || []
  if (!items.length) return
  a.typeIds = [...new Set(items.map(i => i.typeId))]
  const teeth = [...new Set(items.map(i => i.tooth).filter((n): n is number => !!n))]
  const surfaces: Record<number, ('M' | 'O' | 'D' | 'V' | 'L')[]> = {}
  items.forEach(i => { if (i.tooth && i.surfaces.length) surfaces[i.tooth] = [...new Set([...(surfaces[i.tooth] || []), ...i.surfaces])] })
  a.planned = teeth.length ? { teeth, surfaces } : null
  const sum = a.typeIds.reduce((s, id) => s + (typeById(db, id)?.dur || 0), 0)
  const patient = db.patients.find(p => p.id === a.patientId)
  if (sum) a.dur = DURS.find(x => x >= sum) || 300
  a.buffer = bufferFor(db, a.typeIds, patient)
}
/** egy időpont – egy orvos: a tételek végző orvosai közül a különbözők */
export function itemDoctors(items: PlannedItem[], fallback: string | null): string[] {
  return [...new Set(items.map(i => i.doctorId || fallback).filter((x): x is string => !!x))]
}
/** határidő utáni ütemezés: a javasolt tétel határideje az időpont előtt lejárt */
export function lateDue(db: DB, sugIds: string[], date: string): { s: Suggestion; due: string }[] {
  return sugIds.map(id => db.suggestions.find(x => x.id === id)).filter((s): s is Suggestion => !!s && !!s.due && s.due < date).map(s => ({ s, due: s.due! }))
}
export function itemLabel(db: DB, i: { tooth: number | null; typeId: string }): string {
  return (i.tooth ? i.tooth + ' – ' : '') + (typeById(db, i.typeId)?.name || i.typeId).toLowerCase()
}

/* ---------- 2. pont: törlés megőrzés ---------- */
export const restorableUntil = (at: string) => addDays(at.slice(0, 10), DELETE_RESTORE_DAYS)
export const canRestore = (d: { at: string }) => restorableUntil(d.at) >= today()

/* ---------- 4. pont: diktálási piszkozat ---------- */
export const draftExpiry = () => addDays(today(), DRAFT_DAYS)
export const draftDaysLeft = (d: { expires: string }) => Math.max(0, dayDiff(today(), d.expires))
export const liveDrafts = (db: DB) => db.drafts.filter(d => d.expires >= today())

/* ---------- 8. pont: tájékoztató és udvarias egyeztetés-kérő üzenet ---------- */
const toothText = (i: { tooth: number | null; typeId: string }, db: DB) => {
  const n = (typeById(db, i.typeId)?.name || i.typeId).toLowerCase()
  return i.tooth ? `${n} a(z) ${i.tooth}-es fogon` : n
}
/** közérthető felsorolás: kezelés megnevezése és fogszám – diagnózis, ár, egyéb egészségügyi adat nélkül */
export function plainList(db: DB, list: { tooth: number | null; typeId: string }[]): string {
  const t = [...new Set(list.map(i => toothText(i, db)))]
  return t.length <= 1 ? (t[0] || '') : t.slice(0, -1).join(', ') + ' és ' + t[t.length - 1]
}
export interface InformCtx { patientId: string; suggestions: Suggestion[]; appts: Appointment[] }
/** a páciens tájékoztatójához tartozó adatok: az időponthoz kötött és a még nyitott javasolt tételek */
export function informContext(db: DB, pid: string, apptIds?: string[]): InformCtx {
  const live = db.suggestions.filter(s => s.patientId === pid && (isPendingSuggestion(s) || s.status === 'booked'))
  const appts = patientFuture(db, pid).filter(a => !apptIds || apptIds.includes(a.id))
  return { patientId: pid, suggestions: live, appts: appts.filter(a => live.some(s => s.appointmentId === a.id)).length ? appts.filter(a => live.some(s => s.appointmentId === a.id)) : appts }
}
export function fillInform(db: DB, tpl: string, ctx: InformCtx): string {
  const p = db.patients.find(x => x.id === ctx.patientId)
  const first = ctx.appts[0]
  const open = ctx.suggestions.filter(s => s.status !== 'booked')
  const booked = ctx.suggestions.filter(s => s.status === 'booked' && ctx.appts.some(a => a.id === s.appointmentId))
  const srcSug = booked[0] || open[0] || ctx.suggestions[0]
  const src = srcSug ? sugSources(db, srcSug)[0] : null
  const forras = src ? `${fmtDate(src.date)}-i ${src.label.toLowerCase()} során` : 'legutóbbi vizsgálat során'
  const when = ctx.appts.map(a => `${fmtDate(a.date)} ${a.start}-kor`).join(' és ')
  let list = plainList(db, booked.length ? booked : ctx.suggestions)
  // több időpont: időpontonként csoportosítva; a még nem ütemezettek külön
  if (ctx.appts.length > 1) {
    list = ctx.appts.map(a => `${fmtDate(a.date)} ${a.start}: ${plainList(db, ctx.suggestions.filter(s => s.appointmentId === a.id))}`).join('; ')
  }
  if (open.length && booked.length) list += `. Ezekhez később egyeztetünk időpontot: ${plainList(db, open)}`
  const map: Record<string, string> = {
    'név': p?.name || '', 'javasolt_kezelések': list, 'forras_kezeles': forras, 'kovetkezo_idopont': when, 'orvos': first ? doctorName(db, first.doctorId) : '',
    'rendelo_telefon': db.settings.phone, 'klinika': db.settings.clinic, 'telefon': db.settings.phone,
  }
  return tpl.replace(/\{([^}]+)\}/g, (m, k) => (map[k] !== undefined ? map[k]! : m))
}
/** az „egyeztessen időpontot” üzenet (kézi indítás, időpont nélkül is): a páciens nyitott javasolt tételeivel és a forrás-kezeléssel */
export function coordText(db: DB, pid: string): string {
  const open = db.suggestions.filter(s => s.patientId === pid && isPendingSuggestion(s))
  return fillInform(db, db.settings.suggestTemplate || SUGGEST_TPL, { patientId: pid, suggestions: open, appts: [] })
}
/** a páciensnek van-e még nem kiküldött tájékoztatója: van rögzített időpont, javasolt eredetű tétellel, és nem ment ki / nem mellőzték */
export function pendingInform(db: DB, pid: string): { appts: Appointment[]; ctx: InformCtx } | null {
  const ctx = informContext(db, pid)
  const withSug = ctx.appts.filter(a => ctx.suggestions.some(s => s.appointmentId === a.id && s.status === 'booked'))
  const todo = withSug.filter(a => !db.informs.some(i => i.appointmentIds.includes(a.id)))
  return todo.length ? { appts: todo, ctx: { ...ctx, appts: todo } } : null
}

/* ---------- 8. pont: egységes Teendők (asszisztens) ---------- */
export type TaskKind = 'schedule' | 'inform' | 'recall' | 'cancel' | 'reply' | 'late' | 'conflict' | 'offsched' | 'approve'
export const TASK_KINDS: Record<TaskKind, { label: string; cls: string }> = {
  schedule: { label: 'Időpontot kell egyeztetni', cls: 'b-yellow' },
  inform: { label: 'Tájékoztató küldése', cls: 'b-blue' },
  recall: { label: 'Esedékes kontroll', cls: 'b-gray' },
  cancel: { label: 'Lemondást jelzett', cls: 'b-red' },
  reply: { label: 'Páciens üzenete', cls: 'b-blue' },
  late: { label: 'Lejárt határidő', cls: 'b-red' },
  conflict: { label: 'Időpont-ütközés', cls: 'b-red' },
  offsched: { label: 'Időpont a beosztáson kívül', cls: 'b-red' },
  approve: { label: 'Tájékoztató jóváhagyásra vár', cls: 'b-blue' },
}
export interface Task {
  key: string
  kind: TaskKind
  patientId: string
  doctorId: string | null
  /** mi a teendő */
  title: string
  /** forrás / részletek */
  detail: string
  urgency: 'urgent' | 'recommended' | 'later'
  due: string | null
  overdue: boolean
  /** állapot szöveggel */
  status: string
  /** az eredeti sor azonosítója (javaslat, időpont, kontroll kulcs) */
  ref: string
  refKind: 'suggestion' | 'appointment' | 'recall' | 'conflict' | 'record'
  typeId?: string
  /** v2.4 7. pont: az ütköző csoport időpontjai */
  appts?: string[]
  /** csak ráhagyás-ütközés */
  soft?: boolean
}
/** a „Teendők” menü sorai; a raktári teendők (megrendelés, késő szállítás) nem ide tartoznak */
export function buildTasks(db: DB): Task[] {
  const out: Task[] = []
  const pDoc = (pid: string) => db.patients.find(p => p.id === pid)?.doctorId || null
  // 1. időpontot kell egyeztetni (javasolt kezelések, páciensenként összefogva a Teendők nézetben soronként)
  db.suggestions.filter(isOpenSuggestion).forEach(s => {
    const late = isOverdue(s)
    out.push({
      key: 's:' + s.id, kind: late ? 'late' : 'schedule', patientId: s.patientId, doctorId: performerOf(db, s) || pDoc(s.patientId), title: `${typeById(db, s.typeId)?.name || s.typeId}${s.tooth ? ' · ' + s.tooth + '-es fog' : ''}`,
      detail: sugSourceText(db, s), urgency: s.urgency, due: s.due, overdue: late,
      status: needsFollowUp(s) ? 'újra megkeresendő' : s.status === 'contacted' ? 'megkeresve' : s.status === 'postponed' ? 'elhalasztva, újra jelez' : 'új', ref: s.id, refKind: 'suggestion', typeId: s.typeId,
    })
  })
  // 2. tájékoztató küldése: van időpont, de még nem ment ki a tájékoztató
  db.patients.forEach(p => {
    const pi = pendingInform(db, p.id)
    if (!pi) return
    pi.appts.forEach(a => {
      out.push({
        key: 'i:' + a.id, kind: 'inform', patientId: p.id, doctorId: a.doctorId, title: `Tájékoztató küldése – ${fmtDate(a.date)} ${a.start}`,
        detail: plainList(db, pi.ctx.suggestions.filter(s => s.appointmentId === a.id)), urgency: 'recommended', due: a.date, overdue: false,
        status: 'időpont rögzítve, tájékoztató nem ment ki', ref: a.id, refKind: 'appointment',
      })
    })
  })
  // 3. esedékes kontrollok
  recallRows(db).filter(r => !r.booked && !r.snoozed && r.state !== 'soon').forEach(r => {
    out.push({
      key: 'r:' + r.patient.id + ':' + r.typeId, kind: 'recall', patientId: r.patient.id, doctorId: pDoc(r.patient.id), title: `${r.typeName} – felülvizsgálat`,
      detail: `Legutóbb: ${fmtDate(r.last)}`, urgency: r.state === 'overdue' ? 'recommended' : 'later', due: r.due, overdue: r.state === 'overdue',
      status: r.invitedAt ? `meghívó kiküldve: ${fmtDate(r.invitedAt)}` : r.state === 'overdue' ? 'lejárt' : 'esedékes', ref: r.patient.id, refKind: 'recall', typeId: r.typeId,
    })
  })
  // 4–5. lemondást jelzett időpontok és a páciensek üzenetei
  db.appointments.filter(a => a.date >= today() && !recordForAppt(db, a.id)).forEach(a => {
    if (a.cancelSignal) out.push({ key: 'c:' + a.id, kind: 'cancel', patientId: a.patientId, doctorId: a.doctorId, title: `Lemondást jelzett: ${fmtDate(a.date)} ${a.start}`, detail: `„${a.cancelSignal.text}”`, urgency: 'urgent', due: a.date, overdue: false, status: 'az asszisztens döntése szükséges', ref: a.id, refKind: 'appointment' })
    ;(a.replies || []).filter(r => !r.done).forEach(r => out.push({ key: 'm:' + r.id, kind: 'reply', patientId: a.patientId, doctorId: a.doctorId, title: `Üzenet az emlékeztetőre: ${fmtDate(a.date)} ${a.start}`, detail: `„${r.text}”`, urgency: 'recommended', due: null, overdue: false, status: 'megválaszolandó', ref: a.id + '|' + r.id, refKind: 'appointment' }))
  })
  // 6. v2.4 7. pont: időpont-ütközés – egy feladat minden ütköző csoportra; magától megszűnik, ha az ütközés megszűnik
  const pName = (pid: string) => db.patients.find(p => p.id === pid)?.name || '?'
  const DAYN = ['hétf.', 'kedd', 'szer.', 'csüt.', 'pént.', 'szom.', 'vas.']
  const dayN = (d: string) => { const g = new Date(d + 'T12:00:00').getDay(); return DAYN[g === 0 ? 6 : g - 1] }
  conflictGroups(db, { isDone: a => !!recordForAppt(db, a.id) }).filter(g => !g.ok).forEach(g => {
    const u = conflictUrgency(g)
    out.push({
      key: g.key, kind: 'conflict', patientId: g.appts[0]!.patientId, doctorId: g.doctorId,
      title: `${g.appts.map(a => pName(a.patientId)).join(' és ')} – ${dayN(g.date)} ${g.date}, ${g.appts.map(a => a.start).join(' / ')}, ${doctorName(db, g.doctorId)}`,
      detail: g.hard ? 'A kezelések időben átfedik egymást: valamelyik időpontot el kell tolni, illetve a pácienst értesíteni kell.' : 'Csak a ráhagyás fedi át a másik időpontot.',
      urgency: u, due: g.date, overdue: u === 'urgent', status: g.hard ? 'ütközés – kezelendő' : 'ráhagyás-ütközés', ref: g.key, refKind: 'conflict', appts: g.appts.map(a => a.id), soft: !g.hard,
    })
  })
  // 7. v2.4 21. pont: a beosztás módosítása után a rendelési időn kívülre eső meglévő időpontok
  offSchedule(db, a => !!recordForAppt(db, a.id)).forEach(a => {
    out.push({ key: 'o:' + a.id, kind: 'offsched', patientId: a.patientId, doctorId: a.doctorId, title: `${fmtDate(a.date)} ${a.start} – ${typeNames(db, a.typeIds)}`, detail: notWorkingText(db, a.doctorId, a.date) + ' – helyezd át, vagy értesítsd a pácienst.', urgency: a.date <= addDays(today(), 1) ? 'urgent' : 'recommended', due: a.date, overdue: false, status: 'áthelyezendő', ref: a.id, refKind: 'appointment' })
  })
  return out.sort((a, b) => URGENCY[a.urgency].rank - URGENCY[b.urgency].rank || Number(b.overdue) - Number(a.overdue) || (a.due || '9999').localeCompare(b.due || '9999'))
}

/** egy javaslat összegzett díja egy időpont tételeinek listájához */
export const itemsFee = (db: DB, items: PlannedItem[]) => items.reduce((s, i) => s + sugFee(db, { typeId: i.typeId, surfaces: i.surfaces } as Suggestion), 0)

/** a korábbi (v2.1-es) egyeztető-sablon felismerése, hogy a migráció udvariasra cserélhesse */
export const isOldSuggestTpl = (t: string) => t === OLD_SUGGEST_TPL
export const informInfo = (db: DB, i: InformLog) => `${i.kind === 'sent' ? 'kiküldve' : 'nem szükséges'}: ${fmtDate(i.at.slice(0, 10))}${i.channel ? ' · ' + i.channel : ''}`
