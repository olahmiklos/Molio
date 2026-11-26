// A „Diktálás betanítása” felolvasandó szövege és kiértékelése (spec v2.3, 3. pont): szakaszonként összeveti a felismert szöveget a felolvasottal.
// Tiszta függvények (tesztelhető); a felület (DictTrain.vue) csak a felvételt és a megjelenítést végzi.
import { norm } from '../dates'
import { analyze, type ParseResult } from '../parser'
import { lev } from './similar'
import { canonSpans } from './quality'
import { preprocess, type PersonalRule } from './pipeline'
import type { Vocab } from './vocab'
import type { Item, TreatmentType } from '../types'

export interface TrainSection { id: string; title: string; text: string }
/** kb. 2 perc felolvasás; fogszám számmal és szóval, tejfog, felszín, állapot, művelet, anyag, mennyiség, tizedes, kétértelmű kifejezés, „így diktálj” mintamondat */
export const TRAIN_SECTIONS: TrainSection[] = [
  { id: 't1', title: '1. Fogszámok számmal és szóval', text: 'Fog harminchat. Fog 36-os. Fog harminc-hat. Jobb fent hatos.' },
  { id: 't2', title: '2. Tejfog', text: 'Tejfog jobb felső négyes, tömés.' },
  { id: 't3', title: '3. Felszínek, rövidítések', text: 'Fog huszonöt, MO kompozit tömés. Fog tizenhat, MOD tömés.' },
  { id: 't4', title: '4. Műveletek', text: 'Fog harminchat, extrakció. Fog tizenegy, gyökérkezelés.' },
  { id: 't5', title: '5. Anyagok, mennyiség', text: 'Polírpaszta öt darab. Két szuri.' },
  { id: 't6', title: '6. Tizedes szám', text: 'Három egész hat ml öblítő oldat.' },
  { id: 't7', title: '7. Állapot', text: 'Fog negyvenhét, szuvas.' },
  { id: 't8', title: '8. Kétértelmű kifejezés', text: 'Három hatos injekció.' },
  { id: 't9', title: '9. Így diktálj – mintamondatok', text: 'Fog harminchat, extrakció. Fog huszonöt, MO kompozit tömés. Polírpaszta öt darab.' },
]

export const CATS = ['fogszám', 'felszín', 'művelet', 'anyag', 'mennyiség'] as const
export type Cat = typeof CATS[number]
export interface Facts { fogszám: string[]; felszín: string[]; művelet: string[]; anyag: string[]; mennyiség: string[] }

export function facts(text: string, ctx: { items: Item[]; types: TreatmentType[]; vocab?: Vocab; personal?: PersonalRule[] }): Facts {
  const p = preprocess(text, { vocab: ctx.vocab, personal: ctx.personal })
  const r: ParseResult = analyze(p.text, { items: ctx.items, types: ctx.types })
  return {
    fogszám: [...r.teeth].map(String),
    felszín: Object.entries(r.surfaces).flatMap(([t, s]) => [...s].map(x => `${t}${x}`)),
    művelet: [...r.types],
    anyag: Object.keys(r.qty),
    mennyiség: Object.entries(r.qty).map(([k, v]) => `${k}=${v}`),
  }
}
export interface Score { total: number; ok: number; byCat: Record<Cat, { total: number; ok: number }> }
/** a hallott szöveg tényei a felolvasott szöveg tényeihez képest: mennyi van meg belőle (extra elem nem büntet, de a „hiányzó” igen) */
export function score(ref: Facts, hyp: Facts): Score {
  const byCat = {} as Score['byCat']; let total = 0, ok = 0
  for (const c of CATS) { const t = ref[c].length, o = ref[c].filter(x => hyp[c].includes(x)).length; byCat[c] = { total: t, ok: o }; total += t; ok += o }
  return { total, ok, byCat }
}
export interface Wrong { said: string; heard: string; cat: string }
/** a kijelzett alak: az eredeti (ékezetes) szó; a mondatkezdő nagybetű nélkül, a csupa nagybetűs rövidítés (MO, MOD) marad */
const shownForm = (s: string) => (s.length > 1 && s === s.toUpperCase() && s !== s.toLowerCase() ? s : s.toLocaleLowerCase('hu'))
/** két eltérés ugyanaz-e (ékezettől, kis-nagybetűtől függetlenül; a régebbi, ékezet nélkül mentett betanítási eltérésekkel is összevethető) */
export const sameWrong = (x: { said: string; heard: string }, y: { said: string; heard: string }) => norm(x.said).trim() === norm(y.said).trim() && norm(x.heard).trim() === norm(y.heard).trim()
/** rosszul felismert kifejezések: a felolvasott szó, amely nincs a hallott szövegben, és a hozzá legközelebbi, felesleges hallott szó.
 * A szavak érték szerint párosulnak (B-017: „36-os” = „harminchatos”, „harminc-hat” = „harminchat”, „három egész hat” = „3,6”), darabszám szerint;
 * a kijelzés az eredeti, ékezetes alakot mutatja (B-019). */
export function wrongTerms(said: string, heard: string, catOf: (w: string) => string = () => 'szöveg'): Wrong[] {
  const a = canonSpans(said), b = canonSpans(heard)
  const used = new Array(b.length).fill(false), hit = new Array(a.length).fill(false)
  // azonos érték / azonos szó (a ragozott alakokat a hívó szűri: sameWord)
  a.forEach((w, i) => { const j = b.findIndex((x, k) => !used[k] && x.key === w.key); if (j >= 0) { used[j] = true; hit[i] = true } })
  const out: Wrong[] = []
  a.forEach((w, i) => {
    if (hit[i]) return
    let best = -1, d = 99
    const wn = w.norm.replace(/\s+/g, '')
    b.forEach((x, k) => { if (used[k]) return; const l = lev(wn, x.norm.replace(/\s+/g, '')); if (l < d && l <= Math.max(3, Math.ceil(wn.length * 0.6))) { d = l; best = k } })
    if (best >= 0) used[best] = true
    out.push({ said: shownForm(w.orig), heard: best >= 0 ? shownForm(b[best]!.orig) : '(kimaradt)', cat: catOf(w.norm) })
  })
  return out
}
export const pct = (ok: number, total: number) => total ? Math.round(ok / total * 100) : 100
