// B-020: különírt tízes + egyes számnév a minőségmérésben; „suri” szinonima
import { describe, expect, it } from 'vitest'
import { seed } from '../app/utils/seed'
import { facts, wrongTerms } from '../app/utils/dict/train'
import { canonTokens, whisperVerdict, wordAccuracy } from '../app/utils/dict/quality'

const db = seed()
const ctx = { items: db.items, types: db.types }
const WH = 'Fog hárminc hat, fog hárminc hatos, fog hárminc hat, jogfent hatos.'
const BR = 'Fok 36 fok, 36-os fok, 36 jobbfent 6-os..'
const REF = 'Fog harminchat. Fog 36-os. Fog harminc-hat. Jobb fent hatos.'

describe('B-020: különírt összetett számnév', () => {
  it('összevonja a tízest és az egyest', () => {
    expect(canonTokens('harminc hat')).toEqual(['36'])
    expect(canonTokens('hárminc hatos')).toEqual(['36'])
    expect(canonTokens('negyven hét')).toEqual(['47'])
    expect(canonTokens('húsz egy')).toEqual(['21'])
    expect(canonTokens('huszon öt')).toEqual(['25'])
    expect(canonTokens('harminc hat os')).toEqual(['36'])
  })
  it('nem vonja össze, ha nem egyes jön, és a tizedest nem bántja', () => {
    expect(canonTokens('harminc darab')).toEqual(['30', 'darab'])
    expect(canonTokens('három egész hat')).toEqual(['3.6'])
    expect(canonTokens('harminc 6')).toEqual(['30', '6'])
    expect(canonTokens('tíz egy')).toEqual(['10', '1'])
  })
  it('a jó Whisper-szöveg használható, a pontosságot csak a „jogfent” rontja', () => {
    expect(whisperVerdict(WH, BR).usable).toBe(true)
    const acc = wordAccuracy(REF, WH)
    expect(acc.total - acc.ok).toBe(2) // „jobb fent” két szava ↔ „jogfent”
    expect(acc.ok).toBe(7)
  })
  it('a betanítás eltéréslistája sem jelzi hibának a különírt számot', () => {
    const w = wrongTerms(REF, WH)
    expect(w.every(x => !/36|harminc/.test(x.said))).toBe(true)
    expect(w.some(x => /jobb|fent/.test(x.said))).toBe(true)
  })
})

describe('„suri” = szuri (ampulla)', () => {
  it('facts: 2 suri → ampulla 2', () => {
    const f = facts('Polírpasta 5 darab, 2 suri', ctx)
    expect(f.mennyiség.some(x => /amp.*=2$/.test(x))).toBe(true)
    expect(facts('Polírpasta 5 darab, 2 suri', ctx).mennyiség).toEqual(facts('Polírpaszta öt darab. Két szuri.', ctx).mennyiség)
  })
  it('nem okoz téves egyezést a szavak belsejében', () => {
    for (const t of ['Fog 36, surital', 'Szurikáta 2 darab', 'Fog 36 extrakció, sürített levegő']) expect(facts(t, ctx).anyag.some(a => /amp/.test(a))).toBe(false)
  })
})
