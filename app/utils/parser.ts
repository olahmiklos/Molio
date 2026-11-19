// Szabályalapú szövegértelmezés (1.0 verzió, specifikáció 2.2.1, 2.2.6, 2.2.7)
// A referencia-implementáció a 07_Demo/index.html; ez a modul annak szabályait követi,
// kiegészítve a v1.9 specifikáció szerinti tejfog-, szóbeli fogjelölés- és fogfelszín-felismeréssel.
import { norm } from './dates'
import { applySynonyms } from './codesets'
import type { Dentition, Item, StatusDef, Surface, SurfaceMap, TreatmentType } from './types'
import { allTeeth, dentitionOf, isPrimary, toothRange, validTooth } from './teeth'

export const NUMW: Record<string, number> = {
  egy: 1, egyet: 1, ket: 2, ketto: 2, kettot: 2, harom: 3, harmat: 3, negy: 4, negyet: 4, ot: 5, otot: 5, hat: 6, hatot: 6, het: 7, hetet: 7,
  nyolc: 8, nyolcat: 8, kilenc: 9, kilencet: 9, tiz: 10, tizet: 10, tizenegy: 11, tizenket: 12, tizenketto: 12, tizenot: 15, husz: 20, huszat: 20, harminc: 30,
}

/** a mondat- és tagmondathatár „|” lesz; ezen túl a program nem keres számot */
export function tokenize(text: string): string[] {
  return applySynonyms(text)
    .replace(/[.!?;,:\n]+/g, ' | ')
    .replace(/(\d)([a-z])/g, '$1 $2')
    .replace(/([a-z])(\d)/g, '$1 $2')
    .split(/[^a-z0-9|]+/)
    .filter(Boolean)
}

export function kwPartMatch(tok: string | undefined, part: string) {
  if (!tok || !part) return false
  if (part.endsWith('*')) return tok.startsWith(part.slice(0, -1))
  if (part.length >= 5) return tok.startsWith(part)
  return tok === part
}
/** több szavas kulcsszó is lehet; a visszatérési érték az illeszkedő szavak száma */
export function kwMatchAt(toks: string[], i: number, kw: string) {
  const parts = norm(kw).trim().split(/\s+/)
  for (let k = 0; k < parts.length; k++) if (!kwPartMatch(toks[i + k], parts[k]!)) return 0
  return parts.length
}
export const anyKw = (toks: string[], i: number, list?: string[]) => (list || []).some(kw => kwMatchAt(toks, i, kw) > 0)

export function numVal(tok: string | undefined): number | null {
  if (!tok) return null
  if (/^\d+$/.test(tok)) return parseInt(tok, 10)
  return NUMW[tok] ?? null
}

/* ---------- Fogszám-felismerés ---------- */
const ORD = ['egyes', 'kettes', 'harmas', 'negyes', 'otos', 'hatos', 'hetes', 'nyolcas']
const TENS = ['tizen', 'huszon', 'harminc', 'negyven', 'otven', 'hatvan', 'hetven', 'nyolcvan']
const ROMAN: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5 }
const SUFFIX_RE = /^(os|es|as|ast|est|ost|osre|esre|asra|osra|osnal|esnel|asnal|osat|eset|asat|oson|esen|ason|tol|tal|ig)$/

function ordinalOf(tok: string | undefined): number | null {
  if (!tok) return null
  for (let i = 0; i < ORD.length; i++) if (tok.startsWith(ORD[i]!) && tok.length - ORD[i]!.length <= 4) return i + 1
  return null
}
/** „tizenhatos” = 16, „otvenotos” = 55 */
function fdiWord(tok: string): number | null {
  for (let t = 0; t < TENS.length; t++) {
    if (!tok.startsWith(TENS[t]!)) continue
    const u = ordinalOf(tok.slice(TENS[t]!.length))
    if (u) { const n = (t + 1) * 10 + u; return validTooth(n) ? n : null }
  }
  return null
}
const ABBR_MAP: Record<string, Surface> = { m: 'M', o: 'O', d: 'D', v: 'V', b: 'V', l: 'L', i: 'O' }
const ABBR_BLACK = new Set(['db', 'ml', 'mi', 'dl', 'ii', 'iii', 'iv', 'v', 'i', 'l'])
function abbrev(tok: string | undefined): Surface[] | null {
  if (!tok || ABBR_BLACK.has(tok) || !/^[modvbli]{1,5}$/.test(tok)) return null
  const out = new Set<Surface>(); for (const c of tok) out.add(ABBR_MAP[c]!)
  return [...out]
}
const isSide = (t: string | undefined) => (t === 'jobb' || !!t?.startsWith('jobboldal') ? 'R' : t === 'bal' || !!t?.startsWith('baloldal') ? 'L' : null)
const isJaw = (t: string | undefined) => (t?.startsWith('felso') ? 'U' : t?.startsWith('also') ? 'D' : null)

