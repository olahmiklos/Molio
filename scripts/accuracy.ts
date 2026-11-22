// @ts-nocheck – Node-szkript (vite-node), a típusellenőrzés a felületi kódra vonatkozik
// Pontosságmérés kiadás előtt (spec v2.3, 16. pont): lefuttatja a tesztkészletet a teljes értelmezési láncon, kategóriánként összeveti az elvárt értelmezéssel,
// az előző kiadás eredményével (app/data/accuracy-baseline.json) is. Kimenet: app/data/accuracy.json és konzol; kilép 2-vel, ha valamelyik kategória 2 pontnál többet romlott.
// Futtatás: npx vite-node scripts/accuracy.ts [--baseline]   (a --baseline az eredményt az előző kiadás alapjaként menti)
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import { analyze } from '../app/utils/parser'
import { DEFAULT_STATUS_DICT } from '../app/utils/parser'
import { defaultItems, defaultTypes } from '../app/utils/defaults'
import { preprocess } from '../app/utils/dict/pipeline'
import { buildVocab } from '../app/utils/dict/vocab'
import { buildSet } from '../tests/accuracy/set'

const items = defaultItems(), types = defaultTypes()
const vocab = buildVocab({ items, types, statusDict: DEFAULT_STATUS_DICT })
const set = buildSet()
const CATS = ['fogszám', 'felszín', 'művelet', 'anyag', 'mennyiség'] as const
const OLD = process.argv.includes('--old')   // az értelmező az új lánc nélkül (a v2.2 viselkedése): csak a parser
interface Cnt { total: number; ok: number }
const cat: Record<string, Cnt> = Object.fromEntries(CATS.map(c => [c, { total: 0, ok: 0 }]))
const bad: { id: string; text: string; cat: string; want: string; got: string }[] = []
const note = (c: string, ok: boolean, e: { id: string; text: string }, want: string, got: string) => { cat[c]!.total++; if (ok) cat[c]!.ok++; else bad.push({ id: e.id, text: e.text, cat: c, want, got }) }

for (const e of set) {
  const text = OLD ? e.text.toLowerCase() : preprocess(e.text, { vocab }).text
  const r = analyze(OLD ? text.normalize('NFD').replace(/[̀-ͯ]/g, '') : text, { items, types })
  e.teeth.forEach(t => note('fogszám', r.teeth.includes(t), e, String(t), r.teeth.join(',')))
  Object.entries(e.surfaces).forEach(([t, s]) => { const got = [...(r.surfaces[Number(t)] || [])].sort().join(''); note('felszín', got === s.split('').sort().join(''), e, `${t}:${s}`, got) })
  e.types.forEach(t => note('művelet', r.types.includes(t), e, t, r.types.join(',')))
  Object.entries(e.qty).forEach(([k, q]) => { note('anyag', k in r.qty, e, k, Object.keys(r.qty).join(',')); note('mennyiség', Math.abs((r.qty[k] ?? -1) - q) < 1e-6, e, `${k}=${q}`, `${k}=${r.qty[k]}`) })
}
const pct = (c: Cnt) => c.total ? Math.round(c.ok / c.total * 1000) / 10 : 100
const all = CATS.reduce((a, c) => ({ total: a.total + cat[c]!.total, ok: a.ok + cat[c]!.ok }), { total: 0, ok: 0 })
const res = { examples: set.length, checks: all.total, total: pct(all), byCat: Object.fromEntries(CATS.map(c => [c, pct(cat[c]!)])), at: new Date().toISOString(), mode: OLD ? 'régi értelmező (v2.2)' : 'teljes lánc (v2.3)' }
const dir = new URL('../app/data/', import.meta.url).pathname
mkdirSync(dir, { recursive: true })
const BASE = dir + 'accuracy-baseline.json'
if (process.argv.includes('--baseline')) { writeFileSync(BASE, JSON.stringify(res, null, 2)); console.log('Alap mentve:', res); process.exit(0) }
const prev = existsSync(BASE) ? JSON.parse(readFileSync(BASE, 'utf8')) : null
const out = { ...res, prev: prev ? { total: prev.total, byCat: prev.byCat, examples: prev.examples, mode: prev.mode } : null, worse: [] as string[] }
if (prev) CATS.forEach(c => { if ((prev.byCat[c] ?? 100) - (res.byCat as Record<string, number>)[c]! > 2) out.worse.push(c) })
if (!OLD) writeFileSync(dir + 'accuracy.json', JSON.stringify(out, null, 2))
console.log(`Tesztkészlet: ${res.examples} példa, ${res.checks} ellenőrzött elem – összesített pontosság: ${res.total}%`)
CATS.forEach(c => console.log(`  ${c}: ${(res.byCat as Record<string, number>)[c]}%${prev ? ` (előző kiadás: ${prev.byCat[c]}%)` : ''}  [${cat[c]!.ok}/${cat[c]!.total}]`))
if (bad.length) { console.log(`\nHibás példák (${bad.length}):`); bad.slice(0, 40).forEach(b => console.log(`  [${b.cat}] „${b.text}” – elvárt: ${b.want}, kapott: ${b.got}`)) }
if (out.worse.length) { console.log(`\nROMLÁS (>2 pont): ${out.worse.join(', ')}`); process.exit(2) }
