// Naptár, időpontok, emlékeztetők és a meg nem jelenés kockázata (2.1.1, 2.1.2)
import { defineStore } from 'pinia'
import { useDataStore } from './data'
import { addDays, dow, fromYmd, today, uid, ymd } from '~/utils/dates'
import type { Appointment } from '~/utils/types'
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
  /** lemondás: a sáv felszabadul; a program nem ajánlja fel más páciensnek, várólista nincs */
  function cancel(id: string) {
    const a = byId(id); if (!a) return
    const lateC = apptStartDate(a).getTime() - Date.now() < 24 * 3600000
    db.value.events.push({ id: uid(), patientId: a.patientId, date: today(), kind: lateC ? 'latecancel' : 'cancel', min: 0 })
    db.value.appointments = db.value.appointments.filter(x => x.id !== id)
    // a lemondott időponthoz kötött javasolt kezelés visszakerül az „egyeztetendő” listára (spec 12. pont)
    db.value.suggestions.filter(sg => sg.appointmentId === id && sg.status === 'booked').forEach(sg => { sg.status = 'new'; sg.appointmentId = null })
  }
  const isLateCancel = (a: Appointment) => apptStartDate(a).getTime() - Date.now() < 24 * 3600000
  function toggleNoShow(id: string) { const a = byId(id); if (!a) return; if (a.status === 'noshow') delete a.status; else a.status = 'noshow' }
  function setLate(id: string, v: number) { const a = byId(id); if (a) a.late = Math.max(0, Number(v) || 0) }
  /** a páciens válasza az emlékeztetőre (a demóban szimulált): „NEM” esetén lemondást jelez, az asszisztens zárja le; minden más válasz üzenet az asszisztensnek */
  function simulateReply(id: string, text: string) {
    const a = byId(id); if (!a) return 'none' as const
    if (isCancelReply(text)) { a.cancelSignal = { at: new Date().toISOString(), text: text.trim() }; return 'cancel' as const }
    return 'message' as const
  }
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

  return { calMode, calDate, byId, risk, price, isDone, calNav, openDay, create, update, cancel, isLateCancel, toggleNoShow, setLate, simulateReply, clearSignal, signals, sendNow, setBuffer, weekList, defaultBookingDate }
})
