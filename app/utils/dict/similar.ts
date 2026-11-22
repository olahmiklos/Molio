// Hasonlóság szerinti egyeztetés (spec v2.3, 10. pont): a soha nem látott elírást / félrehallást is a szótár legközelebbi kifejezéséhez közelíti, AI nélkül.
import { norm } from '../dates'

export const THRESHOLDS = { strict: 0.88, medium: 0.8, loose: 0.72 } as const
export type ThresholdKey = keyof typeof THRESHOLDS

/** magyar hangtévesztések (ty–gy, cs–ts, sz–s, kettőzött mássalhangzó, hosszú/rövid magánhangzó – ékezet nélkül már azonos) kiegyenlítése */
export function phon(w: string): string {
  return norm(w).replace(/ty/g, 'gy').replace(/ts/g, 'cs').replace(/sz/g, 's').replace(/zs/g, 'z').replace(/dzs/g, 'cs').replace(/ck/g, 'k').replace(/([b-df-hj-np-tv-z])\1+/g, '$1').replace(/[^a-z0-9]/g, '')
}
export function lev(a: string, b: string): number {
  const m = a.length, n = b.length
  if (!m) return n
  if (!n) return m
  let prev = Array.from({ length: n + 1 }, (_, j) => j), cur = new Array<number>(n + 1)
  for (let i = 1; i <= m; i++) {
    cur[0] = i
    for (let j = 1; j <= n; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + c)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cur[j] = Math.min(cur[j]!, prev[j - 2]! + 1) // betűcsere
    }
    ;[prev, cur] = [cur, prev]
  }
  return prev[n]!
}
/** hasonlóság 0…1; a ragozott alak (a szótári szó + legfeljebb 4 betű toldalék) is egyezésnek számít */
export function similarity(token: string, word: string): number {
  const a = phon(token), b = phon(word)
  if (!a || !b) return 0
  let best = 1 - lev(a, b) / Math.max(a.length, b.length)
  if (a.length > b.length && a.length - b.length <= 4) for (const cut of [b.length - 1, b.length, b.length + 1]) {
    if (cut < 4 || cut > a.length) continue
    best = Math.max(best, 1 - lev(a.slice(0, cut), b) / Math.max(cut, b.length) - 0.02)
  }
  return best
}
export interface VocabEntry { word: string; label: string; cat: string }
export interface Match { word: string; label: string; cat: string; score: number }
/** a legjobb 1–2 találat (küszöb fölött); a számokra és a rövid szavakra nem fut */
export function nearest(token: string, vocab: VocabEntry[], threshold: number, n = 2): Match[] {
  if (token.length < 6 || /\d/.test(token)) return []
  const best = new Map<string, Match>()
  for (const v of vocab) {
    const s = similarity(token, v.word)
    if (s >= threshold && (!best.has(v.word) || best.get(v.word)!.score < s)) best.set(v.word, { ...v, score: s })
  }
  return [...best.values()].sort((a, b) => b.score - a.score).slice(0, n)
}
