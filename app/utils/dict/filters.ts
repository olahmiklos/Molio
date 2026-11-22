// Whisper-kitalációk szűrése (spec v2.3, 13. pont): csendes / zajos szakaszra „hallott”, el nem hangzott szöveg, ismétlések, valószínűtlenül sűrű átirat.
import { norm } from '../dates'

export const HALLU_VERSION = { version: '1.0', date: '2026. 11. 22.' }
/** ismert, tipikusan kitalált mondatok (ékezet nélkül, kisbetűvel; magyarul és angolul) */
export const DEFAULT_HALLU = [
  'koszonom a figyelmet', 'koszonom a figyelmeteket', 'koszonjuk a figyelmet', 'koszonom hogy megnezted', 'koszonom hogy megnezted a videot', 'koszonjuk hogy megnezted',
  'koszonom hogy velem voltatok', 'viszlat', 'a kovetkezo videoban talalkozunk', 'kovetkezo videoban', 'feliratozta', 'feliratok', 'magyar felirat', 'forditas es feliratozas',
  'iratkozz fel', 'iratkozzatok fel', 'iratkozz fel a csatornara', 'kattints a feliratkozas gombra', 'nyomj egy like ot', 'tetszett a video', 'hagyj egy kommentet',
  'thanks for watching', 'thank you for watching', 'thank you', 'subtitles by', 'please subscribe', 'like and subscribe', 'see you next time', 'amara org',
]
export interface HalluResult { text: string; removed: string[]; repeats: string[] }

const splitClauses = (t: string) => t.split(/(?<=[.!?])\s+|\n+/).map(x => x.trim()).filter(Boolean)
const key = (s: string) => norm(s).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()

/** kitalált mondatok eltávolítása; a Whisper néha az egész kimenetet ilyenre cseréli */
export function filterHallucinations(text: string, list: string[] = DEFAULT_HALLU): HalluResult {
  const removed: string[] = [], keep: string[] = []
  const L = list.map(key).filter(Boolean)
  splitClauses(text).forEach(c => {
    const k = key(c)
    // a kitalált mondat teljes egészében, vagy a mondat elején / végén áll (pl. „…tömés. Köszönöm a figyelmet”)
    const hit = L.find(h => k === h || k.startsWith(h + ' ') || k.endsWith(' ' + h))
    if (hit && k.split(' ').length <= hit.split(' ').length + 3) removed.push(c)
    else keep.push(c)
  })
  return { text: keep.join(' '), removed, repeats: [] }
}

/** ugyanaz a szó / mondatrész 3-nál többször egymás után: csak egyszer marad meg, ⚠ jelzéssel */
export function collapseRepeats(text: string, limit = 3): { text: string; repeats: string[] } {
  const repeats: string[] = []
  const toks = text.split(/\s+/).filter(Boolean)
  const out: string[] = []
  for (let i = 0; i < toks.length;) {
    let done = false
    for (let n = 1; n <= 4 && !done; n++) {
      const unit = toks.slice(i, i + n).map(key).join(' ')
      if (!unit || /^\d+$/.test(unit)) continue
      let rep = 1
      while (toks.slice(i + rep * n, i + rep * n + n).map(key).join(' ') === unit && i + rep * n + n <= toks.length) rep++
      if (rep > limit) { out.push(...toks.slice(i, i + n)); repeats.push(`${toks.slice(i, i + n).join(' ')} ×${rep}`); i += rep * n; done = true }
    }
    if (!done) { out.push(toks[i]!); i++ }
  }
  return { text: out.join(' '), repeats }
}
/** a felismert szöveg a felvétel hosszához képest valószínűtlenül sűrű (alapértelmezés: 4 szó / másodperc) */
export const tooDense = (text: string, seconds: number, wps = 4) => seconds > 0 && text.split(/\s+/).filter(Boolean).length / seconds > wps
