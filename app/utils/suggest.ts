// Javasolt, még be nem ütemezett kezelések (spec v2.1, 12. pont): állapotok, esedékesség, újrajelzés
import { addDays, dayDiff, today } from './dates'
import type { DB, Suggestion } from './types'
import { itemFee } from './logic'

export const SUG_STATUS: Record<Suggestion['status'], { label: string; cls: string }> = {
  new: { label: 'javasolt (új)', cls: 'b-yellow' },
  contacted: { label: 'megkeresve – egyeztetés folyamatban', cls: 'b-blue' },
  booked: { label: 'időpont foglalva', cls: 'b-green' },
  done: { label: 'elvégezve', cls: 'b-green' },
  postponed: { label: 'a páciens elhalasztotta', cls: 'b-gray' },
  declined: { label: 'a páciens elutasította', cls: 'b-gray' },
  dropped: { label: 'elvetve (az orvos visszavonta)', cls: 'b-gray' },
}
export const URGENCY: Record<Suggestion['urgency'], { label: string; rank: number; cls: string }> = {
  urgent: { label: 'sürgős', rank: 0, cls: 'b-red' }, recommended: { label: 'ajánlott', rank: 1, cls: 'b-yellow' }, later: { label: 'ráér', rank: 2, cls: 'b-gray' },
}
/** nyitott teendő: addig látszik, amíg nincs hozzá időpont (vagy el nem vetik); az elhalasztott a megadott napon újra jelez */
export const isOpenSuggestion = (s: Suggestion) =>
  s.status === 'new' || s.status === 'contacted' || (s.status === 'postponed' && !!s.remindAt && s.remindAt <= today())
/** a páciens nyitott vagy elhalasztott javaslata (a kartonon és a fogtérképen is látszik) */
export const isPendingSuggestion = (s: Suggestion) => s.status === 'new' || s.status === 'contacted' || s.status === 'postponed'
/** újrajelzés: ennyi nap után, ha nincs időpont és nem történt megkeresés (alapértelmezett, később felülvizsgálandó) */
export const FOLLOWUP_DAYS = { normal: 14, urgent: 3 }
export const followUpDays = (s: Suggestion) => (s.urgency === 'urgent' ? FOLLOWUP_DAYS.urgent : FOLLOWUP_DAYS.normal)
export const lastTouch = (s: Suggestion) => [s.createdAt, ...s.contacts.map(c => c.date)].sort().pop()!
export const sinceDays = (s: Suggestion) => dayDiff(s.createdAt, today())
export const needsFollowUp = (s: Suggestion) => isOpenSuggestion(s) && dayDiff(lastTouch(s), today()) >= followUpDays(s)
export const isOverdue = (s: Suggestion) => isOpenSuggestion(s) && !!s.due && s.due < today()
export const defaultRemind = (s: Pick<Suggestion, 'urgency'>) => addDays(today(), s.urgency === 'urgent' ? FOLLOWUP_DAYS.urgent : FOLLOWUP_DAYS.normal)
export const sugFee = (db: DB, s: Suggestion) => itemFee(db, s.typeId, s.surfaces)
export const sugTotal = (db: DB, list: Suggestion[]) => list.reduce((sum, s) => sum + sugFee(db, s), 0)

/** a „javasolt kezelés – egyeztessen időpontot” üzenet a sablonból: {név}, {kezelés}, {fogak}, {telefon}, {klinika} */
export function fillSuggest(db: DB, s: Suggestion) {
  const p = db.patients.find(x => x.id === s.patientId), t = db.types.find(x => x.id === s.typeId)
  const map: Record<string, string> = { 'név': p?.name || '', 'kezelés': (t?.name || s.typeId).toLowerCase(), 'fogak': s.tooth ? ` (${s.tooth}-es fog)` : '', 'telefon': db.settings.phone, 'klinika': db.settings.clinic }
  return (db.settings.suggestTemplate || '').replace(/\{([^}]+)\}/g, (m, k) => (map[k] !== undefined ? map[k]! : m))
}
