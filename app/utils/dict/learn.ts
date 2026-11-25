// Öntanulás (spec v2.4 6. pont): a kézi javításból automatikusan tanult szabály. Tiszta függvények.
// Csak a javított részlet tárolódik (hallott és helyes alak, kategória); a teljes mondat és a hang nem.
import { norm } from '../dates'
import { canonTokens } from './quality'

/** személynévnek vagy azonosítónak látszó szó (a központi mentés előtt kiszűrendő): hosszú számsor, e-mail, nagybetűs kéttagú név */
export function looksPersonal(s: string): boolean {
  const t = (s || '').trim()
  if (/\d[\d\s-]{5,}\d/.test(t)) return true
  if (/@/.test(t)) return true
  if (/^(dr\.?\s+)?[A-ZÁÉÍÓÖŐÚÜŰ][a-záéíóöőúüű]+\s+[A-ZÁÉÍÓÖŐÚÜŰ][a-záéíóöőúüű]+$/.test(t)) return true
  return false
}
/** a kategória becslése: fogszám / művelet / anyag / mennyiség / egyéb */
export function guessCat(to: string, ctx: { typeWords: string[]; itemWords: string[] }): string {
  const c = canonTokens(to)
  if (c.some(x => /^\d+$/.test(x) && Number(x) >= 11 && Number(x) <= 85)) return 'fogszám'
  if (c.some(x => /^\d+$/.test(x))) return 'mennyiség'
  const n = norm(to)
  if (ctx.typeWords.some(w => w && n.includes(w))) return 'művelet'
  if (ctx.itemWords.some(w => w && n.includes(w))) return 'anyag'
  return 'egyéb'
}
/** a kiejtési / felismerési javítás a beszélőre szól; a szakszó- és értelmezési javítás a rendelő minden felhasználójára */
export const scopeOf = (cat: string): 'szemely' | 'rendelo' => (cat === 'egyéb' ? 'szemely' : 'rendelo')
/** fogszámot, műveletet vagy anyagot módosító tanult szabály: az első alkalmazáskor jelölést kap és egy koppintással visszavonható */
export const isRiskyCat = (cat?: string) => cat === 'fogszám' || cat === 'művelet' || cat === 'anyag'

/** szavankénti cserék a felismert és a javított szöveg között (azonos hosszú szakaszok illesztésével, LCS alapján) */
export function correctionPairs(orig: string, fixed: string): [string, string][] {
  const A = orig.split(/\s+/).filter(Boolean), B = fixed.split(/\s+/).filter(Boolean)
  const k = (w: string) => norm(w).replace(/[^a-z0-9]/g, '')
  const dp: number[][] = Array.from({ length: A.length + 1 }, () => new Array(B.length + 1).fill(0))
  for (let i = A.length - 1; i >= 0; i--) for (let j = B.length - 1; j >= 0; j--) dp[i]![j] = k(A[i]!) === k(B[j]!) ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!)
  const out: [string, string][] = []
  let i = 0, j = 0, ga: string[] = [], gb: string[] = []
  const flush = () => { if (ga.length && gb.length && ga.length <= 3 && gb.length <= 4) out.push([ga.join(' ').replace(/[.,;:!?]+$/, ''), gb.join(' ').replace(/[.,;:!?]+$/, '')]); ga = []; gb = [] }
  while (i < A.length && j < B.length) {
    if (k(A[i]!) === k(B[j]!)) { flush(); i++; j++ }
    else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) ga.push(A[i++]!)
    else gb.push(B[j++]!)
  }
  while (i < A.length) ga.push(A[i++]!)
  while (j < B.length) gb.push(B[j++]!)
  flush()
  return out.filter(([a, b]) => a && b && k(a) !== k(b))
}
