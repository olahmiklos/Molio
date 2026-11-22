// Diktálási alapszótár (spec v2.3, 4. pont): szleng / köznyelvi kifejezés → hivatalos elnevezés.
// A táblázat sorai (SZ-001…SZ-131) betöltéskor szinonimaszabályokká válnak; a demóban mind a 131 sor működik, ellenőrzési állapot nélkül.
import { norm } from '../dates'
import { BASE_RAW } from './baseData'

export interface BaseRow { id: string; cat: string; forms: string[]; official: string; code: string; note: string }
export const BASE_VERSION = { version: 'v0.1', date: '2026. 11. 22.', rows: 131 }

export const BASE_ROWS: BaseRow[] = BASE_RAW.split('\n').map(l => {
  const [id, cat, forms, official, code, note] = l.split('|')
  return { id: id!, cat: cat!, forms: forms!.split(';').map(x => x.trim()).filter(Boolean), official: official!, code: code!, note: note || '' }
})

/** a szótár sorának kódja → az értelmezőben (kulcsszavak, kódkészletek) már ismert alak; ahol nincs, a sor csak „ismert kifejezés”, tételt nem hoz létre a demó katalógusában */
const CANON: Record<string, string> = {
  // fogszám-pozíciók
  x1: 'egyes', x2: 'kettes', x3: 'harmas', x4: 'negyes', x5: 'otos', x6: 'hatos', x7: 'hetes', x8: 'nyolcas',
  // felszínek
  M: 'mezialis', D: 'disztalis', O: 'okkluzalis', I: 'okkluzalis', B: 'bukkalis', V: 'vesztibularis', L: 'lingualis', P: 'palatinalis',
  // fogállapotok
  HIANYZIK: 'hianyzik', EXTRAHALVA: 'extrahalt', SZUVAS: 'szuvas', TOMOTT: 'tomott', KORONA: 'koronas', IMPLANTATUM: 'implantatum', HID: 'hidtag', GYOKERMARADVANY: 'gyokermaradvany',
  GYOKERKEZELT: 'gyokerkezelt', EP: 'ep', MOZGATHATO: 'mozgathato', RETINEALT: 'retinealt', TOROTT: 'torott',
  // műveletek
  EXTRAKCIO: 'extrakcio', TOMES: 'tomtem', TOMES_KOMPOZIT: 'kompozit tomes', GYOKERKEZELES: 'gyokerkezeles', TREPANACIO: 'trepanaltam', FOGKO_ELTAVOLITAS: 'fogkoeltavolitas',
  ERZESTELENITES: 'erzestelenites', KONTROLL: 'kontroll', ALLAPOTFELMERES: 'allapotfelmeres', PREPARALAS: 'preparalas', VARRAS: 'varrtam', VARRATSZEDES: 'szalszedes',
  // anyagok
  ANYAG_ERZESTELENITO: 'ampulla', ANYAG_TAMPON: 'tampon', ANYAG_GEZ: 'gezlap', ANYAG_POLIRPASZTA: 'polirpaszta', ANYAG_KOMPOZIT: 'kompozit', ANYAG_BONDING: 'bond', ANYAG_SAVAZO: 'savazo',
  ANYAG_TAGITO: 'reszelo', ANYAG_GUTTAPERCHA: 'guttapercha', ANYAG_NAOCL: 'hipoklorit', ANYAG_LENYOMAT: 'lenyomat', ANYAG_IDEIGLENES: 'ideiglenes', ANYAG_VARROFONAL: 'varrofonal',
  ANYAG_KESZTYU: 'kesztyu', ANYAG_NYALSZIVO: 'nyalszivo',
}
/** kétértelmű vagy túl rövid / köznapi alak: nem íródik át csendben (kontextus vagy ⚠ dönt) */
const NO_AUTO = new Set(['kivettem', 'leszedtem', 'tu', 'tut', 'sav', 'dam', 'tej', 'ep', 'rago', 'laza', 'csavar', 'mod', 'ment', 'na', 'akkor', 'par', 'fel', 'kicsit', 'ek', 'fonal', 'lakk', 'felul', 'alul', 'hipo', 'file', 'fajl', 'gutta', 'mo', 'felvetel', 'szuri', 'injekcio', 'ragaszto', 'tomes', 'tomtem', 'huzas', 'plomba', 'sapka'])
/** köznapi, de egyértelműen leképezhető alakok pótlása (a NO_AUTO miatt kimaradt fontos szinonimák) */
const EXTRA: [string, string][] = [['szuri', 'ampulla'], ['injekcio', 'ampulla'], ['plomba', 'tomott'], ['sapka', 'koronas'], ['sapkas', 'koronas'], ['hipo', 'hipoklorit'], ['gutta', 'guttapercha'],
  ['jobb fent', 'jobb felso'], ['jobb lent', 'jobb also'], ['bal fent', 'bal felso'], ['bal lent', 'bal also'], ['meziookkluzalis', 'mezialis okkluzalis'], ['disztookkluzalis', 'disztalis okkluzalis'],
  ['mezio okkluzalis', 'mezialis okkluzalis'], ['diszto okkluzalis', 'disztalis okkluzalis'], ['meziookkluzodisztalis', 'mezialis okkluzalis disztalis'], ['em o de', 'mod'], ['em o', 'mo'], ['de o', 'do'], ['emode', 'mod'], ['emo', 'mo'],
  ['kerem', 'kerek'], ['kesztyut', 'kesztyu']]

