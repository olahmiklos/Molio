// Naptár, időpontok, emlékeztetők és a meg nem jelenés kockázata (2.1.1, 2.1.2)
import { defineStore } from 'pinia'
import { useDataStore } from './data'
import { addDays, dow, fromYmd, today, uid, ymd } from '~/utils/dates'
import type { Appointment, DeletedAppt, PlannedItem } from '~/utils/types'
import { canRestore, recalcAppt } from '~/utils/v22'
import { apptPrice, apptStartDate, isCancelReply, recordForAppt, remindInfo, riskFor } from '~/utils/logic'
import { ROOM_ID } from '~/utils/defaults'

export type CalMode = 'day' | 'week' | 'month'

export const useAppointmentStore = defineStore('appointment', () => {
  const data = useDataStore()
  const db = computed(() => data.db)
  const calMode = ref<CalMode>('day')
  const calDate = ref(today())

  const byId = (id: string) => db.value.appointments.find(a => a.id === id)
  const risk = (a: Appointment) => riskFor(db.value, a)
  const price = (a: Appointment) => apptPrice(db.value, a)
  const isDone = (a: Appointment) => !!recordForAppt(db.value, a.id)

  function calNav(n: number) {
    if (n === 0) calDate.value = today()
    else if (calMode.value === 'month') { const f = fromYmd(calDate.value); f.setDate(1); f.setMonth(f.getMonth() + n); calDate.value = ymd(f) }
    else calDate.value = addDays(calDate.value, calMode.value === 'day' ? n : n * 7)
  }
  function openDay(d: string) { calDate.value = d; calMode.value = 'day' }

  function create(a: Omit<Appointment, 'id' | 'created' | 'roomId'>) {
    const na: Appointment = { ...a, id: uid(), created: today(), roomId: ROOM_ID }
    db.value.appointments.push(na)
    return na
  }
  function update(id: string, patch: Partial<Appointment>) {
    const a = byId(id); if (!a) return
    if ((patch.date && patch.date !== a.date) || (patch.start && patch.start !== a.start)) { delete a.sentAt; delete a.cancelSignal }
    Object.assign(a, patch)
  }
  /** törlés / lemondás (spec v2.2, 2. pont): az időpont „törölve” állapotban 30 napig megmarad és visszaállítható; a tételek sorsa: nyitott javaslatként visszakerülnek a Teendőkbe, vagy átkerülnek egy másik időpontra */
  function remove(id: string, o: { kind: 'delete' | 'cancel'; reason: string; by?: string; moveTo?: string | null }): DeletedAppt | undefined {
    const a = byId(id); if (!a) return
    const sgIds = db.value.suggestions.filter(sg => sg.appointmentId === id && sg.status === 'booked').map(sg => sg.id)
    let fate = sgIds.length ? 'a javasolt tételek visszakerültek a Teendők közé' : 'nem volt javasolt eredetű tétel'
    if (o.kind === 'cancel') {
      const lateC = apptStartDate(a).getTime() - Date.now() < 24 * 3600000
      db.value.events.push({ id: uid(), patientId: a.patientId, date: today(), kind: lateC ? 'latecancel' : 'cancel', min: 0 })
    }
    if (o.moveTo && byId(o.moveTo)) {
      moveItems(id, o.moveTo, (a.items || []).map((_, i) => i), true)
      fate = 'a tételek átkerültek egy másik időpontra: ' + fmtD(byId(o.moveTo)!)
    } else {
      // a lemondott/törölt időponthoz kötött javasolt kezelés visszakerül az „egyeztetendő” listára
      db.value.suggestions.filter(sg => sg.appointmentId === id && sg.status === 'booked').forEach(sg => { sg.status = 'new'; sg.appointmentId = null })
    }
    const d: DeletedAppt = { id: uid(), appt: JSON.parse(JSON.stringify(a)), kind: o.kind, reason: o.reason, at: new Date().toISOString(), by: o.by || '', fate, suggestionIds: sgIds }
    db.value.deleted.push(d)
    db.value.appointments = db.value.appointments.filter(x => x.id !== id)
    return d
  }
  const fmtD = (a: Appointment) => `${a.date} ${a.start}`
  /** lemondás (v2.1 hívás megmarad): a sáv felszabadul, a program nem ajánlja fel más páciensnek */
  function cancel(id: string) { remove(id, { kind: 'cancel', reason: 'lemondás' }) }
  /** a törölt időpont visszaállítása a 30 napos határidőn belül; a javasolt tételek, ha még szabadok, újra kötődnek */
  function restore(delId: string): { ok: boolean; why?: string } {
    const d = db.value.deleted.find(x => x.id === delId); if (!d) return { ok: false, why: 'nem található' }
    if (!canRestore(d)) return { ok: false, why: 'a 30 napos visszaállítási idő lejárt' }
    if (byId(d.appt.id)) return { ok: false, why: 'az időpont már létezik' }
    const a = JSON.parse(JSON.stringify(d.appt)) as Appointment
    db.value.appointments.push(a)
    d.suggestionIds.forEach(id => { const sg = db.value.suggestions.find(x => x.id === id); if (sg && (sg.status === 'new' || sg.status === 'contacted' || sg.status === 'postponed')) { sg.status = 'booked'; sg.appointmentId = a.id } })
    db.value.deleted = db.value.deleted.filter(x => x.id !== delId)
    return { ok: true }
  }
  /** tételek áthelyezése a páciens másik időpontjára; egy időpont – egy orvos: a tétel az új időpont orvosához kerül */
  function moveItems(fromId: string, toId: string, idx: number[], keepSource = false) {
    const f = byId(fromId), t = byId(toId); if (!f || !t || f.patientId !== t.patientId) return false
    const moving = (f.items || []).filter((_, i) => idx.includes(i))
    const rest = (f.items || []).filter((_, i) => !idx.includes(i))
    const moved: PlannedItem[] = moving.map(i => ({ ...i, surfaces: [...i.surfaces], doctorId: t.doctorId }))
    t.items = [...(t.items || []), ...moved]
    f.items = rest
    moved.forEach(i => { const sg = i.suggestionId ? db.value.suggestions.find(x => x.id === i.suggestionId) : null; if (sg) { sg.appointmentId = t.id; sg.status = 'booked'; sg.performerId = t.doctorId } })
    recalcAppt(db.value, t)
    if (!keepSource) { if (f.items.length) recalcAppt(db.value, f) }
    return true
  }
  /** két időpont összevonása: egy időpont – egy orvos; eltérő orvosnál a felhasználó dönti el, ki marad */
  function merge(keepId: string, otherId: string, doctorId: string, by = '') {
    const k = byId(keepId), o = byId(otherId); if (!k || !o || k.patientId !== o.patientId) return false
    const items = [...(k.items || []), ...(o.items || [])].map(i => ({ ...i, surfaces: [...i.surfaces], doctorId }))
    k.doctorId = doctorId; k.items = items
    k.dur = Math.max(k.dur, 30)
    recalcAppt(db.value, k)
    items.forEach(i => { const sg = i.suggestionId ? db.value.suggestions.find(x => x.id === i.suggestionId) : null; if (sg) { sg.appointmentId = k.id; sg.status = 'booked'; sg.performerId = doctorId } })
    db.value.suggestions.filter(sg => sg.appointmentId === o.id).forEach(sg => { sg.appointmentId = k.id })
    k.mergedFrom = [...(k.mergedFrom || []), o.id]
    k.note = [k.note, o.note].filter(Boolean).join(' · ')
    db.value.deleted.push({ id: uid(), appt: JSON.parse(JSON.stringify(o)), kind: 'merged', reason: 'összevonva a(z) ' + fmtD(k) + ' időponttal', at: new Date().toISOString(), by, fate: 'a tételek az összevont időpontra kerültek', suggestionIds: [] })
    db.value.appointments = db.value.appointments.filter(x => x.id !== o.id)
    return true
  }
  /** a páciens törölt időpontjai (visszaállítható és lejárt is) */
  const deletedOf = (pid: string) => db.value.deleted.filter(d => d.appt.patientId === pid).sort((a, b) => b.at.localeCompare(a.at))
  const isLateCancel = (a: Appointment) => apptStartDate(a).getTime() - Date.now() < 24 * 3600000
  function toggleNoShow(id: string) { const a = byId(id); if (!a) return; if (a.status === 'noshow') delete a.status; else a.status = 'noshow' }
  function setLate(id: string, v: number) { const a = byId(id); if (a) a.late = Math.max(0, Number(v) || 0) }
  /** a páciens válasza az emlékeztetőre (a demóban szimulált): „NEM” esetén lemondást jelez, az asszisztens zárja le; minden más válasz üzenet az asszisztensnek */
  function simulateReply(id: string, text: string) {
    const a = byId(id); if (!a) return 'none' as const
    if (isCancelReply(text)) { a.cancelSignal = { at: new Date().toISOString(), text: text.trim() }; return 'cancel' as const }
    const rep = { id: uid(), at: new Date().toISOString(), text: text.trim() }
    ;(a.replies ||= []).push(rep)
    return 'message' as const
  }
  function doneReply(apptId: string, replyId: string) { const r = byId(apptId)?.replies?.find(x => x.id === replyId); if (r) r.done = true }
  function clearSignal(id: string) { const a = byId(id); if (a) delete a.cancelSignal }
  /** az asszisztens által le nem zárt, lemondást jelző időpontok */
  const signals = computed(() => db.value.appointments.filter(a => a.cancelSignal && a.date >= today() && !recordForAppt(db.value, a.id)).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)))
  function sendNow(id: string) { const a = byId(id); if (a) a.sentAt = new Date().toISOString() }
  function setBuffer(id: string, min: number) { const a = byId(id); if (a) a.buffer = Math.max(0, min) }

  /** a következő hét időpontjai az emlékeztető nézethez */
  const weekList = computed(() => {
    const t0 = today(), end = addDays(t0, 7)
    return db.value.appointments.filter(a => a.date >= t0 && a.date <= end && !recordForAppt(db.value, a.id) && a.status !== 'noshow')
      .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
      .map(a => ({ a, rk: riskFor(db.value, a), ri: remindInfo(a), price: apptPrice(db.value, a) }))
  })
  const defaultBookingDate = () => (dow(today()) <= 5 ? today() : addDays(today(), 8 - dow(today())))

  return { calMode, calDate, byId, risk, price, isDone, calNav, openDay, create, update, remove, cancel, restore, moveItems, merge, deletedOf, doneReply, isLateCancel, toggleNoShow, setLate, simulateReply, clearSignal, signals, sendNow, setBuffer, weekList, defaultBookingDate }
})
