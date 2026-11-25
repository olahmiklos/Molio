// A diktálás szövegfeldolgozási lánca (spec v2.3, 3., 4., 7., 10., 13. pont):
// felismert szöveg → kitaláció-szűrés → személyes javítások → közös szótár (alapszótár) → hasonlóság szerinti egyeztetés → értelmezés (parser).
// Tiszta függvények; a felület csak a ⚠ sorokat és a változások listáját jeleníti meg.
import { norm } from '../dates'
import { applyBase, FILLER_FORMS } from './base'
import { collapseRepeats, DEFAULT_HALLU, filterHallucinations, tooDense } from './filters'
import { fuseNumbers } from './numbers'
import { nearest, THRESHOLDS, type ThresholdKey } from './similar'
import type { Vocab } from './vocab'

export interface PersonalRule {
  id: string; from: string; to: string; active: boolean; source: 'kezi' | 'betanitas' | 'tanult' | 'javitas' | 'kozponti'; recognizer?: string; created: string
  /** v2.4 6. pont: kiejtési (a beszélőre érvényes) vagy szakmai (a rendelő minden felhasználójára érvényes) javítás; kategória; ág; használat */
  scope?: 'szemely' | 'rendelo'
  cat?: string
  branch?: string
  /** hányszor futott le; az első alkalmazás jelölése (fogszám / művelet / anyag módosításánál) */
  uses?: number
  applied?: number
}
export type FlagKind = 'similar' | 'ambig' | 'repeat' | 'dense' | 'chart' | 'prebooked' | 'qty' | 'ai' | 'life' | 'macro'
export interface FlagChoice { id: string; label: string; hint?: string }
export interface DictFlag { key: string; kind: FlagKind; title: string; detail?: string; choices: FlagChoice[]; /** csak tudomásul vétel („Rendben”) */ info?: boolean; /** automatikus előfeltöltés: ajánlott választás */ suggested?: string; data?: Record<string, unknown> }
export interface PipeStep { kind: 'filter' | 'repeat' | 'personal' | 'base' | 'similar' | 'pick' | 'filler'; from: string; to: string }
export interface PipeOpts {
  personal?: PersonalRule[]
  filterList?: string[]
  seconds?: number
  threshold?: ThresholdKey
  vocab?: Vocab
  /** a felhasználó választásai a ⚠ sorokban: flag-kulcs → választás-azonosító */
  picks?: Record<string, string>
  densityWps?: number
}
export interface PipeResult {
  raw: string
  /** a parsernek átadott, kisbetűs, ékezet nélküli szöveg */
  text: string
  /** a kiszűrt kitalációk eltávolítása utáni, még ékezetes szöveg (megjelenítéshez) */
  cleaned: string
  steps: PipeStep[]
  flags: DictFlag[]
  filteredOut: string[]
  unknown: string[]
}

const FILL_RE = /(?<![\p{L}])(izé|öö|hát|szóval|na|akkor)(?![\p{L}])/giu
const AMBIG: Record<string, string> = { kivettem: 'kivettem', leszedtem: 'leszedtem', kiszedtem: 'kiszedtem' }
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')

