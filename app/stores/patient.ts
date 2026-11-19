// Páciensek: nyilvántartás, keresés, fogazat, gyors betegösszefoglaló
import { defineStore } from 'pinia'
import { useDataStore } from './data'
import { ageOn, fmtDate, norm, today, uid } from '~/utils/dates'
import type { Dentition, Patient, StatusSnapshot } from '~/utils/types'
import { attendanceStats, doctorName, extractTodo, firstSentence, recordForAppt, riskFor, typeNames, type Risk } from '~/utils/logic'
import { suggestDentition, teethStr } from '~/utils/teeth'
import { docTypeName } from '~/utils/defaults'

export interface SummaryLine { kind: 'base' | 'warn' | 'last' | 'todo' | 'hist' | 'att' | 'attend' | 'next'; text: string; strong?: string; risk?: Risk }

export const usePatientStore = defineStore('patient', () => {
  const data = useDataStore()
  const db = computed(() => data.db)

  const byId = (id: string) => db.value.patients.find(p => p.id === id)
  const sorted = computed(() => db.value.patients.slice().sort((a, b) => a.name.localeCompare(b.name, 'hu')))

  function search(q: string) {
    const s = norm(q).replace(/\s/g, '')
    if (!s) return sorted.value
    return sorted.value.filter(p => norm(p.name).replace(/\s/g, '').includes(s) || p.phone.replace(/\s/g, '').includes(s) || p.taj.replace(/\s/g, '').includes(s))
  }
  const recordsOf = (pid: string) => db.value.records.filter(r => r.patientId === pid).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))
  const lastRecord = (pid: string) => recordsOf(pid)[0]
  const upcoming = (pid: string) => db.value.appointments.filter(a => a.patientId === pid && a.date >= today() && !recordForAppt(db.value, a.id) && a.status !== 'noshow')
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
  const age = (p: Patient) => ageOn(p.birth, today())

  /** a születési dátumból javasolt fogazat (12 év alatt tejfogazat) */
  const suggestedDentition = (birth: string): Dentition => suggestDentition(ageOn(birth, today()), db.value.settings.primaryAgeLimit)

  function create(p: Omit<Patient, 'id' | 'created' | 'dentitionHistory' | 'statuses' | 'remind'> & Partial<Patient>) {
    const np: Patient = {
      remind: { sms: db.value.settings.notify.sms, email: db.value.settings.notify.email },
      ...p, id: uid(), created: today(), statuses: [],
      dentitionHistory: [{ date: today(), to: p.dentition }],
    } as Patient
    db.value.patients.push(np)
    return np
  }
  function update(id: string, patch: Partial<Patient>) {
    const p = byId(id); if (!p) return
    if (patch.dentition && patch.dentition !== p.dentition) p.dentitionHistory.push({ date: today(), to: patch.dentition })
    Object.assign(p, patch)
  }
  function setDentition(id: string, d: Dentition) { update(id, { dentition: d }) }
  function findDuplicate(name: string, birth: string) { return db.value.patients.find(x => norm(x.name) === norm(name) && x.birth === birth) }

  const latestStatus = (pid: string, dentition?: Dentition): StatusSnapshot | undefined => {
    const p = byId(pid); if (!p) return
    const d = dentition || p.dentition
    // azonos napon több pillanatkép is lehet: a legutóbb rögzített számít
    return p.statuses.filter(s => s.dentition === d).reduce<StatusSnapshot | undefined>((best, s) => (!best || s.date >= best.date ? s : best), undefined)
  }
  function addStatus(pid: string, teeth: Record<string, string[]>, note = '', source: StatusSnapshot['source'] = 'status') {
    const p = byId(pid); if (!p) return
    const prev = latestStatus(pid)
    const merged: Record<string, string[]> = { ...(prev?.teeth || {}), ...teeth }
    const changes: NonNullable<StatusSnapshot['changes']> = {}
    Object.entries(teeth).forEach(([n, to]) => {
      const from = prev?.teeth[n] || []
      if ([...from].sort().join() !== [...to].sort().join()) changes[n] = { from: [...from], to: [...to] }
    })
    p.statuses.push({ id: uid(), date: today(), dentition: p.dentition, teeth: merged, note, changes, source })
    return changes
  }

  /** gyors betegösszefoglaló (2.2.2) – szabályalapú kivonat a karton adataiból; a belső megjegyzés nem szerepel benne */
  function summary(pid: string): SummaryLine[] {
    const p = byId(pid); if (!p) return []
    const t0 = today(), L: SummaryLine[] = []
    const a = age(p)
    const recs = recordsOf(pid)
    const st = attendanceStats(db.value, pid)
    const since = p.created ? fmtDate(p.created).replace(/ \d+\.$/, '') : ''
    L.push({ kind: 'base', strong: p.name, text: `${a !== null ? `${a} éves` : ''}${since ? `, ${since} óta páciens` : ''}; ${recs.length ? recs.length + ' rögzített kezelés' : 'még nincs rögzített kezelése'}${p.dentition === 'primary' ? ' · tejfogazat' : ''}` })
    if (p.healthWarning) L.push({ kind: 'warn', text: p.healthWarning })
    const last = recs[0]
    if (last) {
      L.push({ kind: 'last', strong: fmtDate(last.date), text: `${typeNames(db.value, last.typeIds) || 'kezelés'}${last.teeth.length ? ` (${teethStr(last.teeth, last.surfaces)})` : ''}, ${doctorName(db.value, last.doctorId)} – „${firstSentence(last.text)}”` })
      const todo = extractTodo(last.text); if (todo) L.push({ kind: 'todo', text: todo })
    }
    const teeth = [...new Set(recs.flatMap(r => r.teeth))].sort((x, y) => x - y)
    if (teeth.length) L.push({ kind: 'hist', text: `Korábban kezelt fogak: ${teeth.join(', ')}` })
    const atts = db.value.attachments.filter(x => x.patientId === pid && !x.sessKey).sort((x, y) => y.date.localeCompare(x.date))
    if (atts.length) L.push({ kind: 'att', text: `Csatolmányok: ${atts.length} db, legutóbbi: ${docTypeName(atts[0]!.type)} (${fmtDate(atts[0]!.date)})` })
    L.push({ kind: 'attend', text: `Megjelenés az elmúlt évben: ${st.noshow ? `${st.noshow}× nem jelent meg` : 'nem maradt ki'}${st.latec ? `, ${st.latec}× késői lemondás` : ''}${st.late ? `, ${st.late}× jelentős késés` : ''}.` })
    const next = upcoming(pid)[0]
    if (next) L.push({ kind: 'next', text: `Következő időpont: ${fmtDate(next.date)} ${next.start}, ${typeNames(db.value, next.typeIds)}`, risk: riskFor(db.value, next) })
    return L
  }
  return { sorted, byId, search, recordsOf, lastRecord, upcoming, age, suggestedDentition, create, update, setDentition, findDuplicate, latestStatus, addStatus, summary }
})
