// Adatok átvétele régebbi demóverzióból (a böngészőben tárolt adatok nem vesznek el a frissítéskor)
import { addDays } from './dates'
import type { DB } from './types'
import { SMS_TPL, MAIL_TPL, MAIL_SUBJ, SUGGEST_TPL, defaultRecallTemplates } from './defaults'
import { DEFAULT_SYNONYMS } from './codesets'
import { builtinFilters } from './stockFilter'

const BOUND = ['tomes', 'huzas', 'korona', 'gyoker', 'implant']

/** a v4 (demó 2.0) adatait a v5 (specifikáció v2.1) szerkezetére hozza */
export function migrate(db: DB, toVersion: number): DB {
  const st = db.settings as DB['settings']
  db.suggestions = db.suggestions || []
  db.recallSnoozes = db.recallSnoozes || []
  if (!db.savedFilters || !db.savedFilters.length) db.savedFilters = builtinFilters()
  st.recallTemplates = st.recallTemplates?.length ? st.recallTemplates : defaultRecallTemplates()
  st.suggestTemplate = st.suggestTemplate || SUGGEST_TPL
  st.synonyms = st.synonyms?.length ? st.synonyms : DEFAULT_SYNONYMS.map(x => ({ ...x }))
  // az emlékeztető-sablon nem kér megerősítést (9. pont): a régi „IGEN-nel” sablon lecserélődik
  if (/IGEN/i.test(st.notify.smsTpl)) st.notify.smsTpl = SMS_TPL
  if (/jelezze a \{telefon\} telefonszámon/.test(st.notify.mailTpl)) { st.notify.mailTpl = MAIL_TPL; st.notify.mailSubj = st.notify.mailSubj || MAIL_SUBJ }
  db.types.forEach(t => {
    if (t.toothBound === undefined) t.toothBound = BOUND.includes(t.id)
    if (t.id === 'kontroll' && t.recallMonths === 12) t.recallMonths = 6
  })
  const hi = st.statusDict.find(d => d.id === 'hianyzik')
  if (hi) ['extrahalt*', 'kihuzott*'].forEach(k => { if (!hi.kw.includes(k)) hi.kw.push(k) })
  db.orders.forEach(o => {
    o.lines.forEach(l => { if (l.received === undefined) l.received = o.status === 'received' ? l.qty : 0 })
    if (!o.expected) o.expected = addDays(o.date, Math.max(0, ...o.lines.map(l => db.items.find(i => i.id === l.item)?.lead || 0)))
  })
  db.appointments.forEach(a => { delete (a as { confirmed?: boolean }).confirmed })
  db.version = toVersion
  return db
}
