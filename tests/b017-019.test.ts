// A demó v2.5 hibajavításai: B-017 (számok kanonikus alakja), B-018 (számjeggyel írt tizedes), B-019 (ékezetes kijelzés)
import { describe, expect, it } from 'vitest'
import { analyze } from '../app/utils/parser'
import { defaultItems, defaultTypes } from '../app/utils/defaults'
import { DEFAULT_STATUS_DICT } from '../app/utils/parser'
import { preprocess } from '../app/utils/dict/pipeline'
import { buildVocab } from '../app/utils/dict/vocab'
import { canonTokens, reliableSuggestion, veryDifferent, wordAccuracy, wordDiff } from '../app/utils/dict/quality'
import { facts, sameWrong, TRAIN_SECTIONS, wrongTerms } from '../app/utils/dict/train'

const items = defaultItems(), types = defaultTypes()
const vocab = buildVocab({ items, types, statusDict: DEFAULT_STATUS_DICT })
const ctx = { items, types, vocab }
const A = (t: string) => analyze(preprocess(t, { vocab }).text, { items, types })
const T1 = 'Fog harminchat. Fog 36-os. Fog harminc-hat. Jobb fent hatos.'

describe('B-017: a helyesen felismert szöveg 100%, hamis eltérés nélkül', () => {
  it('kanonikus alak: harminc-hat = harminchat = 36-os = 36; 3,6 = 3.6 = három egész hat', () => {
    expect(canonTokens(T1)).toEqual(['fog', '36', 'fog', '36', 'fog', '36', 'jobb', 'fent', '6'])
    expect(canonTokens('Három egész hat ml')).toEqual(['3.6', 'ml'])
    expect(canonTokens('3,6 ml')).toEqual(['3.6', 'ml'])
    expect(canonTokens('3.6ml')).toEqual(['3.6', 'ml'])
    expect(canonTokens('három vessző hat tized')).toEqual(['3.6'])
    expect(canonTokens('fog 36, 37')).toEqual(['fog', '36', '37'])
  })
  it('a felolvasott szöveg önmagához és számjegyes / számneves változatához mérve 100%', () => {
    for (const s of TRAIN_SECTIONS) expect(wordAccuracy(s.text, s.text).ratio).toBe(1)
    expect(wordAccuracy(T1, 'Fog harminchat. Fog harminchatos. Fog harminchat. Jobb fent hatos.').ratio).toBe(1)
    expect(wordAccuracy(T1, 'Fog 36. Fog 36-os. Fog 36. Jobb fent hatos.').ratio).toBe(1)
    expect(wordAccuracy('Három egész hat ml öblítő oldat.', '3,6 ml öblítő oldat.').ratio).toBe(1)
    expect(wordDiff(T1, 'Fog harminchat. Fog harminchatos. Fog harminchat. Jobb fent hatos.').every(d => d.ok)).toBe(true)
  })
  it('a betanítás eltéréslistája: érték és darabszám szerinti párosítás, nincs „(kimaradt)”', () => {
    expect(wrongTerms(T1, 'Fog harminchat. Fog harminchatos. Fog harminchat. Jobb fent hatos.')).toEqual([])
    expect(wrongTerms(T1, 'Fog 36. Fog 36-os. Fog 36-os. Jobb fent hatos.')).toEqual([])
    expect(wrongTerms('Három egész hat ml öblítő oldat.', '3,6 ml öblítő oldat.')).toEqual([])
    expect(wrongTerms('Három egész hat ml öblítő oldat.', 'három egész hat ml öblítő oldat')).toEqual([])
    for (const s of TRAIN_SECTIONS) expect(wrongTerms(s.text, s.text)).toEqual([])
  })
  it('a darabszám számít: ha egy 36 hiányzik, az eltérés megjelenik', () => {
    const w = wrongTerms(T1, 'Fog harminchat. Fog harminchat. Jobb fent hatos.')
    expect(w.length).toBe(2)
    expect(w.map(x => x.heard)).toEqual(['(kimaradt)', '(kimaradt)'])
  })
  it('valódi számeltérés továbbra is eltérés, javaslat nélkül', () => {
    const w = wrongTerms('Fog negyvenhét, szuvas.', 'Fog negyvenhat, szuvas.')
    expect(w).toEqual([{ said: 'negyvenhét', heard: 'negyvenhat', cat: 'szöveg' }])
    expect(veryDifferent(w[0]!.said, w[0]!.heard)).toBe(true)
    expect(reliableSuggestion(w[0]!.said, w[0]!.heard, 1)).toBe(false)
    expect(veryDifferent('három egész hat', '3,6')).toBe(false)
  })
})