/** a szöveg feldolgozása a parser előtt; a hívó (kezelés) a PipeResult.text-et értelmezi, a flags a ⚠ ellenőrzésbe kerül */
export function preprocess(raw: string, o: PipeOpts = {}): PipeResult {
  const steps: PipeStep[] = [], flags: DictFlag[] = [], picks = o.picks || {}
  // 1) kitaláció-szűrés (13. pont)
  const h = filterHallucinations(raw || '', o.filterList || DEFAULT_HALLU)
  h.removed.forEach(r => steps.push({ kind: 'filter', from: r, to: '' }))
  const rep = collapseRepeats(h.text)
  rep.repeats.forEach(r => { steps.push({ kind: 'repeat', from: r, to: '' }); flags.push({ key: 'repeat:' + norm(r), kind: 'repeat', title: `Ismétlődő szöveg: „${r}”`, detail: 'Csak egyszer maradt meg – ellenőrizd, hogy valóban ennyit mondtál-e.', choices: [{ id: 'ok', label: 'Rendben' }], info: true }) })
  const cleaned = rep.text
  if (o.seconds && tooDense(cleaned, o.seconds, o.densityWps)) flags.push({ key: 'dense', kind: 'dense', title: 'Valószínűtlenül sűrű átirat', detail: `A felismert szöveg a ${Math.round(o.seconds)} másodperces felvételhez képest túl hosszú – lehet, hogy a felismerő kitalált szöveget is hozzáadott.`, choices: [{ id: 'ok', label: 'Rendben, ellenőriztem' }], info: true })
  // 2) töltelékszavak (SZ-129), normalizálás, tizedes számok
  let t0 = cleaned.replace(FILL_RE, (m: string) => { steps.push({ kind: 'filler', from: m, to: '' }); return ' ' })
  let t = fuseNumbers(' ' + norm(t0) + ' ')
  // 3) személyes javítások (3. pont): a személyes szabály az erősebb
  for (const r of (o.personal || []).filter(x => x.active)) {
    const from = norm(r.from).trim(), to = norm(r.to).trim()
    if (!from) continue
    const re = new RegExp(`(?<![a-z0-9])${esc(from)}(?![a-z0-9])`, 'g')
    t = t.replace(re, () => { steps.push({ kind: 'personal', from: r.from, to: r.to }); return to })
  }
  // 4) közös szótár (alapszótár)
  const b = applyBase(t); t = b.text
  b.hits.forEach(x => steps.push({ kind: 'base', from: x.from, to: x.to }))
  // 5) kétértelmű „kivettem / leszedtem”: varrat vagy fogkő a környezetben eldönti; különben ⚠
  let amb = 0
  t = t.replace(/[a-z0-9]+|[^a-z0-9]+/g, (w, off: number, all: string) => {
    if (!AMBIG[w]) return w
    const clause = clauseAround(all, off)
    if (/varrat|varrt|oltes/.test(clause)) { steps.push({ kind: 'base', from: w, to: 'szalszedes' }); return 'szalszedes' }
    if (/fogko/.test(clause)) { steps.push({ kind: 'base', from: w, to: '' }); return '' }
    const key = `amb:${w}:${amb++}`
    const p = picks[key]
    if (p === 'extrakcio') { steps.push({ kind: 'pick', from: w, to: 'extrakció' }); return 'extrakcio' }
    if (p === 'nincs') return ''
    flags.push({ key, kind: 'ambig', title: `Kétértelmű: „${w}”`, detail: 'Foghúzást vagy valami mást (pl. varratszedést) jelent? A környezet nem dönti el.', choices: [{ id: 'extrakcio', label: 'Foghúzás' }, { id: 'nincs', label: 'Egyik sem – ne vegye figyelembe' }], data: { word: w } })
    return w
  })
  // 6) hasonlóság szerinti egyeztetés (10. pont): minden ismeretlen szóra, számokra nem
  const unknown: string[] = []
  if (o.vocab) {
    const th = THRESHOLDS[o.threshold || 'medium']
    t = t.replace(/[a-z0-9]+/g, (w) => {
      if (o.vocab!.isKnown(w) || AMBIG[w]) return w
      const key = 'sim:' + w, p = picks[key]
      if (p === '__none') { unknown.push(w); return w }
      if (p) { steps.push({ kind: 'pick', from: w, to: p }); return p }
      const c = nearest(w, o.vocab!.entries, th)
      if (!c.length) { unknown.push(w); return w }
      flags.push({ key, kind: 'similar', title: `Nem ismert szó: „${w}”`, detail: 'A szótár legközelebbi kifejezése – nem javítja ki magától.', choices: [...c.map(m => ({ id: m.word, label: `${m.label}?`, hint: `${Math.round(m.score * 100)}% egyezés` })), { id: '__none', label: 'Egyik sem' }], data: { word: w } })
      return w
    })
    // a választással beírt szó még átmegy az alapszótáron (pl. „polirpasta” → polírpaszta)
    if (steps.some(s => s.kind === 'pick')) t = applyBase(t).text
  }
  return { raw, text: t.replace(/\s+/g, ' ').trim(), cleaned, steps, flags, filteredOut: h.removed, unknown: [...new Set(unknown)] }
}
/** a „|” helyett a mondatjelek közti szövegrész */
function clauseAround(all: string, off: number): string {
  const a = Math.max(all.lastIndexOf('.', off), all.lastIndexOf(',', off), all.lastIndexOf(';', off)), bIdx = [all.indexOf('.', off), all.indexOf(',', off), all.indexOf(';', off)].filter(i => i >= 0)
  return all.slice(a + 1, bIdx.length ? Math.min(...bIdx) : all.length)
}
export { FILLER_FORMS }
