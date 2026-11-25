// Időpont-ütközések (spec v2.4 7. pont, B-010): az átfedő időpontok egymás mellett jelennek meg (sávokra bontva),
// és minden ütköző csoport egy „Időpont-ütközés” feladat a Teendők között. Tiszta függvények.
import { addDays, toMin, today } from './dates'
import type { Appointment, DB } from './types'

export interface ConflictPair { a: Appointment; b: Appointment; /** a kezelések időben átfedik egymást (nem csak a ráhagyás) */ hard: boolean; /** „szándékos átfedés” jóváhagyva */ ok: boolean }
export interface ConflictGroup { key: string; date: string; doctorId: string; appts: Appointment[]; hard: boolean; ok: boolean; pairs: ConflictPair[] }

const span = (a: Pick<Appointment, 'start' | 'dur' | 'buffer'>, withBuf = true) => { const s = toMin(a.start); return [s, s + a.dur + (withBuf ? a.buffer || 0 : 0)] as const }
const inter = (x: readonly [number, number], y: readonly [number, number]) => x[0] < y[1] && y[0] < x[1]
export const overlapOkBetween = (a: Appointment, b: Appointment) => !!a.overlapOk?.some(o => o.id === b.id) || !!b.overlapOk?.some(o => o.id === a.id)

/** az orvos egy napi időpontjainak ütköző párjai (a ráhagyás foglaltnak számít) */
export function pairsOf(list: Appointment[]): ConflictPair[] {
  const out: ConflictPair[] = []
  const l = list.slice().sort((x, y) => toMin(x.start) - toMin(y.start))
  for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) {
    const a = l[i]!, b = l[j]!
    if (!inter(span(a), span(b))) continue
    out.push({ a, b, hard: inter(span(a, false), span(b, false)), ok: overlapOkBetween(a, b) })
  }
  return out
}
/** ütköző csoportok (összefüggő átfedések) orvosonként és naponként; csak a még el nem végzett, nem elmaradt időpontok */
export function conflictGroups(db: DB, o: { from?: string; isDone?: (a: Appointment) => boolean } = {}): ConflictGroup[] {
  const from = o.from ?? today()
  const live = db.appointments.filter(a => a.date >= from && a.status !== 'noshow' && !(o.isDone?.(a)))
  const by = new Map<string, Appointment[]>()
  live.forEach(a => { const k = a.date + '|' + a.doctorId; by.set(k, [...(by.get(k) || []), a]) })
  const groups: ConflictGroup[] = []
  by.forEach((list, k) => {
    const pairs = pairsOf(list); if (!pairs.length) return
    // összefüggő komponensek
    const parent = new Map<string, string>(); const find = (x: string): string => { const p = parent.get(x) || x; if (p === x) return x; const r = find(p); parent.set(x, r); return r }
    pairs.forEach(p => { parent.set(find(p.a.id), find(p.b.id)) })
    const comp = new Map<string, ConflictPair[]>()
    pairs.forEach(p => { const r = find(p.a.id); comp.set(r, [...(comp.get(r) || []), p]) })
    comp.forEach(ps => {
      const appts = [...new Map(ps.flatMap(p => [p.a, p.b]).map(a => [a.id, a])).values()].sort((x, y) => toMin(x.start) - toMin(y.start))
      const [date, doctorId] = k.split('|') as [string, string]
      groups.push({ key: 'u:' + appts.map(a => a.id).sort().join('+'), date, doctorId, appts, hard: ps.some(p => p.hard && !p.ok), ok: ps.every(p => p.ok), pairs: ps })
    })
  })
  return groups.sort((x, y) => (x.date + x.appts[0]!.start).localeCompare(y.date + y.appts[0]!.start))
}
/** az időponttal ütköző másik időpontok és az ütközés jellege (az időpont ablakához) */
export function conflictsFor(db: DB, a: Appointment, isDone?: (a: Appointment) => boolean): { other: Appointment; hard: boolean; ok: boolean }[] {
  const list = db.appointments.filter(b => b.date === a.date && b.doctorId === a.doctorId && b.status !== 'noshow' && !(isDone?.(b)))
  return pairsOf(list).filter(p => p.a.id === a.id || p.b.id === a.id).map(p => ({ other: p.a.id === a.id ? p.b : p.a, hard: p.hard, ok: p.ok }))
}
/** sürgősség az ütközés dátuma szerint: ma és holnap sürgős, a következő 7 napban figyelendő, később normál; a csak ráhagyás-ütközés egy fokkal alacsonyabb */
export function conflictUrgency(g: Pick<ConflictGroup, 'date' | 'hard'>): 'urgent' | 'recommended' | 'later' {
  const t0 = today()
  const lvl = g.date <= addDays(t0, 1) ? 0 : g.date <= addDays(t0, 7) ? 1 : 2
  const l = Math.min(2, lvl + (g.hard ? 0 : 1))
  return (['urgent', 'recommended', 'later'] as const)[l]!
}
/** sávokra bontás a naptárhoz: az átfedő időpontok egyenlő szélességű részekre osztják az orvos oszlopát */
export function laneLayout(list: Appointment[]): Map<string, { lane: number; n: number }> {
  const out = new Map<string, { lane: number; n: number }>()
  const l = list.slice().sort((x, y) => toMin(x.start) - toMin(y.start) || y.dur - x.dur)
  let cluster: { a: Appointment; lane: number }[] = [], clusterEnd = -1
  const flush = () => { const n = Math.max(1, ...cluster.map(c => c.lane + 1)); cluster.forEach(c => out.set(c.a.id, { lane: c.lane, n })); cluster = [] }
  for (const a of l) {
    const [s, e] = span(a)
    if (cluster.length && s >= clusterEnd) { flush(); clusterEnd = -1 }
    const laneEnds: number[] = []
    cluster.forEach(c => { const ce = span(c.a)[1]; laneEnds[c.lane] = Math.max(laneEnds[c.lane] ?? -1, ce) })
    let lane = 0; while (laneEnds[lane] !== undefined && laneEnds[lane]! > s) lane++
    cluster.push({ a, lane }); clusterEnd = Math.max(clusterEnd, e)
  }
  if (cluster.length) flush()
  return out
}
