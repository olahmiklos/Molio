// A felismerés minőségének mérése (spec v2.4 3., 5., 12., 17., 19. pont): tiszta függvények, tesztelhetők.
// – a Whisper és a böngésző szövegének összevetése (közös szavak aránya) → automatikus váltás a böngésző szövegére, ha a Whisper szövege értelmetlen;
// – szó-szintű pontosság a felolvasott szöveghez mérve (Diktálás-labor, kiadás előtti tesztfelvétel);
// – a betanítás szabályjavaslatainak szűrése („nagyon eltér” → nincs javaslat, ismétlést kér).
import { norm } from '../dates'
import { collapseRepeats, filterHallucinations, tooDense } from './filters'
import { similarity } from './similar'

const UNITS: Record<string, number> = { egy: 1, ket: 2, ketto: 2, harom: 3, negy: 4, ot: 5, hat: 6, het: 7, nyolc: 8, kilenc: 9 }
const TENS: [string, number][] = [['tizen', 10], ['tiz', 10], ['huszon', 20], ['husz', 20], ['harminc', 30], ['negyven', 40], ['otven', 50], ['hatvan', 60], ['hetven', 70], ['nyolcvan', 80], ['kilencven', 90]]
/** ragok és képzők a számnevek végén: „harminchatos”, „hatost”, „ötöt”, „kettőt” */
const NUM_SUFFIX = /(odik|edik|adik|osat|eset|asat|osra|esre|asra|osnal|esnel|asnal|ost|est|ast|os|es|as|ot|et|at|t)$/
/** egy kimondott számnév (ékezet nélkül) → szám; „harminchat” = 36, „hatos” = 6; nem szám → null */
export function wordNumber(w: string): number | null {
  if (/^\d+$/.test(w)) return parseInt(w, 10)
  const tryOne = (s: string): number | null => {
    if (s in UNITS) return UNITS[s]!
    for (const [t, v] of TENS) {
      if (s === t) return v
      if (s.startsWith(t) && s.slice(t.length) in UNITS) return v + UNITS[s.slice(t.length)]!
    }
    return null
  }
  const a = tryOne(w); if (a !== null) return a
  const stripped = w.replace(NUM_SUFFIX, '')
  return stripped !== w && stripped.length >= 2 ? tryOne(stripped) : null
}
/** a számjegy utáni rag („36-os”, „3,6-ot”) – nem önálló szó */
const BARE_SUFFIX = /^(os|es|as|ost|est|ast|ot|et|at|ra|re|on|en|an|nal|nel|tol|tel|ig)$/
/** különírt rag-maradék („36 os”) – a régi szűrő listája */
const LONE_SUFFIX = /^(os|es|as|ost|est|ast|ra|re|on|en|an)$/
const NUMKEY = /^\d+(\.\d+)?$/
/** a különírt összetett számnév tízes előtagjai (B-020) */
const TENS_WORDS = new Set(['husz', 'huszon', 'harminc', 'negyven', 'otven', 'hatvan', 'hetven', 'nyolcvan', 'kilencven'])
/** egy kanonikus szó és az eredeti (ékezetes) alakja a szövegben; a „három egész hat” egy szó (3.6) */
export interface CanonSpan { key: string; orig: string; norm: string }
/**
 * kanonikus szavak az eredeti alakkal (B-017, B-019): kisbetű, ékezet nélkül, a számnevek számjegyként
 * („36-os”, „harminchatos”, „harminc-hat” → 36; „3,6”, „3.6”, „három egész hat” → 3.6)
 */