export interface ToothMention { n: number; start: number; end: number; abbr?: Surface[] }

/** a szövegben elhangzó fogak (FDI-szám, „tizenhatos”, „jobb felső hatos”, „bal alsó római hármas”, „tejfog”) */
export function findTeeth(toks: string[], opts: { wisdomAll?: boolean } = {}): ToothMention[] {
  const out: ToothMention[] = []
  const used = new Set<number>()
  for (let i = 0; i < toks.length; i++) {
    const tk = toks[i]!
    if (tk === '|' || used.has(i)) continue
    // 1) számjegyes FDI: „36-os”, „36 os fog”, „46-osra”, „13-tól”, „36 MO”
    if (/^\d+$/.test(tk)) {
      const n = parseInt(tk, 10)
      if (!validTooth(n)) continue
      const nx = toks[i + 1] || '', nx2 = toks[i + 2] || ''
      let end = -1
      if (SUFFIX_RE.test(nx)) end = i + 1
      else if (nx.startsWith('fog') || nx.startsWith('tejfog')) end = i + 1
      else if (abbrev(nx)) end = i
      if (end < 0) continue
      if (end === i + 1 && (nx2.startsWith('fog') || nx2.startsWith('tejfog'))) end = i + 2
      const ab = abbrev(toks[end + 1]) || (end === i ? abbrev(nx) : null)
      if (ab) end = end === i ? i + 1 : end + 1
      out.push({ n, start: i, end, abbr: ab || undefined })
      for (let k = i; k <= end; k++) used.add(k)
      continue
    }
    // 2) szóval mondott FDI-szám: „tizenhatos”, „harminchatost”
    const fw = fdiWord(tk)
    if (fw) {
      let end = i
      if ((toks[i + 1] || '').startsWith('fog') || (toks[i + 1] || '').startsWith('tejfog')) end = i + 1
      const ab = abbrev(toks[end + 1]); if (ab) end++
      out.push({ n: fw, start: i, end, abbr: ab || undefined })
      for (let k = i; k <= end; k++) used.add(k)
      continue
    }
    // 2b) bölcsességfog: „jobb alsó bölcsességfog” = 48; oldal és állcsont nélkül (csak státusznál) mind a négy: 18, 28, 38, 48
    if (tk.startsWith('bolcsessegfog') || (tk.startsWith('bolcsesseg') && (toks[i + 1] || '').startsWith('fog'))) {
      let side: string | null = null, jaw: string | null = null, first = i
      for (let j = i - 1; j >= Math.max(0, i - 4) && toks[j] !== '|'; j--) {
        const sd = isSide(toks[j]), w = isJaw(toks[j])
        if (sd && !side) { side = sd; first = j } else if (w && !jaw) { jaw = w; first = j } else if (side && jaw) break
      }
      const end = tk.startsWith('bolcsessegfog') ? i : i + 1
      const qs = side && jaw ? [side === 'R' ? (jaw === 'U' ? 1 : 4) : jaw === 'U' ? 2 : 3]
        : side ? (side === 'R' ? [1, 4] : [2, 3]) : jaw ? (jaw === 'U' ? [1, 2] : [4, 3]) : opts.wisdomAll ? [1, 2, 3, 4] : []
      if (qs.length && (side || jaw || opts.wisdomAll)) {
        qs.forEach(q => out.push({ n: q * 10 + 8, start: first, end }))
        for (let k = first; k <= end; k++) used.add(k)
        i = end
        continue
      }
    }
    // 3) oldal + állcsont + sorszám (Zsigmondy-féle szokás): „jobb felső hatos”, „felső jobb hatos”, „bal alsó római hármas”
    let ordIdx = -1, unit: number | null = null, roman = false
    if (tk === 'romai' && ordinalOf(toks[i + 1])) { ordIdx = i + 1; unit = ordinalOf(toks[i + 1]); roman = true }
    else if (ROMAN[tk] && SUFFIX_RE.test(toks[i + 1] || '')) { ordIdx = i + 1; unit = ROMAN[tk]!; roman = true }
    else if (ordinalOf(tk)) { ordIdx = i; unit = ordinalOf(tk) }
    if (unit === null) continue
    let side: string | null = null, jaw: string | null = null, first = i
    for (let j = i - 1; j >= Math.max(0, i - 4) && toks[j] !== '|'; j--) {
      const s = isSide(toks[j]), w = isJaw(toks[j])
      if (s && !side) { side = s; first = j } else if (w && !jaw) { jaw = w; first = j } else if (side && jaw) break
    }
    if (!side || !jaw) continue
    let end = ordIdx
    let primary = roman
    for (let k = ordIdx + 1; k <= ordIdx + 2 && k < toks.length; k++) if (toks[k]!.startsWith('tejfog')) { primary = true; end = k; break }
    if (!primary && (toks[end + 1] || '').startsWith('fog')) end++
    let q = side === 'R' ? (jaw === 'U' ? 1 : 4) : jaw === 'U' ? 2 : 3
    if (primary) { if (unit > 5) continue; q += 4 }
    const n = q * 10 + unit
    if (!validTooth(n)) continue
    out.push({ n, start: first, end })
    for (let k = first; k <= end; k++) used.add(k)
    i = end
  }
  return out.sort((a, b) => a.start - b.start)
}

