// A felismert szavak szókészlete: mit ismer a program (kulcsszavak, szótár, kódtáblák), és mi kerül az „Ismeretlen kifejezések” közé / a hasonlósági egyeztetésbe.
import { norm } from '../dates'
import { kwPartMatch, NUMW } from '../parser'
import { baseWords, FILLER_FORMS } from './base'
import type { Item, StatusDef, TreatmentType } from '../types'
import type { VocabEntry } from './similar'

export interface VocabCtx { items: Item[]; types: TreatmentType[]; statusDict: StatusDef[] }

const SURFACE_WORDS = ['mezialis', 'mesialis', 'disztalis', 'distalis', 'okkluzalis', 'occlusalis', 'incisalis', 'inciziv', 'vesztibularis', 'bukkalis', 'buccalis', 'labialis', 'lingualis', 'palatinalis', 'oralis', 'ragofelszin', 'metszoel']
const LATIN_TOOTH = ['bolcsessegfog', 'tejfog', 'jobb', 'bal', 'felso', 'also', 'romai', 'kisorlo', 'nagyorlo', 'metszofog', 'szemfog', 'egyes', 'kettes', 'harmas', 'negyes', 'otos', 'hatos', 'hetes', 'nyolcas']
/** gyakori magyar (nem szakmai) szavak: ezeket sosem tekintjük ismeretlen kifejezésnek */
const STOP = new Set(('hogy akkor aztan ezutan utana majd mert mint vagy illetve valamint tehat viszont azonban szinten mindket minden semmi nincs nincsen volt lett lesz van vannak kell kellett kellene lehet fogok fogot fogat fogon fogra fogak fogakat fogaknal fogazat panasz panaszt panaszmentes panaszos paciens paciensnek paciensnel orvos kezeles kezelest kezelesre kezelesben kezelt kezelnek '
  + 'alkalom alkalommal alkalmazva alkalmaztam csinaltam csinaltunk csinaltuk elvegeztem elvegeztuk elvegeztunk megcsinaltam megcsinaltuk tortent kezdodott befejeztem befejeztuk folytatjuk folytatom jovo jovoheten hetek napon belul mulva honap honapon utan elott kozben alatt felett mellett mellett '
  + 'szamara reszere resz resze reszen reszet oldal oldalon oldalt oldali felszin felszinen felszinre felszinek felszint kerem kerek kertem kerunk kerjuk koszonom egeszseges rendben jol jobb jobban rosszabb enyhe erosen eros kisebb nagyobb nagyon eleg kicsit sokat keveset tobbet darab darabot adag adagot kozepso elso masodik harmadik negyedik otodik hatodik hetedik nyolcadik')
  .split(/\s+/))

export interface Vocab {
  entries: VocabEntry[]
  parts: string[]
  isKnown(tok: string): boolean
}
let cache: { key: string; v: Vocab } | null = null

export function buildVocab(ctx: VocabCtx): Vocab {
  const key = ctx.items.map(i => i.id + (i.kw || []).join()).join('|') + ctx.types.map(t => t.id + (t.kw || []).join()).join('|') + ctx.statusDict.map(d => d.id + d.kw.join()).join('|')
  if (cache?.key === key) return cache.v
  const parts = new Set<string>(), exact = new Set<string>()
  const entries: VocabEntry[] = []
  const add = (raw: string, label: string, cat: string) => norm(raw).trim().split(/\s+/).forEach(p => {
    if (!p) return
    parts.add(p)
    const w = p.replace(/\*$/, '')
    if (w.length >= 5) entries.push({ word: w, label: label || w, cat })
  })
  ctx.items.forEach(i => (i.kw || []).forEach(k => add(k, k.replace(/\*$/, ''), 'anyag')))
  ctx.types.forEach(t => (t.kw || []).forEach(k => add(k, k.replace(/\*$/, ''), 'művelet')))
  ctx.statusDict.forEach(d => d.kw.forEach(k => add(k, k.replace(/\*$/, ''), 'fogállapot')))
  SURFACE_WORDS.forEach(w => add(w, w, 'felszín'))
  LATIN_TOOTH.forEach(w => add(w, w, 'fogszám'))
  baseWords().forEach(b => { parts.add(b.word); entries.push({ word: b.word, label: b.label, cat: b.cat }) })
  FILLER_FORMS.forEach(f => f.split(/\s+/).forEach(p => exact.add(p)))
  Object.keys(NUMW).forEach(w => exact.add(w))
  STOP.forEach(w => exact.add(w))
  const list = [...parts]
  const v: Vocab = {
    entries, parts: list,
    isKnown(tok) {
      if (tok.length < 5 || /\d/.test(tok) || tok.startsWith('qx') || exact.has(tok)) return true
      return list.some(p => (p.endsWith('*') ? tok.startsWith(p.slice(0, -1)) : kwPartMatch(tok, p)))
    },
  }
  cache = { key, v }
  return v
}