/** a végleges alak (kód) szerinti leképezés: [elhangzó alak (ékezet nélkül), kanonikus alak] */
export function baseRules(): [string, string][] {
  const out = new Map<string, string>()
  BASE_ROWS.forEach(r => {
    const to = CANON[r.code]
    if (!to) return
    r.forms.forEach(f => {
      if (/[\[\]]/.test(f)) return
      const from = norm(f).replace(/[-]/g, ' ').replace(/\s+/g, ' ').trim()
      if (!from || from === to || NO_AUTO.has(from) || (from.length < 4 && !from.includes(' '))) return
      // a Fogszám-sorok kódja (x1…) csak a pozíciónevekre vonatkozik
      if (r.cat === 'Fogszám' && !/^x\d$/.test(r.code)) return
      if (r.cat === 'Művelet' && r.code === 'TOMES' && (from === 'tomes' || from === 'tomtem')) return
      out.set(from, to)
    })
  })
  EXTRA.forEach(([a, b]) => out.set(a, b))
  // a hangfelismerési tévesztések (SZ-118…127) közvetlen javítások
  ;[['polir pasta', 'polirpaszta'], ['polir paszta', 'polirpaszta'], ['polirpasta', 'polirpaszta'], ['extra kcio', 'extrakcio'], ['extra halas', 'extrakcio'], ['trepanal tam', 'trepanaltam'], ['trepanalt am', 'trepanaltam'],
    ['kofer dam', 'kofferdam'], ['koffer dam', 'kofferdam'], ['okkluzialis', 'okkluzalis'], ['okluzalis', 'okkluzalis']].forEach(([a, b]) => out.set(a!, b!))
  return [...out.entries()].sort((a, b) => b[0].length - a[0].length)
}

let compiled: { re: RegExp; map: Map<string, string> } | null = null
function compile() {
  if (compiled) return compiled
  const rules = baseRules()
  const map = new Map(rules)
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+')
  compiled = { re: new RegExp(`(?<![a-z0-9])(?:${rules.map(r => esc(r[0])).join('|')})(?![a-z0-9])`, 'g'), map }
  return compiled
}