/* ---------- Fogfelszínek ---------- */
const SURF_STEMS: [string, Surface][] = [
  ['mezi', 'M'], ['mesi', 'M'], ['diszt', 'D'], ['dist', 'D'],
  ['okklu', 'O'], ['occlu', 'O'], ['inciz', 'O'], ['incis', 'O'], ['metszoel', 'O'], ['ragofel', 'O'],
  ['veszt', 'V'], ['vest', 'V'], ['bukk', 'V'], ['bucc', 'V'], ['labial', 'V'],
  ['lingv', 'L'], ['lingu', 'L'], ['palat', 'L'], ['oralis', 'L'], ['oralisan', 'L'],
]
function surfaceWord(toks: string[], i: number): { s: Surface; span: number } | null {
  const t = toks[i]!
  if (t === 'rago' && /^(felsz|felul)/.test(toks[i + 1] || '')) return { s: 'O', span: 2 }
  for (const [stem, s] of SURF_STEMS) if (t.startsWith(stem)) return { s, span: 1 }
  return null
}

export interface ParseResult {
  teeth: number[]
  surfaces: SurfaceMap
  orphanSurfaces: Surface[]
  types: string[]
  /** a diktált teljes mennyiség anyagonként */
  qty: Record<string, number>
  /** „még / plusz N”, amikor előtte nem hangzott el szám: a csomag szerinti mennyiséghez adandó többlet */
  rel: Record<string, number>
  offDentition: number[]
}

/** mennyiségjelző és töltelékszavak a szám és az anyagnév között */
const FILLER = new Set(['darab', 'darabot', 'db', 'adag', 'adagot', 'par', 'part', 'ml', 'kerek', 'kell', 'kellett', 'hasznaltam', 'hasznaltunk', 'ment', 'fogyott', 'el', 'ebbol', 'abbol', 'osszesen', 'kb', 'korulbelul'])
const REL_WORDS = new Set(['meg', 'plusz', 'pluszban', 'tovabbi', 'ujabb'])
/** az anyagnév után álló szám csak akkor mennyiség, ha mértékegység, ige vagy tagmondatvég követi */
const afterNumOk = (t: string | undefined) => !t || t === '|' || FILLER.has(t) || REL_WORDS.has(t) || /^(ot|et|at|ast|est|ost)$/.test(t)

