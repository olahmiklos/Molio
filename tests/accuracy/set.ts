// A diktálás-értelmező pontosságmérésének tesztkészlete (spec v2.3, 16. pont).
// A példák szöveg → elvárt értelmezés párok; az elvárás a szándékból készül (nem az értelmező kimenetéből), hogy a mérés valódi legyen.
// Források: a betanító szöveg mondatai, az „Így diktálj” mintamondatok, az alapszótár szleng-alakjai, a kétértelmű és tizedes esetek.
import { TRAIN_SECTIONS } from '../../app/utils/dict/train'

export interface Example { id: string; src: string; text: string; teeth: number[]; surfaces: Record<number, string>; types: string[]; qty: Record<string, number> }

const TEETH: [number, string[]][] = [
  [36, ['harminchat', '36-os', 'harminc hat', 'bal alsó hatos', 'harminchatos']],
  [16, ['tizenhat', '16-os', 'jobb felső hatos', 'tizenhatos']],
  [25, ['huszonöt', 'bal felső ötös', '25-ös']],
  [47, ['negyvenhét', 'jobb alsó hetes', '47-es']],
  [11, ['tizenegy', 'jobb felső egyes', '11-es']],
  [21, ['huszonegy', 'bal felső egyes']],
  [38, ['harminc nyolc', '38-as', 'bal alsó nyolcas']],
  [44, ['negyvennégy', '44-es', 'jobb alsó négyes']],
]
const OPS: [string, string][] = [['extrakció', 'huzas'], ['foghúzás', 'huzas'], ['gyökérkezelés', 'gyoker'], ['kihúztam', 'huzas'], ['korona előkészítés', 'korona'], ['implantátum beültetés', 'implant']]
const MAT: [string, string, number][] = [
  ['polírpaszta öt darab', 'polir', 5], ['két szuri', 'amp', 2], ['három ampulla', 'amp', 3], ['négy gézlap', 'gez', 4],
  ['két pár kesztyű', 'kesz', 2], ['nyálszívó három darab', 'nyal', 3], ['tíz tampon', 'tamp', 10], ['két guttapercha csúcs', 'gutta', 2],
]

export function buildSet(): Example[] {
  const out: Example[] = []; let n = 0
  const add = (src: string, text: string, e: Partial<Example>) => out.push({ id: `${src}-${++n}`, src, text, teeth: [], surfaces: {}, types: [], qty: {}, ...e })
  // 1) fogszám-alakok × művelet
  TEETH.forEach(([t, forms], ti) => forms.forEach((f, fi) => {
    const [opText, op] = OPS[(ti + fi) % OPS.length]!
    add('fogszám', `Fog ${f}, ${opText}.`, { teeth: [t], types: [op] })
  }))
  // 2) tömés felszínekkel
  const SURF: [string, string][] = [['MO', 'MO'], ['MOD', 'MOD'], ['DO', 'DO'], ['okkluzális', 'O'], ['mezio okkluzális', 'MO']]
  TEETH.slice(0, 6).forEach(([t, forms], i) => SURF.forEach(([s, abbr], j) => {
    if ((i + j) % 2) return
    add('felszín', `${forms[0]}, ${s} kompozit tömés.`, { teeth: [t], surfaces: { [t]: abbr }, types: ['tomes'] })
  }))
  // 3) mennyiségek anyaggal (fog nélkül és fogas mondatban)
  MAT.forEach(([m, id, q]) => {
    add('anyag', `${m[0]!.toUpperCase()}${m.slice(1)}.`, { qty: { [id]: q } })
    add('anyag', `Fog harminchat, extrakció. ${m[0]!.toUpperCase()}${m.slice(1)}.`, { teeth: [36], types: ['huzas'], qty: { [id]: q } })
  })
  // 3b) minden állandó fog számmal: művelet és felszín
  for (const q of [1, 2, 3, 4]) for (let u = 1; u <= 8; u++) {
    const t = q * 10 + u, [opText, op] = OPS[(q + u) % OPS.length]!
    add('fogszám-számjegy', `Fog ${t}-os, ${opText}.`, { teeth: [t], types: [op] })
    if (u <= 7 && (q + u) % 2 === 0) add('felszín-számjegy', `${t} MOD kompozit tömés.`, { teeth: [t], surfaces: { [t]: 'MOD' }, types: ['tomes'] })
  }
  // 3c) mennyiség számjeggyel
  ;([['polírpaszta', 'polir'], ['ampulla', 'amp'], ['gézlap', 'gez'], ['nyálszívó', 'nyal'], ['tampon', 'tamp'], ['vattatampon', 'tamp']] as [string, string][]).forEach(([m, id]) => [2, 3, 4, 6].forEach(q => add('anyag-számjegy', `${m[0]!.toUpperCase()}${m.slice(1)} ${q} darab.`, { qty: { [id]: q } })))
  // 4) tizedes számok
  ;[['három egész hat ml öblítő oldat', 3.6], ['két egész öt ml öblítő oldat', 2.5], ['öt ml öblítő oldat', 5], ['tíz ml öblítő oldat', 10], ['három egész hat ml öblítő', 3.6]].forEach(([t, q]) => add('tizedes', `${t}.`, { qty: { obl: q as number } }))
  // 5) szleng és köznyelvi alakok (alapszótár)
  const SL: [string, Partial<Example>][] = [
    ['harminc hat os fog extrakció', { teeth: [36], types: ['huzas'] }],
    ['jobb fent hatos, kihúztam', { teeth: [16], types: ['huzas'] }],
    ['tejfog jobb felső négyes tömés', { teeth: [54], types: ['tomes'] }],
    ['betömtem a 36-ost', { teeth: [36], types: ['tomes'] }],
    ['36 em ó dé tömés', { teeth: [36], surfaces: { 36: 'MOD' }, types: ['tomes'] }],
    ['polír pasta öt darab', { qty: { polir: 5 } }],
    ['kivettem a nyolcast alul balra', { teeth: [38], types: ['huzas'] }],
    ['gyökér kezelés a 46-oson', { teeth: [46], types: ['gyoker'] }],
    ['koronát csiszoltam a 26-oson', { teeth: [26], types: ['korona'] }],
    ['fogkő eltávolítás', { types: ['fogko'] }],
    ['kontroll vizsgálat', { types: ['kontroll'] }],
  ]
  SL.forEach(([t, e]) => add('szleng', `${t}.`, e))
  // 6) a betanító szöveg mondatai (a felolvasott szöveg elvárt értelmezése)
  const TR: Record<string, Partial<Example>> = {
    t1: { teeth: [36, 16] }, t2: { teeth: [54], types: ['tomes'] }, t3: { teeth: [25, 16], surfaces: { 25: 'MO', 16: 'MOD' }, types: ['tomes'] },
    t4: { teeth: [36, 11], types: ['huzas', 'gyoker'] }, t5: { qty: { polir: 5, amp: 2 } }, t6: { qty: { obl: 3.6 } }, t9: { teeth: [36, 25], surfaces: { 25: 'MO' }, types: ['huzas', 'tomes'], qty: { polir: 5 } },
  }
  TRAIN_SECTIONS.forEach(s => { if (TR[s.id]) add('betanító', s.text, TR[s.id]!) })
  return out
}