/** a fogszámok más formáiban mondott alakjainak egységesítése: „harminc hat os”, „3-6”, „30 6-os”, „tejfog jobb felső négyes” */
export function fuseTeeth(t: string): string {
  const U: Record<string, string> = { egy: 'egyes', ket: 'kettes', ketto: 'kettes', harom: 'harmas', negy: 'negyes', ot: 'otos', hat: 'hatos', het: 'hetes', nyolc: 'nyolcas' }
  const TENS = 'tizen|huszon|harminc|negyven|otven|hatvan|hetven|nyolcvan'
  const UNITS = Object.keys(U).sort((a, b) => b.length - a.length).join('|')
  // „harminc hat os”, „harminc-hat-os”, „harminc hatos” → „harminchatos”
  t = t.replace(new RegExp(`(?<![a-z])(${TENS})[\\s-]*(${UNITS})(?:[\\s-]*(?:os|es|as))?(?![a-z])`, 'g'), (_m, ten: string, u: string) => ten + U[u])
  // „30 6-os” → „36-os”
  t = t.replace(/(?<![\d.,])([1-8])0\s+([1-8])[\s-]*(os|es|as)(?![a-z])/g, '$1$2-$3')
  // „három-hat”, „hármas-hatos” (kötőjellel mondott kvadráns + pozíció)
  const Q: Record<string, number> = { egy: 1, egyes: 1, ket: 2, kettes: 2, harom: 3, harmas: 3, negy: 4, negyes: 4 }
  const P: Record<string, number> = { egy: 1, egyes: 1, ket: 2, kettes: 2, harom: 3, harmas: 3, negy: 4, negyes: 4, ot: 5, otos: 5, hat: 6, hatos: 6, het: 7, hetes: 7, nyolc: 8, nyolcas: 8 }
  t = t.replace(/(?<![a-z-])(egyes|kettes|harmas|negyes|egy|ket|harom|negy)-(egyes|kettes|harmas|negyes|otos|hatos|hetes|nyolcas|egy|ket|harom|negy|ot|hat|het|nyolc)(?:-?(?:os|es|as))?(?![a-z-])/g, (_m, q: string, p: string) => `${Q[q]}${P[p]}-os`)
  // tejfog előre: „tejfog jobb felső négyes”, „jobb felső tej négyes” → „jobb felső négyes tejfog”
  t = t.replace(/tejfog\s+(jobb|bal)\s+(felso|also)\s+([a-z]+)/g, '$1 $2 $3 tejfog').replace(/(jobb|bal)\s+(felso|also)\s+tej\s+([a-z]+)/g, '$1 $2 $3 tejfog')
  return t
}

export interface BaseHit { from: string; to: string }
/** az alapszótár szabályainak alkalmazása a (kisbetűs, ékezet nélküli) szövegen; visszaadja a változásokat is */
export function applyBase(text: string): { text: string; hits: BaseHit[] } {
  const hits: BaseHit[] = []
  let t = ' ' + fuseTeeth(text) + ' '
  const c = compile()
  t = t.replace(c.re, m => { const k = m.replace(/\s+/g, ' ').trim(), to = c.map.get(k); if (to === undefined) return m; hits.push({ from: k, to }); return to })
  return { text: t.trim(), hits }
}

/** a szótár összes „elhangzó alakja” (normalizált) – az ismert kifejezések halmazához */
export function baseWords(): { word: string; label: string; cat: string }[] {
  const out: { word: string; label: string; cat: string }[] = []
  BASE_ROWS.forEach(r => r.forms.forEach(f => {
    if (/[\[\]]/.test(f)) return
    norm(f).split(/[^a-z0-9]+/).filter(w => w.length >= 5).forEach(w => out.push({ word: w, label: f, cat: r.cat }))
  }))
  return out
}
export const FILLER_FORMS = new Set(BASE_ROWS.filter(r => r.cat === 'Töltelékszó').flatMap(r => r.forms.map(norm)))

/** a szótár sora átírást végez-e (az értelmezőben ismert alakra képezi), vagy csak „ismert kifejezés” (a demó katalógusában nincs hozzá tétel) */
export function rowActive(r: BaseRow): boolean {
  const m = new Map(baseRules())
  return r.forms.some(f => m.has(norm(f).replace(/-/g, ' ').replace(/\s+/g, ' ').trim())) || ['x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7', 'x8'].includes(r.code) || r.cat === 'Töltelékszó' || r.cat === 'Mennyiség' || r.cat === 'Javaslat-jelző' || r.id === 'SZ-005' || /^SZ-00[1-4]$/.test(r.id)
}