describe('B-018: a számjeggyel írt tizedes (3,6 / 3.6) mennyisége', () => {
  it('facts: „3,6 ml öblítő oldat.” = „Három egész hat ml öblítő oldat.”', () => {
    const ref = facts('Három egész hat ml öblítő oldat.', ctx)
    expect(ref.mennyiség.some(m => m.endsWith('=3.6'))).toBe(true)
    for (const t of ['3,6 ml öblítő oldat.', '3.6 ml öblítő oldat.', '3,6ml öblítő oldat.', '3.6ml öblítő oldat']) expect(facts(t, ctx).mennyiség).toEqual(ref.mennyiség)
  })
  it('a rendes diktálás feldolgozása (preprocess → analyze)', () => {
    const r = A('3,6 ml öblítő oldat.')
    expect(Object.values(r.qty)).toEqual([3.6])
  })
  it('nem törik el: mondatvégi pont, vesszős felsorolás, 36-os, dátumszerű alak', () => {
    // a felsorolás szövege változatlan marad (nem lesz belőle tizedes)
    expect(preprocess('Fog 36, 37, tömés.', { vocab }).text).toBe('fog 36, 37, tomes.')
    expect(preprocess('Fog 36,37 tömés.', { vocab }).text).toBe('fog 36,37 tomes.')
    expect(preprocess('Három egész hat ml öblítő oldat.', { vocab }).text).toContain('qxdyg ml')
    expect([...A('Fog 36-os, extrakció.').teeth]).toEqual([36])
    expect([...A('Fog harminchat.').teeth]).toEqual([36])
    expect(preprocess('Kontroll 2026.11.26. és 11.5. 10.30-kor', { vocab }).text).not.toContain('qx')
    expect(Object.values(A('Polírpaszta öt darab.').qty)).toEqual([5])
  })
})

describe('B-019: az eltérő szavak eredeti, ékezetes alakja', () => {
  it('a felolvasott és a hallott szó is ékezetesen jelenik meg', () => {
    const w = wrongTerms('Három egész hat ml öblítő oldat.', 'Három egész hét ml öblítő oldat.')
    expect(w).toEqual([{ said: 'három egész hat', heard: 'három egész hét', cat: 'szöveg' }])
    const p = wrongTerms('Polírpaszta öt darab. Két szuri.', 'polír pasta öt darab. két szúró')
    expect(p.map(x => x.said)).toEqual(['polírpaszta', 'szuri'])
    expect(p.find(x => x.said === 'szuri')!.heard).toBe('szúró')
  })
  it('előfeldolgozott (ékezet nélküli) hallott szövegnél is a felolvasott eredeti alak látszik', () => {
    const w = wrongTerms('Polírpaszta öt darab. Két szuri.', 'polirpaszta ot darab ket ampulla')
    expect(w.map(x => x.said)).toEqual(['szuri'])
    expect(wrongTerms('Fog huszonöt, MO kompozit tömés.', 'Fog huszonöt, MI kompozit tömés.')[0]!.said).toBe('MO')
  })
  it('a régi (ékezet nélkül mentett) eltérésekkel és a személyes szabállyal összevethető; a szabály lefut', () => {
    expect(sameWrong({ said: 'szúró', heard: 'Szuro' }, { said: 'szuro', heard: 'szuro' })).toBe(true)
    expect(sameWrong({ said: 'polírpaszta', heard: 'pasta' }, { said: 'polirpaszta', heard: 'pasta' })).toBe(true)
    // a javaslatból készülő szabály: ha ezt hallja → értse úgy (ékezetes alakokkal is lefut)
    const w = wrongTerms('Fog negyvenhét, szuvas.', 'Fog negyvenhét, szúvas.')
    const rule = { id: 'x', from: w[0]?.heard || 'szúvas', to: w[0]?.said || 'szuvas', active: true, source: 'betanitas' as const, created: '' }
    expect(preprocess('Fog negyvenhét, szúvas.', { vocab, personal: [rule] }).text).toContain('szuvas')
  })
})
