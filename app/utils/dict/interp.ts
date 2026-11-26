// v2.5 4. pont: értelmezési és szakszó-javítás tanulása és mérése (a v2.4 6. pont hiányzó része). Tiszta függvények.
// Ha a felismert szöveg jó volt, de az értelmezés tévedett (kézzel javított mennyiség / anyag, a ⚠ sorban választott fog,
// művelet vagy anyag), a javításból külön jóváhagyás nélkül szabály lesz: „kifejezés → tétel / anyag / fogszám / mennyiség”
// (pl. „kérek öt tampont” → Vattatampon 5 db), és a következő diktálástól érvényes. Az értelmezési szabály a rendelő minden
// felhasználójára szól. Csak a javított részlet tárolódik (a kifejezés és a helyes érték, kategória); teljes mondat és hang nem.
import { norm } from '../dates'
import { looksPersonal } from './learn'

export type InterpCat = 'anyag' | 'mennyiség' | 'fogszám' | 'művelet'
export interface InterpRule {
  id: string
  /** a kifejezés (normalizált, kisbetűs, ékezet nélküli) – a diktált szövegben szóhatáron kell előfordulnia */
  phrase: string
  cat: InterpCat
  /** anyag / mennyiség: a tétel és a mennyiség */
  item?: string
  qty?: number
  /** fogszám: a félreértett és a helyes fog */
  fromTooth?: number
  tooth?: number | null
  /** művelet: a hozzáadandó kezelés (a foghoz, ha volt) */
  typeId?: string
  active: boolean
  created: string
  source: 'javitas' | 'kozponti'
  scope: 'rendelo'
  branch?: string
  /** mérés: hányszor futott le, hányszor kellett utána mégis javítani (visszavonás vagy eltérő kézi érték) */
  uses?: number
  corrected?: number
  /** megjelenítéshez: „kifejezés” → „eredmény” */
  from: string
  to: string
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
/** mondatrészek a feldolgozott (normalizált) szövegben: vessző, pont, pontosvessző, „|”, valamint az „és” / „majd” kötőszó a határ */
export function clauses(text: string): string[] {
  return norm(text || '').split(/[,.;:!?|]+|\s(?:es|majd|meg)\s/).map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean)
}
/** a kifejezés legfeljebb 7 szóig (a hosszabb mondatrész túl ritkán ismétlődne szó szerint) */
const clip = (c: string) => c.split(' ').slice(-7).join(' ')
/** az a mondatrész, amelyik az adott tétel kulcsszavát tartalmazza (pl. a „tampon*” kulcsszó a „kerek ot tampont” részben) */
export function clauseWithKw(text: string, kws: string[]): string | null {
  const ks = kws.map(k => norm(k)).filter(Boolean)
  for (const c of clauses(text)) {
    const toks = c.split(' ')
    if (toks.some(t => ks.some(k => (k.endsWith('*') ? t.startsWith(k.slice(0, -1)) : t === k)))) return clip(c)
  }
  return null
}
/** az a mondatrész, amelyik a megadott (ismeretlen) szavak egyikét tartalmazza */
export function clauseWithWord(text: string, words: string[]): string | null {
  const ws = words.map(w => norm(w)).filter(Boolean)
  for (const c of clauses(text)) if (c.split(' ').some(t => ws.includes(t))) return clip(c)
  return null
}
/** az a mondatrész, amelyik a fogszámot tartalmazza (számjeggyel a feldolgozott szövegben) */
export function clauseWithTooth(text: string, n: number): string | null {
  for (const c of clauses(text)) if (c.split(' ').some(t => t.replace(/[^0-9]/g, '') === String(n))) return clip(c)
  return null
}
/** a szabály kifejezése előfordul-e a szövegben (szóhatáron) */
export function phraseIn(text: string, phrase: string): boolean {
  const p = norm(phrase).trim(); if (!p) return false
  return new RegExp(`(?<![a-z0-9])${esc(p)}(?![a-z0-9])`).test(norm(text || ''))
}
/** a szövegre illeszkedő, bekapcsolt szabályok (a kihagyottak nélkül) */
export function matchRules(text: string, rules: InterpRule[], skip: string[] = []): InterpRule[] {
  return rules.filter(r => r.active && !skip.includes(r.id) && phraseIn(text, r.phrase))
}
/** azonos célra (kifejezés + tétel / fog / művelet) vonatkozó szabály: ellentmondásnál a legutóbbi érvényes */
export const sameTarget = (a: Pick<InterpRule, 'phrase' | 'cat' | 'item' | 'fromTooth' | 'typeId'>, b: Pick<InterpRule, 'phrase' | 'cat' | 'item' | 'fromTooth' | 'typeId'>) =>
  norm(a.phrase) === norm(b.phrase) && ((a.item && a.item === b.item) || (a.fromTooth !== undefined && a.fromTooth === b.fromTooth) || (a.cat === 'művelet' && b.cat === 'művelet' && a.typeId === b.typeId))
/** a szabály eredménye eltér-e (ütközés) */
export const differs = (a: InterpRule, b: Partial<InterpRule>) => a.qty !== b.qty || a.tooth !== b.tooth || a.typeId !== b.typeId || a.item !== b.item
/** személynévnek / azonosítónak látszó kifejezésből nem lesz szabály (a központi mentés előtt is kiszűrve) */
export const safePhrase = (p: string | null | undefined): p is string => !!p && p.trim().length >= 2 && !looksPersonal(p) && !/\d[\d\s-]{5,}\d/.test(p)
/** mérés: a lefutások és az utólagos javítások aránya (0–1); lefutás nélkül null */
export const correctionRate = (r: Pick<InterpRule, 'uses' | 'corrected'>) => ((r.uses || 0) > 0 ? (r.corrected || 0) / (r.uses || 1) : null)
