// Javasolt további kezelések követése (spec v2.1, 12. pont): „időpontot kell egyeztetni” lista az asszisztensnek
import { defineStore } from 'pinia'
import { useDataStore } from './data'
import { today, uid } from '~/utils/dates'
import type { Suggestion } from '~/utils/types'
import { defaultRemind, isOpenSuggestion, isOverdue, isPendingSuggestion, needsFollowUp, URGENCY } from '~/utils/suggest'

export const useSuggestionStore = defineStore('suggestion', () => {
  const data = useDataStore()
  const db = computed(() => data.db)
  const byId = (id: string) => db.value.suggestions.find(s => s.id === id)

  /** alapértelmezett rendezés: sürgősség, majd határidő */
  const sorter = (a: Suggestion, b: Suggestion) =>
    URGENCY[a.urgency].rank - URGENCY[b.urgency].rank || (a.due || '9999').localeCompare(b.due || '9999') || a.createdAt.localeCompare(b.createdAt)
  const open = computed(() => db.value.suggestions.filter(isOpenSuggestion).sort(sorter))
  const pending = (pid: string) => db.value.suggestions.filter(s => s.patientId === pid && isPendingSuggestion(s)).sort(sorter)
  const count = computed(() => open.value.length)
  const overdueCount = computed(() => open.value.filter(isOverdue).length)
  const followUpCount = computed(() => open.value.filter(needsFollowUp).length)

  function add(s: Omit<Suggestion, 'id' | 'createdAt' | 'status' | 'contacts'> & Partial<Suggestion>) {
    // ugyanarra a fogra és műveletre nem készül második nyitott javaslat
    const dup = db.value.suggestions.find(x => x.patientId === s.patientId && x.tooth === s.tooth && x.typeId === s.typeId && isPendingSuggestion(x))
    if (dup) {
      // ismételt javaslat (spec v2.2, 6. pont): nem készül második tétel, az új vizit „újra megerősítve” bejegyzés lesz
      if (s.recordId && s.recordId !== dup.recordId && !(dup.confirms || []).some(c => c.recordId === s.recordId)) {
        ;(dup.confirms ||= []).push({ date: today(), recordId: s.recordId, doctorId: s.doctorId || '' })
        if (s.urgency && URGENCY[s.urgency].rank < URGENCY[dup.urgency].rank) dup.urgency = s.urgency
        if (s.due && (!dup.due || s.due < dup.due)) dup.due = s.due
      }
      return dup
    }
    const n: Suggestion = { id: uid(), createdAt: today(), status: 'new', contacts: [], confirms: [], performerId: db.value.patients.find(p => p.id === s.patientId)?.doctorId || s.doctorId || null, ...s }
    db.value.suggestions.push(n)
    return n
  }
  function contact(id: string, c: { date?: string; channel: string; note: string }) {
    const s = byId(id); if (!s) return
    s.contacts.push({ date: c.date || today(), channel: c.channel, note: c.note })
    if (s.status === 'new' || s.status === 'postponed') s.status = 'contacted'
  }
  function postpone(id: string, remindAt?: string, note = '') {
    const s = byId(id); if (!s) return
    s.status = 'postponed'; s.remindAt = remindAt || defaultRemind(s)
    if (note) s.contacts.push({ date: today(), channel: 'jegyzet', note })
  }
  function decline(id: string, note = '') { const s = byId(id); if (!s) return; s.status = 'declined'; s.closedNote = note }
  /** „elvetve”: csak az orvos döntése (a demóban az orvos kiválasztásával rögzítjük) */
  function drop(id: string, doctorName: string) { const s = byId(id); if (!s) return; s.status = 'dropped'; s.droppedBy = doctorName }
  function reopen(id: string) { const s = byId(id); if (!s) return; s.status = 'new'; s.remindAt = null; s.appointmentId = null }
  function book(ids: string[], appointmentId: string, doctorId?: string | null) {
    ids.forEach(id => { const s = byId(id); if (s) { s.status = 'booked'; s.appointmentId = appointmentId; if (doctorId) s.performerId = doctorId } })
  }
  /** a javaslat végző orvosának módosítása (az időpont orvosával egyeztetve) */
  function setPerformer(id: string, doctorId: string) { const s = byId(id); if (s) s.performerId = doctorId }
  function toggleCallback(id: string) { const s = byId(id); if (s) s.callback = !s.callback }
  /** a kezelés elvégzése lezárja a hozzá tartozó javaslatot (foglalás szerint vagy fog + művelet szerint) */
  function completeFor(patientId: string, appointmentId: string | null, done: { tooth: number | null; typeId: string }[]) {
    db.value.suggestions.filter(s => s.patientId === patientId && isPendingSuggestion(s) || (s.patientId === patientId && s.status === 'booked')).forEach(s => {
      if ((appointmentId && s.appointmentId === appointmentId) || done.some(d => d.typeId === s.typeId && d.tooth === s.tooth)) s.status = 'done'
    })
  }
  return { byId, open, pending, count, overdueCount, followUpCount, add, contact, postpone, decline, drop, reopen, book, toggleCallback, completeFor, setPerformer }
})
