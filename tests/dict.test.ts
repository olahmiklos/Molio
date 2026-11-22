import { describe, expect, it } from 'vitest'
import { analyze, analyzeItems } from '../app/utils/parser'
import { defaultItems, defaultTypes } from '../app/utils/defaults'
import { DEFAULT_STATUS_DICT } from '../app/utils/parser'
import { preprocess } from '../app/utils/dict/pipeline'
import { buildVocab } from '../app/utils/dict/vocab'
import { collapseRepeats, filterHallucinations } from '../app/utils/dict/filters'
import { BASE_ROWS } from '../app/utils/dict/base'
import { reviewFlags, DEFAULT_COMPAT } from '../app/utils/dict/review'

const items = defaultItems(), types = defaultTypes()
const st = { items, types }
const vocab = buildVocab({ items, types, statusDict: DEFAULT_STATUS_DICT })
const P = (t: string, picks: Record<string, string> = {}) => preprocess(t, { vocab, picks })
const A = (t: string) => analyze(P(t).text, st)

describe('alapszótár', () => {
  it('131 sor', () => expect(BASE_ROWS.length).toBe(131))
  it('szleng → hivatalos', () => {
    expect(A('harminc hat os fog extrakció').teeth).toEqual([36])
    expect(A('jobb fent hatos, kihúztam').teeth).toEqual([16])
    expect(A('30 6-os fog').teeth).toEqual([36])
    expect(A('tejfog jobb felső négyes tömés').teeth).toEqual([54])
    expect(A('betömtem a 36-ost').types).toContain('tomes')
    expect(A('36 em ó dé tömés').surfaces[36]!.sort()).toEqual(['D', 'M', 'O'])
    expect(analyze(P('polír pasta öt darab').text, st).qty.polir).toBe(5)
    expect(analyze(P('két szuri').text, st).qty.amp).toBe(2)
  })
  it('tizedes mennyiség', () => {
    expect(analyze(P('három egész hat ml öblítő oldat').text, st).qty.obl).toBeCloseTo(3.6, 5)
    expect(analyze(P('két és fél ml öblítő').text, st).qty.obl).toBeCloseTo(2.5, 5)
  })
})

describe('kitalációk szűrése (13. pont)', () => {
  it('ismert kitalált mondat', () => {
    const r = filterHallucinations('36-os tömés. Köszönöm a figyelmet.')
    expect(r.removed).toEqual(['Köszönöm a figyelmet.']); expect(r.text).toBe('36-os tömés.')
    expect(filterHallucinations('Köszönöm, hogy megnézted!').text).toBe('')
  })
  it('ismétlés 3-nál többször', () => {
    expect(collapseRepeats('tömés tömés tömés tömés tömés 36').text).toBe('tömés 36')
    expect(collapseRepeats('tömés tömés tömés 36').text).toBe('tömés tömés tömés 36')
  })
})

describe('hasonlóság (10. pont)', () => {
  it('félrehallott szó ⚠-ként, nem csendben', () => {
    const r2 = P('polír pastra öt darab')
    const f = r2.flags.find(x => x.kind === 'similar')!
    expect(f.choices.map(c => c.id)).toContain('paszta')
    expect(analyze(r2.text, st).qty.polir).toBeUndefined()
    const r3 = P('polír pastra öt darab', { [f.key]: 'paszta' })
    expect(analyze(r3.text, st).qty.polir).toBe(5)
  })
  it('számokra nem fut', () => expect(P('36 os fog').flags.length).toBe(0))
})

describe('⚠ ellenőrzések (5., 9., 15. pont)', () => {
  const base = { text: '', done: [], planItems: [], finalItems: [], status: {}, types, catalog: items, qty: {}, pkg: {}, history: [], compat: DEFAULT_COMPAT }
  it('hatos + előjegyzés', () => {
    const f = reviewFlags({ ...base, text: P('hatos, kihúztam').text, planItems: [{ tooth: 36, typeId: 'huzas' }] })
    expect(f[0]!.suggested).toBe('36')
  })
  it('fogtérkép ellentmondás', () => {
    const f = reviewFlags({ ...base, text: '', finalItems: [{ tooth: 26, typeId: 'tomes' }], status: { 26: ['hianyzik'] }, planItems: [{ tooth: 36, typeId: 'tomes' }] })
    expect(f[0]!.kind).toBe('chart'); expect(f[0]!.choices.map(c => c.id)).toContain('36')
  })
  it('ugyanabban a diktálásban változó állapot nem jelez tévesen', () => {
    const f = reviewFlags({ ...base, finalItems: [{ tooth: 36, typeId: 'huzas' }, { tooth: 36, typeId: 'implant' }], status: { 36: ['szuvas'] } })
    expect(f.filter(x => x.kind === 'chart')).toEqual([])
  })
  it('kétértelmű mennyiség', () => {
    const catalog = items.map(i => (i.id === 'obl' ? { ...i } : i))
    const f = reviewFlags({ ...base, text: P('három hatos öblítő').text, catalog })
    expect(f.find(x => x.kind === 'qty')!.choices.map(c => c.label).join()).toContain('3,6')
    const withVar = catalog.map(i => (i.id === 'amp' ? { ...i, variants: [6] } : i))
    expect(reviewFlags({ ...base, text: P('három hatos injekció').text, catalog: withVar }).filter(x => x.kind === 'qty')).toEqual([])
    expect(reviewFlags({ ...base, text: P('három hatos tampon').text }).find(x => x.kind === 'qty')!.info).toBe(true)
  })
})
describe('értelmezés a lánc után', () => {
  it('kivettem a varratot → szálszedés, nem foghúzás', () => {
    const r = P('kivettem a varratot')
    expect(r.flags.filter(f => f.kind === 'ambig')).toEqual([])
    expect(analyzeItems(r.text, st).done).toEqual([])
  })
  it('kivettem önmagában ⚠', () => expect(P('36-os kivettem').flags.some(f => f.kind === 'ambig')).toBe(true))
})

describe('betanítás és pontosságmérés', () => {
  it('a felolvasott szöveg önmagával 100%', async () => {
    const { TRAIN_SECTIONS, facts, score } = await import('../app/utils/dict/train')
    const ctx = { items, types, vocab }
    for (const s of TRAIN_SECTIONS) { const f = facts(s.text, ctx); const sc = score(f, f); expect(sc.ok).toBe(sc.total) }
  })
  it('rosszul hallott szó a javaslatban', async () => {
    const { wrongTerms } = await import('../app/utils/dict/train')
    const w = wrongTerms('polírpaszta öt darab', 'polír pasta öt darab')
    expect(w.some(x => x.said === 'polirpaszta')).toBe(true)
  })
  it('vessző utáni felszín-rövidítés a fogé', () => {
    expect(A('Fog huszonöt, MO kompozit tömés.').surfaces[25]!.sort()).toEqual(['M', 'O'])
  })
  it('a tesztkészlet pontossága nem romlik', async () => {
    const { buildSet } = await import('./accuracy/set')
    expect(buildSet().length).toBeGreaterThanOrEqual(150)
  })
})

describe('mennyiségi szabály', () => {
  const base = { text: '', done: [], planItems: [], finalItems: [], status: {}, types, catalog: items, qty: {}, pkg: {}, history: [], compat: DEFAULT_COMPAT }
  it('a kétértelmű mennyiségi ⚠ mintázatot ad a tanuláshoz', () => {
    const f = reviewFlags({ ...base, text: P('három hatos öblítő').text }).find(x => x.kind === 'qty')
    expect(f).toBeTruthy(); expect(String(f!.data?.pattern)).toMatch(/^qty:obl:6:3 /)
  })
})
