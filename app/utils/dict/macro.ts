// Személyes rövidítések / makrók (spec v2.4 15. pont): egy szóval előhívott tételcsoport („szokásos kontroll”).
// A név a feldolgozási láncban az értelmezés előtt kerül felismerésre (pontos egyezés), a módosítók ugyanabban a mondatban:
// fogszám („… a 36-osra”), kiegészítés („plusz két tampon”), mennyiség felülírása („érzéstelenítés két ampulla”), elhagyás („…, de polírozás nélkül”).
// Tiszta függvények (tesztelhetők); AI nélkül működik.
import { norm } from '../dates'
import type { Item, TreatmentType } from '../types'
import { findTeeth, tokenize } from '../parser'

export interface MacroLine { kind: 'type' | 'mat'; id: string; qty?: number }
export interface Macro {
  id: string
  /** a kimondott név és további elhangzó alakok */
  name: string
  aliases: string[]
  lines: MacroLine[]
  active: boolean
  uses: number
  lastUsed: string
  created: string
  /** a rövidítésből kapott sor ugyanolyan módosításainak száma (frissítési javaslathoz): „anyag:érték” → db */
  mods?: Record<string, number>
  branch?: string
}
export interface MacroCtx { types: TreatmentType[]; items: Item[] }
export interface MacroHit {
  key: string
  macroId: string
  name: string
  /** a mondatban kimondott fogak (a fogszámos tételekre vonatkoznak) */
  teeth: number[]
  /** a rövidítés sorai: elhagyott-e („… nélkül”) */
  lines: (MacroLine & { omitted: boolean; missing: boolean })[]
  /** a „nélkül” szó után álló kifejezés, amelyhez nem dönthető el egyértelműen, melyik sor tartozik (rákérdezés) */
  ambiguousOmit: { phrase: string; candidates: number[] } | null
  needsTooth: boolean
}
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
export const macroForms = (m: Pick<Macro, 'name' | 'aliases'>) => [m.name, ...m.aliases].map(x => norm(x).trim()).filter(Boolean)
const lineWords = (l: MacroLine, c: MacroCtx): string[] => {
  if (l.kind === 'type') { const t = c.types.find(x => x.id === l.id); return t ? [norm(t.name), ...t.kw.map(k => norm(k).replace('*', ''))] : [] }
  const i = c.items.find(x => x.id === l.id); return i ? [norm(i.name), ...i.kw.map(k => norm(k).replace('*', ''))] : []
}
/** melyik sor(ok)ra illik egy elhagyott kifejezés („polírozás” → a polírozás művelet) */
export function omitCandidates(m: Macro, phrase: string, c: MacroCtx): number[] {
  const p = norm(phrase).replace(/[^a-z0-9 ]/g, ' ').trim().split(/\s+/).filter(w => w.length >= 3 && !['de', 'es', 'meg', 'a', 'az'].includes(w))
  if (!p.length) return []
  const stem = (w: string) => w.slice(0, Math.max(4, Math.min(w.length, 6)))
  return m.lines.map((l, i) => ({ i, ws: lineWords(l, c) })).filter(x => x.ws.some(w => p.some(q => w.split(/\s+/).some(ww => ww.startsWith(stem(q)) || q.startsWith(ww.slice(0, 5)))))).map(x => x.i)
}
/** a rövidítések felismerése a (normalizált) szövegben: a hosszabb, pontosabb név nyer; a név és az elhagyó kifejezés a parsernek átadott szövegből kimarad */
export function findMacros(text: string, macros: Macro[], c: MacroCtx): { text: string; hits: MacroHit[] } {
  const act = macros.filter(m => m.active)
  if (!act.length || !text) return { text, hits: [] }
  const forms = act.flatMap(m => macroForms(m).map(f => ({ m, f }))).sort((a, b) => b.f.length - a.f.length)
  let t = text
  const hits: MacroHit[] = []
  const omitRe = /(?:,?\s*de\s+)?((?:[a-z0-9]+\s+){0,2}?[a-z0-9]+)\s+nelkul/g
  for (const { m, f } of forms) {
    for (let guard = 0; guard < 10; guard++) {
      const mm = new RegExp(`(?<![a-z0-9])${esc(f)}(?![a-z0-9])`).exec(t)
      if (!mm) break
      const off = mm.index, after = off + mm[0].length
      // a mondat többi része (a következő mondatjelig) a módosítók helye
      const rel = t.slice(after).search(/[.!?;]/)
      const endIdx = rel < 0 ? t.length : after + rel
      const clause = t.slice(after, endIdx)
      const lines = m.lines.map(l => ({ ...l, omitted: false, missing: l.kind === 'type' ? !c.types.some(x => x.id === l.id) : !c.items.some(x => x.id === l.id) }))
      let ambiguousOmit: MacroHit['ambiguousOmit'] = null
      // elhagyás diktálással: „…, de X nélkül”
      for (const om of clause.matchAll(omitRe)) {
        const cand = omitCandidates(m, om[1]!, c)
        if (cand.length === 1) lines[cand[0]!]!.omitted = true
        else ambiguousOmit = { phrase: om[1]!.trim(), candidates: cand.length ? cand : m.lines.map((_, i) => i) }
      }
      const teeth = findTeeth(tokenize(clause)).map(x => x.n)
      const needsTooth = !teeth.length && lines.some(l => l.kind === 'type' && !l.omitted && !l.missing && !!c.types.find(x => x.id === l.id)?.toothBound)
      hits.push({ key: `macro:${m.id}:${hits.length}`, macroId: m.id, name: m.name, teeth, lines, ambiguousOmit, needsTooth })
      // a parsernek: a név nélkül és az elhagyó kifejezés nélkül (különben a „polírozás nélkül” tételt adna); a fogszám és a mennyiség marad
      t = (t.slice(0, off) + ' ' + clause.replace(omitRe, ' ') + t.slice(endIdx)).replace(/[ \t]+/g, ' ')
    }
  }
  return { text: t.trim(), hits }
}
/** a rövidítés tételkombinációjának aláírása (azonos tételek és anyagok, a mennyiség eltérhet) – az ajánláshoz */
export const comboSig = (typeIds: string[], matIds: string[]) => [...new Set(typeIds)].sort().join('+') + '|' + [...new Set(matIds)].sort().join('+')
export const macroSig = (m: Macro) => comboSig(m.lines.filter(l => l.kind === 'type').map(l => l.id), m.lines.filter(l => l.kind === 'mat').map(l => l.id))
/** ajánlás: ugyanaz a kombináció legalább 3 alkalommal 30 napon belül (és még nincs ilyen rövidítés, és nem vetették el) */
export function shouldRecommend(combos: { sig: string; at: string }[], sig: string, macros: Macro[], dismissed: string[], now = Date.now()): boolean {
  if (!sig || sig === '|' || dismissed.includes(sig) || macros.some(m => macroSig(m) === sig)) return false
  return combos.filter(x => x.sig === sig && now - Date.parse(x.at) <= 30 * 86400000).length >= 3
}
/** a név ütközése: nem lehet azonos katalógus-tétel, anyag vagy másik rövidítés nevével */
export function nameConflict(name: string, c: MacroCtx, macros: Macro[], selfId?: string): string | null {
  const n = norm(name).trim()
  if (n.length < 3) return 'A név legalább 3 betű legyen.'
  const t = c.types.find(x => norm(x.name) === n || x.kw.some(k => norm(k).replace('*', '') === n))
  if (t) return `A név azonos egy kezelés nevével (${t.name}) – adj meg másik nevet, pl. „${name} csomag”.`
  const i = c.items.find(x => norm(x.name) === n || x.kw.some(k => norm(k).replace('*', '') === n))
  if (i) return `A név azonos egy anyag nevével (${i.name}) – adj meg másik nevet, pl. „saját ${name}”.`
  const m = macros.find(x => x.id !== selfId && macroForms(x).includes(n))
  if (m) return `Már van ilyen nevű rövidítés (${m.name}).`
  return null
}
export const isBroken = (m: Macro, c: MacroCtx) => m.lines.some(l => (l.kind === 'type' ? !c.types.some(x => x.id === l.id) : !c.items.some(x => x.id === l.id)))