interface ParseCtx { types: TreatmentType[]; items: Item[] }

/** a diktált kezelési szöveg értelmezése */
export function analyze(text: string, st: ParseCtx, opts: { dentition?: Dentition } = {}): ParseResult {
  const toks = tokenize(text)
  const mentions = findTeeth(toks)
  const teeth = new Set<number>(mentions.map(m => m.n))
  const toothIdx = new Set<number>()
  mentions.forEach(m => { for (let k = m.start; k <= m.end; k++) toothIdx.add(k) })
  const types = new Set<string>(), qty: Record<string, number> = {}, last: Record<string, { end: number; def: boolean }> = {}

  // fogfelszínek: rövidítés a fogszám után („36 MO”), vagy felszínnév a tagmondatban;
  // ha a tagmondatban nincs fog, a legutóbb említett foghoz tartozik („a rágófelszínen is tömünk”)
  const surfaces: Record<number, Set<Surface>> = {}
  const addS = (n: number, s: Surface) => { (surfaces[n] = surfaces[n] || new Set()).add(s) }
  mentions.forEach(m => m.abbr?.forEach(s => addS(m.n, s)))
  const clauseOf: number[] = []; let c = 0
  toks.forEach((t, i) => { if (t === '|') c++; clauseOf[i] = c })
  const orphan = new Set<Surface>()
  for (let i = 0; i < toks.length; i++) {
    if (toothIdx.has(i) || toks[i] === '|') continue
    const sw = surfaceWord(toks, i); if (!sw) continue
    const same = mentions.filter(m => clauseOf[m.start] === clauseOf[i])
    let target: ToothMention | undefined
    if (same.length) target = same.slice().sort((a, b) => Math.abs(a.start - i) - Math.abs(b.start - i) || b.start - a.start)[0]
    else target = mentions.filter(m => m.start < i).pop() || mentions.find(m => m.start > i)
    if (target) addS(target.n, sw.s); else orphan.add(sw.s)
    i += sw.span - 1
  }

  // kezeléstípusok
  const typeHit = (i: number) => st.types.filter(t => anyKw(toks, i, t.kw) && !(t.notAfter && i > 0 && anyKw(toks, i - 1, t.notAfter)))
  toks.forEach((_, i) => typeHit(i).forEach(t => types.add(t.id)))
  const isTypeKw = (i: number) => typeHit(i).length > 0

  // anyagok: szavanként a leghosszabb (legkonkrétabb) kulcsszó nyer;
  // egy csoport általános eleme kiesik, ha mellette ugyanabból a csoportból konkrét típus hangzik el
  type Hit = { i: number; span: number; it: Item; sc: number; ext?: number }
  const raw: Hit[] = []
  for (let i = 0; i < toks.length; i++) {
    if (toks[i] === '|' || toothIdx.has(i)) continue
    let best: Hit | null = null
    st.items.forEach(it => (it.kw || []).forEach(kw => {
      const sp = kwMatchAt(toks, i, kw)
      if (sp) { const sc = norm(kw).replace(/[*\s]/g, '').length; if (!best || sc > best.sc) best = { i, span: sp, it, sc } }
    }))
    if (best) { raw.push(best); i += (best as Hit).span - 1 }
  }
  const near = (x: Hit, y: Hit) => Math.abs(x.i - y.i) <= 2 && !toks.slice(Math.min(x.i, y.i), Math.max(x.i, y.i)).includes('|')
  const kept = raw.filter(m => !(m.it.generic && raw.some(o => o !== m && !o.it.generic && o.it.group === m.it.group && near(o, m))))
  // a kiesett általános szó (pl. „mepivakain két ampulla”) a konkrét típus említéséhez tartozik
  raw.filter(m => !kept.includes(m)).forEach(m => {
    const o = kept.find(k => !k.it.generic && k.it.group === m.it.group && near(k, m))
    if (o && m.i > o.i) o.ext = Math.max(o.ext || 0, m.i + m.span - 1)
  })
  const keptIdx = new Set<number>(); kept.forEach(m => { for (let k = 0; k < m.span; k++) keptIdx.add(m.i + k) })
  // mennyiség: a kimondott szám az anyag teljes mennyisége („5 darab polírpaszta” = 5, nem a csomag + különbözet);
  // „még / plusz / további N” a csomaghoz ad hozzá; „3 helyett 5” javítás; puszta említés csak akkor 1, ha számot nem mondtak
  const abs: Record<string, number> = {}, rel: Record<string, number> = {}, bare = new Set<string>()
  const stopAt = (j: number) => toks[j] === '|' || toothIdx.has(j) || keptIdx.has(j) || isTypeKw(j)
  const put = (id: string, n: number, relative: boolean) => { if (relative) rel[id] = (rel[id] || 0) + n; else abs[id] = (abs[id] || 0) + n }
  const isRelAt = (j: number) => REL_WORDS.has(toks[j] || '')
  kept.forEach(m => {
    const it = m.it, i = m.i, span = m.span, L = last[it.id]
    const between = L ? toks.slice(L.end + 1, i) : []
    if (L && i - L.end <= 2 && !between.includes('|') && !between.some((_, k) => keptIdx.has(L.end + 1 + k))) {
      // ugyanaz az említés („érzéstelenítés két ampulla”) – ha közben szám hangzik el, az számít
      if (L.def) for (let j = i - 1; j > L.end; j--) { const n = numVal(toks[j]); if (n !== null) { bare.delete(it.id); put(it.id, n, isRelAt(j - 1)); L.def = false; break } }
      L.end = i + span - 1; return
    }
    let q: number | null = null, qAt = -1
    for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
      if (stopAt(j)) break
      const n = numVal(toks[j]); if (n !== null) { q = n; qAt = j; break }
    }
    let end = Math.max(i + span - 1, m.ext || 0)
    if (q === null && m.ext) for (let j = i + span; j <= m.ext; j++) { const n = numVal(toks[j]); if (n !== null) { q = n; qAt = j; break } }
    // szám az anyag neve után: „polírpaszta 5 darab”, „polírpasztából ötöt kérek”, „polírpasztát 5-öt”
    if (q === null) {
      for (let j = end + 1; j <= Math.min(toks.length - 1, end + 3); j++) {
        if (stopAt(j)) break
        const n = numVal(toks[j])
        if (n !== null) { if (afterNumOk(toks[j + 1])) { q = n; qAt = j; end = Math.max(end, j) } break }
        if (!FILLER.has(toks[j]!) && !REL_WORDS.has(toks[j]!)) break
      }
    }
    // javítás: „3 polírpaszta helyett 5”, „polírpasztából nem 3, hanem 5”
    for (let j = end + 1; j <= Math.min(toks.length - 2, end + 2); j++) {
      if (toks[j] === 'helyett' || toks[j] === 'hanem') { const n = numVal(toks[j + 1]); if (n !== null) { q = n; qAt = j + 1; end = j + 1 } break }
    }
    if (q === null && isTypeKw(end + 1)) { last[it.id] = { end, def: false }; return } // pl. „kompozit tömés” – csak a kezelést jelzi
    const def = q === null
    if (def) bare.add(it.id)
    else put(it.id, q!, isRelAt(qAt - 1) || toks[qAt + 1] === 'pluszban')
    last[it.id] = { end, def }
  })
  // „még N” a már diktált mennyiséghez ad hozzá; ha előtte nem mondtak számot, a csomag szerintihez
  const relPkg: Record<string, number> = {}
  Object.entries(abs).forEach(([id, n]) => { qty[id] = n + (rel[id] || 0) })
  Object.entries(rel).forEach(([id, n]) => { if (abs[id] === undefined) relPkg[id] = n })
  bare.forEach(id => { if (abs[id] === undefined && rel[id] === undefined) qty[id] = 1 })

  const sm: SurfaceMap = {}
  Object.entries(surfaces).forEach(([n, set]) => { sm[n] = [...set] })
  const tl = [...teeth].sort((a, b) => a - b)
  return {
    teeth: tl,
    surfaces: sm,
    orphanSurfaces: [...orphan],
    types: [...types],
    qty,
    rel: relPkg,
    offDentition: opts.dentition ? tl.filter(n => dentitionOf(n) !== opts.dentition) : [],
  }
}