export function canonSpans(text: string): CanonSpan[] {
  const out: CanonSpan[] = []
  const raw = String(text || '').match(/[\p{L}\p{N}]+(?:[-.,][\p{L}\p{N}]+)*/gu) || []
  for (const w of raw) {
    const n = norm(w)
    const dec = /^(\d+)[.,](\d+)([a-z]*)$/.exec(n)
    if (dec) {
      const unit = dec[3]!, o = unit ? w.slice(0, w.length - unit.length) : w
      out.push({ key: `${parseInt(dec[1]!, 10)}.${dec[2]}`, orig: o, norm: norm(o) })
      if (unit && !BARE_SUFFIX.test(unit)) out.push({ key: unit, orig: w.slice(o.length), norm: unit })
      continue
    }
    const dg = /^(\d+(?:[.,]\d+)?)-([a-z]+)$/.exec(n)
    if (dg && BARE_SUFFIX.test(dg[2]!)) { out.push(...canonSpans(w.replace(/-[\p{L}]+$/u, '')).map(s => ({ ...s, orig: w, norm: n }))); continue }
    const parts = w.split(/[-.,]/).filter(Boolean)
    if (parts.length === 2 && /-/.test(w)) {
      const joined = wordNumber(norm(parts.join('')))
      if (joined !== null && !/\d/.test(n)) { out.push({ key: String(joined), orig: w, norm: n }); continue }
    }
    for (const p of parts) {
      const pn = norm(p)
      if (BARE_SUFFIX.test(pn) && parts.length > 1) continue
      const glued = /^(\d+)([a-z]+)$/.exec(pn)
      if (glued) {
        out.push({ key: String(parseInt(glued[1]!, 10)), orig: p.slice(0, glued[1]!.length), norm: glued[1]! })
        if (!BARE_SUFFIX.test(glued[2]!)) out.push({ key: glued[2]!, orig: p.slice(glued[1]!.length), norm: glued[2]! })
        continue
      }
      const v = wordNumber(pn)
      out.push({ key: v !== null ? String(v) : pn, orig: p, norm: pn })
    }
  }
  // B-020: különírt tízes + egyes számnév („harminc hat”, „harminc hatos”, „húsz egy”) → egy szám (36, 21), ahogy a parser (fuseTeeth) is összevonja;
  // csak ha a tízes után ragozott vagy ragozatlan egyes számnév jön („harminc darab” marad); a „tíz” nem tízes-előtag („tíz, egy” felsorolás)
  const fused: CanonSpan[] = []
  for (let i = 0; i < out.length; i++) {
    const a = out[i]!, b = out[i + 1]
    if (b && TENS_WORDS.has(a.norm) && !/\d/.test(b.norm)) {
      const u = wordNumber(b.norm), v = wordNumber(a.norm + b.norm)
      if (u !== null && u >= 1 && u <= 9 && v !== null && v === Number(a.key) + u) {
        fused.push({ key: String(v), orig: `${a.orig} ${b.orig}`, norm: `${a.norm} ${b.norm}` }); i++; continue
      }
    }
    fused.push(a)
  }
  out.splice(0, out.length, ...fused)
  // „három egész hat”, „három vessző hat (tized)” → 3.6
  const res: CanonSpan[] = []
  for (let i = 0; i < out.length; i++) {
    const a = out[i]!, m = out[i + 1], b = out[i + 2]
    if (/^\d+$/.test(a.key) && m && /^(egesz|vesszo)$/.test(m.key) && b && /^\d+$/.test(b.key) && !/\d/.test(m.orig)) {
      const t = out[i + 3]?.key === 'tized' ? out[i + 3]! : null
      const parts = [a, m, b, ...(t ? [t] : [])]
      res.push({ key: `${a.key}.${b.key}`, orig: parts.map(x => x.orig).join(' '), norm: parts.map(x => x.norm).join(' ') })
      i += t ? 3 : 2; continue
    }
    if (LONE_SUFFIX.test(a.key)) continue
    res.push(a)
  }
  return res
}
/** kanonikus szavak: kisbetű, ékezet nélkül, a számnevek számjegyként („36-os” → 36, „harminchatos” → 36, „harminc-hat” → 36, „3,6” → 3.6) */
export function canonTokens(text: string): string[] {
  return canonSpans(text).map(s => s.key)
}
/** két kanonikus szó egyezik-e (ragozott alakok: azonos, legalább 4 betűs szótő, vagy nagy írásképi hasonlóság) */
export function sameWord(a: string, b: string): boolean {
  if (a === b) return true
  if (NUMKEY.test(a) || NUMKEY.test(b)) return false
  const k = Math.min(a.length, b.length)
  if (k >= 4 && a.slice(0, Math.max(4, k - 2)) === b.slice(0, Math.max(4, k - 2))) return true
  return k >= 5 && similarity(a, b) >= 0.85
}
/** a böngésző szövegének hány %-a szerepel a Whisper szövegében (0–1); ha a böngésző szövege üres: null */
export function overlapRatio(whisper: string, browser: string): number | null {
  const B = canonTokens(browser), W = canonTokens(whisper)
  if (!B.length) return null
  const used = new Array(W.length).fill(false)
  let hit = 0
  for (const b of B) { const i = W.findIndex((w, k) => !used[k] && sameWord(w, b)); if (i >= 0) { used[i] = true; hit++ } }
  return hit / B.length
}
/** a váltás küszöbe (spec v2.4 5. pont: kb. 30%, később felülvizsgálandó) */
export const SWITCH_THRESHOLD = 0.3
export interface WhisperVerdict { usable: boolean; ratio: number | null; reason: string }
/** használható-e a Whisper szövege (5. pont): ha a böngészőével vett közös szavak aránya < 30%, vagy a kitaláció-szűrők elbuktatják, nem */
export function whisperVerdict(whisper: string, browser: string, seconds = 0, o: { threshold?: number; filterList?: string[] } = {}): WhisperVerdict {
  const w = (whisper || '').trim()
  if (!w) return { usable: false, ratio: null, reason: 'a Whisper üres szöveget adott' }
  const h = filterHallucinations(w, o.filterList)
  if (!h.text.trim()) return { usable: false, ratio: null, reason: 'a Whisper szövege csak kitalált (kiszűrt) mondatokból állt' }
  const rep = collapseRepeats(h.text)
  if (rep.repeats.length && canonTokens(rep.text).length * 2 < canonTokens(h.text).length) return { usable: false, ratio: null, reason: 'a Whisper szövege főleg ismétlésből állt' }
  if (seconds > 0 && tooDense(h.text, seconds, 6)) return { usable: false, ratio: null, reason: 'a Whisper szövege a felvétel hosszához képest valószínűtlenül sűrű' }
  const ratio = overlapRatio(w, browser)
  if (ratio === null) return { usable: true, ratio: null, reason: 'a böngésző szövege nem áll rendelkezésre – összevetés nem lehetséges' }
  const th = o.threshold ?? SWITCH_THRESHOLD
  if (canonTokens(browser).length >= 2 && ratio < th) return { usable: false, ratio, reason: `a két felismerő szövegének egyezése ${Math.round(ratio * 100)}% (küszöb: ${Math.round(th * 100)}%)` }
  return { usable: true, ratio, reason: `egyezés a böngésző szövegével: ${Math.round(ratio * 100)}%` }
}

