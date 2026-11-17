import { describe, expect, it } from 'vitest'
import { seed } from '../app/utils/seed'
import { consumeStock, lotSearch, orderSuggestions, previewLots, receiveStock, weightedAvg } from '../app/utils/stock'
import { recallRows, patientInfoDraft, consentFor, layTooth } from '../app/utils/office'

describe('gördülő súlyozott átlagár', () => {
  it('10 db 1000 Ft + 10 db 1200 Ft = 1100 Ft', () => {
    expect(weightedAvg(10, 1000, 10, 1200)).toBe(1100)
  })
  it('felhasználás után a maradék átlagára nem változik, a következő bevételezés abból számol', () => {
    const db = seed()
    const it0 = db.items.find(i => i.id === 'kesz')!
    it0.stock = 10; it0.price = 1000
    receiveStock(db, it0, { qty: 10, unitPrice: 1200 })
    expect(it0.price).toBe(1100)
    consumeStock(db, it0, 5)
    expect(it0.stock).toBe(15); expect(it0.price).toBe(1100)
    receiveStock(db, it0, { qty: 5, unitPrice: 1300 })
    expect(it0.price).toBe(1150)
  })
  it('negatív készletnél a meglévő mennyiség 0-nak számít', () => {
    expect(weightedAvg(-3, 500, 10, 700)).toBe(700)
  })
  it('a mintában a kompozit két ár átlaga (500 és 540 → 520)', () => {
    expect(seed().items.find(i => i.id === 'komp')!.price).toBe(520)
  })
})

describe('gyártási tételek', () => {
  it('a kiadás lejárat szerint történik (ami előbb lejár, az fogy előbb)', () => {
    const db = seed()
    const amp = db.items.find(i => i.id === 'amp')!
    const first = previewLots(db, 'amp', 1)[0]!
    expect(first.lot).toBe('AR24-0915')
    const used = consumeStock(db, amp, 45)
    expect(used.map(u => [u.lot, u.qty])).toEqual([['AR24-0915', 40], ['AR25-0311', 5]])
    expect(db.lots.some(l => l.lot === 'AR24-0915')).toBe(false)
  })
  it('LOT-keresés megtalálja az implantátumot kapott pácienst', () => {
    const db = seed()
    const hits = lotSearch(db, 'IM2408-2210')
    expect(hits.length).toBe(1)
    expect(db.patients.find(p => p.id === hits[0]!.patientId)!.name).toBe('Nagy Péter')
  })
})

describe('rendelési javaslat', () => {
  it('a már megrendelt mennyiséggel csökken', () => {
    const db = seed()
    const s = orderSuggestions(db).find(x => x.item.id === 'ideig')
    expect(s?.onOrder).toBe(40)
    const before = s ? s.qty : 0
    db.orders = []
    const s2 = orderSuggestions(db).find(x => x.item.id === 'ideig')!
    expect(s2.qty).toBe(before + 40)
  })
})

describe('rendelői adminisztráció', () => {
  it('van esedékes kontroll-meghívó a mintában', () => {
    expect(recallRows(seed()).length).toBeGreaterThan(2)
  })
  it('közérthető fogmegnevezés', () => {
    expect(layTooth(46)).toBe('jobb alsó hatos fog (46)')
    expect(layTooth(75)).toBe('bal alsó ötös tejfog (75)')
  })
  it('a tájékoztató és a nyilatkozat a kezelésből készül', () => {
    const db = seed()
    const r = db.records.find(x => x.typeIds.includes('huzas'))!
    expect(patientInfoDraft(db, r)).toContain('Foghúzás')
    expect(consentFor(db, ['gyoker'], [46]).title).toContain('gyökérkezelés')
  })
  it('sterilizációs napló: van sikertelen ciklus és tételszámos kezelés', () => {
    const db = seed()
    expect(db.sterCycles.some(c => !c.ok)).toBe(true)
    expect(db.records.some(r => r.sterBatch)).toBe(true)
  })
})