/* ---------- Fogazati státusz diktálással (2.2.6) ---------- */
export const DEFAULT_STATUS_DICT: StatusDef[] = [
  { id: 'ep', name: 'ép', kw: ['ep', 'epek', 'epp'] },
  { id: 'szuvas', name: 'szuvas', kw: ['szuvas*', 'caries*', 'kariesz*'] },
  { id: 'tomott', name: 'tömött', kw: ['tomott*', 'tomes*'] },
  { id: 'gyokerkezelt', name: 'gyökérkezelt', kw: ['gyokerkezelt*', 'gyokertomott*'] },
  { id: 'korona', name: 'korona', kw: ['koron*'] },
  { id: 'hidtag', name: 'hídtag', kw: ['hidtag*'] },
  { id: 'implantatum', name: 'implantátum', kw: ['implant*'] },
  { id: 'hianyzik', name: 'hiányzik', kw: ['hianyz*', 'nincs meg', 'hianyos*', 'extrahalt*', 'kihuzott*'] },
  { id: 'gyokermaradvany', name: 'gyökérmaradvány', kw: ['gyokermaradvany*', 'radix*'] },
]

export interface StatusParse {
  teeth: Record<string, string[]>
  unparsed: string[]
  offDentition: number[]
}

/** teljes fogazati státusz értelmezése („16-os hiányzik, 26-os korona, 13-tól 23-ig ép, a többi ép”) */
export function analyzeStatus(text: string, dict: StatusDef[], dentition: Dentition, opts: { explicitOnly?: boolean } = {}): StatusParse {
  const segs = String(text || '').split(/[.!?;,:\n]+/).map(s => s.trim()).filter(Boolean)
  const res: Record<string, Set<string>> = {}
  const unparsed: string[] = []
  const restStates: string[] = []
  const offD = new Set<number>()
  for (const seg of segs) {
    const toks = tokenize(seg).filter(t => t !== '|')
    const ms = findTeeth(toks, { wisdomAll: true })
    const idx = new Set<number>(); ms.forEach(m => { for (let k = m.start; k <= m.end; k++) idx.add(k) })
    const states = new Set<string>()
    for (let i = 0; i < toks.length; i++) {
      if (idx.has(i)) continue
      for (const d of dict) { const sp = Math.max(0, ...d.kw.map(kw => kwMatchAt(toks, i, kw))); if (sp) { states.add(d.id); i += sp - 1; break } }
    }
    // tartomány: „13-tól 23-ig”
    let teeth: number[] = []
    for (let k = 0; k < ms.length; k++) {
      const m = ms[k]!, nx = ms[k + 1]
      const fromTok = toks[m.end] || ''
      if (nx && /^(tol|tal)$/.test(fromTok) && /^ig$/.test(toks[nx.end] || '')) {
        const r = toothRange(m.n, nx.n); if (r) { teeth.push(...r); k++; continue }
      }
      teeth.push(m.n)
    }
    teeth = [...new Set(teeth)]
    const rest = toks.some(t => t.startsWith('tobbi') || t === 'maradek' || t.startsWith('maradek'))
    if (!states.size || (!teeth.length && !rest)) { unparsed.push(seg); continue }
    if (rest && !teeth.length) { restStates.push(...states); continue }
    teeth.forEach(n => {
      if (dentitionOf(n) !== dentition) offD.add(n)
      res[n] = res[n] || new Set()
      states.forEach(s => res[n]!.add(s))
    })
  }
  if (restStates.length && !opts.explicitOnly) allTeeth(dentition).forEach(n => { if (!res[n]) res[n] = new Set(restStates) })
  const out: Record<string, string[]> = {}
  Object.entries(res).forEach(([n, s]) => { out[n] = [...s] })
  return { teeth: out, unparsed, offDentition: [...offD] }
}