/** szó-szintű egyezés a várt szöveghez (LCS a kanonikus szavakon): az egyező szavak aránya a várt szöveg szavaihoz */
export function wordAccuracy(expected: string, heard: string): { ratio: number; ok: number; total: number } {
  const A = canonTokens(expected), B = canonTokens(heard)
  if (!A.length) return { ratio: 1, ok: 0, total: 0 }
  const dp: number[][] = Array.from({ length: A.length + 1 }, () => new Array(B.length + 1).fill(0))
  for (let i = 1; i <= A.length; i++) for (let j = 1; j <= B.length; j++) dp[i]![j] = sameWord(A[i - 1]!, B[j - 1]!) ? dp[i - 1]![j - 1]! + 1 : Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!)
  const ok = dp[A.length]![B.length]!
  return { ratio: ok / A.length, ok, total: A.length }
}
/** a kiadás előtti tesztfelvétel megfelelőségi küszöbe (5. pont: kb. 80% szó-szintű egyezés) */
export const RELEASE_THRESHOLD = 0.8

/** szavas eltérések a kiemeléshez: a hallott szöveg szavai, jelölve, melyik nem szerepel a várt szövegben */
export function wordDiff(expected: string, heard: string): { word: string; ok: boolean }[] {
  const A = canonTokens(expected)
  const words = (heard || '').split(/\s+/).filter(Boolean)
  const used = new Array(A.length).fill(false)
  return words.map(w => {
    const c = canonTokens(w)
    if (!c.length) return { word: w, ok: true }
    const ok = c.every(x => { const i = A.findIndex((a, k) => !used[k] && sameWord(a, x)); if (i >= 0) { used[i] = true; return true } return false })
    return { word: w, ok }
  })
}

