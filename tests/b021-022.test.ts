// A demó v2.6 hibajavításai: B-021 (a felvétel hangerő-minősítése), B-022 (milliliter = ml)
import { describe, expect, it } from 'vitest'
import { summaryLevel } from '../app/utils/dict/audio'
import { abbreviateUnits, canonTokens, wordAccuracy } from '../app/utils/dict/quality'
import { wrongTerms } from '../app/utils/dict/train'

// élő szintek 10 Hz-en: csend (rms 0.001) – beszéd (rms 0.05) – csend
const seq = (parts: [number, number, number][]) => {
  const rms: number[] = [], peak: number[] = []
  for (const [n, r, p] of parts) for (let i = 0; i < n; i++) { rms.push(r); peak.push(p) }
  return { rms, peak }
}

describe('B-021: a felvétel összesített hangereje a beszédes részből', () => {
  it('beszéd előtti / utáni hosszú csend mellett nem „nincs hang” és nem „halk”', () => {
    // 4,5 s csend + 5 s beszéd + 4 s csend (a laborban mért eset: 8–13 s felvétel, kb. 5 s beszéd)
    const { rms, peak } = seq([[45, 0.001, 0.003], [50, 0.05, 0.4], [40, 0.001, 0.003]])
    expect(summaryLevel(rms, peak, { peak: 0.6, speechRatio: 0.3 })).toBe('ok')
  })
  it('valóban halk beszéd: „halk”', () => {
    const { rms, peak } = seq([[20, 0.001, 0.003], [50, 0.006, 0.04], [20, 0.001, 0.003]])
    expect(summaryLevel(rms, peak, { peak: 0.05, speechRatio: 0.4 })).toBe('quiet')
  })
  it('nincs értelmezhető beszéd az előkészített hangban: „nincs hang”', () => {
    const { rms, peak } = seq([[80, 0.001, 0.003]])
    expect(summaryLevel(rms, peak, { peak: 0.005, speechRatio: 0 })).toBe('none')
    expect(summaryLevel(rms, peak, { peak: 0.2, speechRatio: 0.01 })).toBe('none')
  })
  it('a beszédes rész jelentős része vágódik: „túlvezérelt”', () => {
    const { rms, peak } = seq([[20, 0.001, 0.003], [40, 0.3, 0.999], [20, 0.001, 0.003]])
    expect(summaryLevel(rms, peak, { peak: 1, speechRatio: 0.5 })).toBe('loud')
  })
  it('előkészítés nélkül (böngészős felismerő): csak az élő szintekből', () => {
    expect(summaryLevel(seq([[30, 0.001, 0.002]]).rms, seq([[30, 0.001, 0.002]]).peak)).toBe('none')
    const s = seq([[30, 0.001, 0.002], [30, 0.05, 0.3]])
    expect(summaryLevel(s.rms, s.peak)).toBe('ok')
  })
})

describe('B-022: a mértékegység kiírt és rövidített alakja azonos', () => {
  it('a pontosság számításában milliliter = ml (ragozva is), darab = db', () => {
    expect(canonTokens('3,6 milliliter öblítő oldat')).toEqual(['3.6', 'ml', 'oblito', 'oldat'])
    expect(canonTokens('3,6 mililiter')).toEqual(['3.6', 'ml'])
    expect(canonTokens('két millilitert')).toEqual(['2', 'ml'])
    expect(canonTokens('öt darab')).toEqual(canonTokens('öt db'))
    expect(wordAccuracy('Három egész hat ml öblítő oldat.', '3,6 milliliter öblítő oldat.').ratio).toBe(1)
    expect(wrongTerms('Három egész hat ml öblítő oldat.', '3,6 milliliter öblítő oldat.')).toEqual([])
  })
  it('a megjelenített szövegben szám után „ml” áll', () => {
    expect(abbreviateUnits('3,6 milliliter öblítő oldat.')).toBe('3,6 ml öblítő oldat.')
    expect(abbreviateUnits('2 mililiter, 5 köbcenti')).toBe('2 ml, 5 ml')
    expect(abbreviateUnits('A milliliter mértékegység')).toBe('A milliliter mértékegység')
    expect(abbreviateUnits('3,6 ml öblítő oldat.')).toBe('3,6 ml öblítő oldat.')
  })
})