export const isPrimaryTooth = isPrimary

/* ---------- Kezelési tételek: fog × művelet, javaslatok, oldal-ellentmondás (spec v2.1, 2., 4., 12. pont) ---------- */
export interface ItemPair { tooth: number | null; typeId: string }
export interface SuggestPair extends ItemPair { dueDays: number | null; urgent: boolean }
export interface SideConflict { n: number; said: string; expected: string; key: string }
export interface ItemParse {
  /** elvégzett műveletek: fog × művelet, mondatrészenként szétbontva */
  done: ItemPair[]
  /** „szükséges / javasolt / kell” jelzésű, még el nem végzett műveletek */
  suggested: SuggestPair[]
  /** a diktálásban csak javaslatként szereplő fogak (nem elvégzett kezelés) */
  suggestOnlyTeeth: number[]
  /** az elvégzett (nem javaslat) mondatrészekben szereplő kezeléstípusok */
  doneTypes: string[]
  conflicts: SideConflict[]
}
/** a fog említése a javaslat jelzőszavával: „tömés szükséges”, „javasolt”, „kell”, „indokolt”, „érdemes” */
const SUGGEST_CUES = ['szukseges', 'szukseg', 'javasol', 'kell', 'indokol', 'ajanl', 'erdemes', 'tervez', 'esedekes']
const isCue = (t: string | undefined) => !!t && SUGGEST_CUES.some(c => t.startsWith(c)) && !/^(kellett|kellene)/.test(t)
const RECALL_TYPES = new Set(['kontroll', 'fogko'])
const sideOf = (n: number) => { const q = n >= 51 ? quadrantOf(n) - 4 : quadrantOf(n); return q === 1 || q === 4 ? 'jobb' : 'bal' }
const jawOf = (n: number) => { const q = n >= 51 ? quadrantOf(n) - 4 : quadrantOf(n); return q <= 2 ? 'felső' : 'alsó' }
const quadrantOf = (n: number) => Math.floor(n / 10)

