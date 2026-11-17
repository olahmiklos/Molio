import { describe, expect, it } from 'vitest'
import { analyze, analyzeStatus, DEFAULT_STATUS_DICT } from '../app/utils/parser'
import { defaultItems, defaultTypes } from '../app/utils/defaults'

const st = { items: defaultItems(), types: defaultTypes() }
const A = (t: string, d?: 'primary' | 'permanent') => analyze(t, st, { dentition: d })

describe('fogszám-felismerés', () => {
  it('FDI-szám ragozva', () => {
    expect(A('36-os és 37-es fog').teeth).toEqual([36, 37])
    expect(A('a 46-osra ideiglenes').teeth).toEqual([46])
    expect(A('21-esnél').teeth).toEqual([21])
    expect(A('21-es fognál').teeth).toEqual([21])
  })
  it('szóval mondott FDI-szám', () => {
    expect(A('tizenhatos fog tömése').teeth).toEqual([16])
    expect(A('harminchatost kezeljük').teeth).toEqual([36])
    expect(A('ötvenötös').teeth).toEqual([55])
  })
  it('oldal, állcsont, sorszám', () => {
    expect(A('jobb felső hatos').teeth).toEqual([16])
    expect(A('bal alsó hármas').teeth).toEqual([33])
    expect(A('felső jobb hatos').teeth).toEqual([16])
    expect(A('jobb felső ötös tejfog').teeth).toEqual([55])
    expect(A('bal alsó római hármas').teeth).toEqual([73])
    expect(A('jobb felső római ötös').teeth).toEqual([55])
  })
  it('tejfogazatnál a maradó fog ellenőrizendő', () => {
    expect(A('36-os fog', 'primary').offDentition).toEqual([36])
    expect(A('55-ös fog', 'primary').offDentition).toEqual([])
  })
})

describe('fogfelszínek', () => {
  it('felszínnevek a fog után', () => {
    expect(A('36-os fog, meziális és rágófelszíni tömés').surfaces).toEqual({ 36: ['M', 'O'] })
  })
  it('rövidítés', () => {
    expect(A('36 MO tömés').surfaces).toEqual({ 36: ['M', 'O'] })
    expect(A('46-os MOD').surfaces[46]).toEqual(['M', 'O', 'D'])
  })
  it('összetett szó', () => {
    expect(A('46-os mezio-okkluzo-disztális tömés').surfaces[46]!.sort()).toEqual(['D', 'M', 'O'])
  })
  it('bővítés kezelés közben', () => {
    expect(A('36-os fog meziális tömés. A rágófelszínen is tömünk.').surfaces[36]).toEqual(['M', 'O'])
    expect(A('36-os meziális. Okkluzálisan bővítem.').surfaces[36]).toEqual(['M', 'O'])
  })
})

describe('anyagok és mennyiségek (index.html szabályai)', () => {
  it('mintadiktálás 1', () => {
    const r = A('36-os és 37-es fog, kompozit tömés. Érzéstelenítés két ampulla artikainnal. Kérek öt tampont. A tömést két rétegben építem fel, aztán még egy tampont kérek. Polírozás.')
    expect(r.teeth).toEqual([36, 37])
    expect(r.types).toContain('tomes')
    expect(r.qty.amp).toBe(2)
    expect(r.qty.tamp).toBe(6)
    expect(r.qty.komp).toBeUndefined()
  })
  it('általános elem a konkrétra száll', () => {
    expect(A('mepivakain két ampulla').qty).toEqual({ mepi: 2 })
    expect(A('lidokain ampulla').qty).toEqual({ lido: 1 })
  })
  it('ismétlés összeadódik', () => {
    expect(A('három tampont kérek. még két tampont').qty.tamp).toBe(5)
  })
  it('ideiglenes után nem tömés', () => {
    expect(A('ideiglenes tömés').types).not.toContain('tomes')
  })
})

describe('fogazati státusz', () => {
  const S = (t: string) => analyzeStatus(t, DEFAULT_STATUS_DICT, 'permanent')
  it('alap', () => {
    const r = S('16-os hiányzik, 26-os korona, 36-os tömött')
    expect(r.teeth).toEqual({ 16: ['hianyzik'], 26: ['korona'], 36: ['tomott'] })
  })
  it('több fog, több állapot', () => {
    expect(S('17-es és 18-as hiányzik').teeth).toEqual({ 17: ['hianyzik'], 18: ['hianyzik'] })
    expect(S('46-os gyökérkezelt és koronás').teeth[46]!.sort()).toEqual(['gyokerkezelt', 'korona'])
  })
  it('tartomány és maradék', () => {
    const r = S('13-tól 23-ig ép. 16-os hiányzik. A többi ép.')
    expect(r.teeth[13]).toEqual(['ep'])
    expect(r.teeth[21]).toEqual(['ep'])
    expect(r.teeth[23]).toEqual(['ep'])
    expect(r.teeth[16]).toEqual(['hianyzik'])
    expect(r.teeth[48]).toEqual(['ep'])
    expect(Object.keys(r.teeth).length).toBe(32)
  })
  it('nem értelmezett rész', () => {
    expect(S('16-os hiányzik, valami más').unparsed).toEqual(['valami más'])
  })
})