/* ---------- 19. pont: szabályjavaslat csak megbízható eltérésből ---------- */
/** „nagyon eltér” (19/3): a két szó írásképi hasonlósága 50% alatt, vagy számnál eltérő érték */
export function veryDifferent(said: string, heard: string): boolean {
  const a = canonTokens(said).join(' '), b = canonTokens(heard).join(' ')
  const na = canonTokens(said).filter(x => NUMKEY.test(x)), nb = canonTokens(heard).filter(x => NUMKEY.test(x))
  if ((na.length || nb.length) && na.join(',') !== nb.join(',')) return true
  if (!a || !b) return true
  return similarity(a.replace(/\s+/g, ''), b.replace(/\s+/g, '')) < 0.5
}
/** a javaslat feltétele: hangzásra hasonló (nem „nagyon eltér”), vagy ugyanaz az eltérés legalább 2 alkalommal ismétlődött */
export function reliableSuggestion(said: string, heard: string, seenTimes: number): boolean {
  return seenTimes >= 2 || !veryDifferent(said, heard)
}

/* ---------- 3. pont: szavas minősítés ---------- */
export type Rating = 'jó' | 'közepes' | 'gyenge'
/** jó ≥ 90%, közepes 75–89%, gyenge < 75% (később felülvizsgálandó) */
export const rating = (pct: number): Rating => (pct >= 90 ? 'jó' : pct >= 75 ? 'közepes' : 'gyenge')

/* ---------- 17. pont: bizonytalan szavak (csak mérés a teszt ágon) ---------- */
/** a Whisper szövegének azon szavai, amelyekben a két felismerő eltér (a böngésző szövegében nincs megfelelőjük) */
export function uncertainWords(whisper: string, browser: string): string[] {
  if (!browser.trim()) return []
  const B = canonTokens(browser)
  return (whisper || '').split(/\s+/).filter(Boolean).filter(w => { const c = canonTokens(w); return c.length > 0 && !c.every(x => B.some(b => sameWord(b, x))) })
}
/** a bizonytalan-jelölés mérése a felolvasott szöveghez: találati arány, lefedettség, jelölt arány */
export function uncertaintyStats(expected: string, heard: string, flagged: string[]): { precision: number | null; coverage: number | null; share: number; flagged: number; wrong: number; total: number } {
  const diff = wordDiff(expected, heard)
  const fl = new Set(flagged.map(w => canonTokens(w).join(' ')))
  const isF = (w: string) => fl.has(canonTokens(w).join(' '))
  const total = diff.length, wrong = diff.filter(d => !d.ok).length, f = diff.filter(d => isF(d.word))
  const fWrong = f.filter(d => !d.ok).length
  return { precision: f.length ? fWrong / f.length : null, coverage: wrong ? fWrong / wrong : null, share: total ? f.length / total : 0, flagged: f.length, wrong, total }
}