/** a „két héten belül”, „fél éven belül”, „egy hónap múlva” határidő napokban */
function dueFrom(toks: string[], from: number, to: number): number | null {
  for (let i = from; i <= to; i++) {
    if (toks[i] === 'fel' && (toks[i + 1] || '').startsWith('ev')) return 182
    const n = numVal(toks[i]); if (n === null) continue
    const u = toks[i + 1] || ''
    if (u.startsWith('het')) return n * 7
    if (u.startsWith('nap')) return n
    if (u.startsWith('honap')) return n * 30
    if (u.startsWith('ev')) return n * 365
  }
  return null
}

export function analyzeItems(text: string, st: ParseCtx): ItemParse {
  const toks = tokenize(text)
  const mentions = findTeeth(toks)
  const typeHit = (i: number) => st.types.filter(t => anyKw(toks, i, t.kw) && !(t.notAfter && i > 0 && anyKw(toks, i - 1, t.notAfter)))
  const toothIdx = new Set<number>(); mentions.forEach(m => { for (let k = m.start; k <= m.end; k++) toothIdx.add(k) })
  const bound = (id: string) => !!st.types.find(t => t.id === id)?.toothBound

  // mondatrészek (a „|” a határ)
  const clauses: { from: number; to: number }[] = []
  let from = 0
  for (let i = 0; i <= toks.length; i++) if (i === toks.length || toks[i] === '|') { if (i > from) clauses.push({ from, to: i - 1 }); from = i + 1 }

  const clauseHasType = (cl: { from: number; to: number }) => { for (let i = cl.from; i <= cl.to; i++) if (!toothIdx.has(i) && typeHit(i).length) return true; return false }
  const done: ItemPair[] = [], suggested: SuggestPair[] = []
  const doneTypes = new Set<string>(), doneTeeth = new Set<number>(), allTeeth = new Set<number>(mentions.map(m => m.n))
  let current: number[] = []
  let lastSug: SuggestPair[] = []
  clauses.forEach((c, ci) => {
    const teeth = [...new Set(mentions.filter(m => m.start >= c.from && m.start <= c.to).map(m => m.n))]
    const types = new Set<string>()
    for (let i = c.from; i <= c.to; i++) if (!toothIdx.has(i)) typeHit(i).forEach(t => types.add(t.id))
    let cue = false
    for (let i = c.from; i <= c.to; i++) if (isCue(toks[i])) cue = true
    // határidő a mondatrészben vagy a következőben: „javasolt a 36-os gyökérkezelése, két héten belül”
    const hasWithin = (cl: { from: number; to: number }) => toks.slice(cl.from, cl.to + 1).some(t => t.startsWith('belul') || t === 'multa' || t === 'mulva')
    const dueHere = hasWithin(c) ? dueFrom(toks, c.from, c.to) : null
    const urgent = toks.slice(c.from, c.to + 1).some(t => t.startsWith('surgos'))
    if (!types.size) {
      // csak fog vagy csak határidő/sürgősség – a korábbi javaslathoz tartozhat
      if (dueHere !== null && lastSug.length) lastSug.forEach(p => { if (p.dueDays === null) p.dueDays = dueHere })
      if (urgent && lastSug.length) lastSug.forEach(p => { p.urgent = true })
      if (teeth.length) current = teeth
      return
    }
    const target = teeth.length ? teeth : current
    if (teeth.length) current = teeth
    const group: SuggestPair[] = []
    types.forEach(id => {
      if (cue) {
        if (RECALL_TYPES.has(id)) return // ismétlődő kontroll: az Emlékeztetők kezeli (spec 8. pont)
        const ts: (number | null)[] = bound(id) ? (target.length ? target : [null]) : [null]
        ts.forEach(t => { const p: SuggestPair = { tooth: t, typeId: id, dueDays: dueHere, urgent }; suggested.push(p); group.push(p) })
        ;(teeth.length ? teeth : target).forEach(t => allTeeth.add(t))
      } else {
        doneTypes.add(id)
        const ts: (number | null)[] = bound(id) ? (target.length ? target : [null]) : [null]
        ts.forEach(t => { if (!done.some(d => d.tooth === t && d.typeId === id)) done.push({ tooth: t, typeId: id }); if (t) doneTeeth.add(t) })
      }
    })
    if (group.length) lastSug = group
    // a következő mondatrész határidőt adhat
    const next = clauses[ci + 1]
    if (group.length && next && hasWithin(next) && !clauseHasType(next)) {
      const d = dueFrom(toks, next.from, next.to); if (d !== null) group.forEach(p => { if (p.dueDays === null) p.dueDays = d })
    }
  })
  // fogak, amelyek csak javaslatban szerepelnek
  const mentionedDone = new Set<number>()
  clauses.forEach(c => {
    const teeth = mentions.filter(m => m.start >= c.from && m.start <= c.to).map(m => m.n)
    let isSug = false, hasType = false
    for (let i = c.from; i <= c.to; i++) { if (isCue(toks[i])) isSug = true; if (!toothIdx.has(i) && typeHit(i).length) hasType = true }
    if (!(isSug && hasType) || !teeth.length) teeth.forEach(t => mentionedDone.add(t))
  })
  const suggestOnlyTeeth = [...allTeeth].filter(n => !mentionedDone.has(n) && suggested.some(s => s.tooth === n))

  // oldal/állcsont ellentmondás: „bal alsó 48-as” – FDI szerint a 48 a jobb alsó
  const conflicts: SideConflict[] = []
  mentions.forEach(m => {
    let side: string | null = null, jaw: string | null = null
    for (let j = m.start - 1; j >= Math.max(0, m.start - 3) && toks[j] !== '|'; j--) {
      const sd = isSide(toks[j]), w = isJaw(toks[j])
      if (sd && !side) side = sd; else if (w && !jaw) jaw = w; else if (!sd && !w) break
    }
    if (!side && !jaw) return
    const es = sideOf(m.n), ej = jawOf(m.n)
    const said = [side && (side === 'R' ? 'jobb' : 'bal'), jaw && (jaw === 'U' ? 'felső' : 'alsó')].filter(Boolean) as string[]
    const sMis = side && (side === 'R' ? 'jobb' : 'bal') !== es
    const jMis = jaw && (jaw === 'U' ? 'felső' : 'alsó') !== ej
    if (sMis || jMis) conflicts.push({ n: m.n, said: (jaw ? [side && (side === 'R' ? 'jobb' : 'bal'), jaw === 'U' ? 'felső' : 'alsó'] : [said[0]]).filter(Boolean).join(' '), expected: `${es} ${ej}`, key: `${m.n}:${said.join(' ')}` })
  })
  return { done, suggested, suggestOnlyTeeth, doneTypes: [...doneTypes], conflicts }
}
