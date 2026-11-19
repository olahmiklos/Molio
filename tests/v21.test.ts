import { describe, expect, it } from 'vitest'
import { seed } from '../app/utils/seed'
import { analyzeItems, analyzeStatus } from '../app/utils/parser'
import { isCancelReply, itemFee, pkgForItems } from '../app/utils/logic'
import { emptyFilters, filterRows, stockRows } from '../app/utils/stockFilter'
import { migrate } from '../app/utils/migrate'
import { recallRows, recallText } from '../app/utils/office'
import { isOpenSuggestion, needsFollowUp } from '../app/utils/suggest'
import { conflictsOf } from '../app/utils/calendar'

const db = seed()

describe('2. pont: kezelési tételek (fog × művelet)', () => {
  it('két fog két művelete párokra bomlik', () => {
    const r = analyzeItems('36-os fog tömés, 37-es fog húzás', db)
    const k = r.done.map(p => `${p.tooth}:${p.typeId}`)
    expect(k).toContain('36:tomes'); expect(k).toContain('37:huzas')
  })
  it('a javaslatként említett kezelés nem elvégzett', () => {
    const r = analyzeItems('36-os fog tömés. A 26-os fogon gyökérkezelés szükséges két héten belül.', db)
    expect(r.suggested.some(s => s.tooth === 26 && s.typeId === 'gyoker')).toBe(true)
    expect(r.done.some(p => p.tooth === 26)).toBe(false)
    expect(r.suggested.find(s => s.tooth === 26)!.dueDays).toBeLessThanOrEqual(14)
  })
  it('a tételek díja és anyagcsomagja tételenként számolódik', () => {
    const items = [{ tooth: 36, typeId: 'huzas', surfaces: [] }, { tooth: 37, typeId: 'huzas', surfaces: [] }]
    expect(itemFee(db, 'huzas', [])).toBeGreaterThan(0)
    const pkg = pkgForItems(db, items)
    const one = pkgForItems(db, [items[0]!])
    Object.keys(one).forEach(k => expect(pkg[k]).toBeGreaterThanOrEqual(one[k]!))
  })
})

describe('4. pont: fogállapot diktálásból és oldal-ellenőrzés', () => {
  it('„bal alsó 48-as” ellentmondást jelez', () => {
    const r = analyzeItems('bal alsó 48-as fog húzás', db)
    expect(r.conflicts.length).toBe(1)
    expect(r.conflicts[0]!.n).toBe(48)
  })
  it('csak a kimondott fogra rögzít állapotot', () => {
    const r = analyzeStatus('a 16-os fog hiányzik', db.settings.statusDict, 'permanent', { explicitOnly: true })
    expect(Object.keys(r.teeth)).toEqual(['16'])
  })
})

describe('9. pont: NEM válasz felismerése', () => {
  it.each(['nem', 'Nem', 'NEM!', 'nem tudok', 'Sajnos nem tudok jönni', 'nemm'])('„%s” lemondás', t => expect(isCancelReply(t)).toBe(true))
  it.each(['igen', 'köszönöm', 'rendben, ott leszek'])('„%s” nem lemondás', t => expect(isCancelReply(t)).toBe(false))
})

describe('8. pont: kontroll-felülvizsgálat', () => {
  it('a sablonból kitöltött szöveg tartalmazza a két dátumot', () => {
    const rows = recallRows(db, 400)
    expect(rows.length).toBeGreaterThan(0)
    const txt = recallText(db, rows[0]!)
    expect(txt).toContain(rows[0]!.patient.name)
    expect(txt).not.toMatch(/\{[^}]+\}/)
  })
  it('a „nem szükséges” jelölt sor elrejthető', () => {
    const r = recallRows(db, 400)[0]!
    db.recallSnoozes.push({ id: 'z1', patientId: r.patient.id, typeId: r.typeId, last: r.last, until: null, reason: 'teszt', date: r.last })
    expect(recallRows(db, 400).find(x => x.patient.id === r.patient.id && x.typeId === r.typeId)!.snoozed).not.toBeNull()
    db.recallSnoozes = []
  })
})

describe('10. pont: raktári szűrők', () => {
  it('az üres szűrő mindent, a szűkítő kevesebbet ad', () => {
    const rows = stockRows(db)
    expect(filterRows(rows, emptyFilters()).length).toBe(rows.length)
    expect(filterRows(rows, { ...emptyFilters(), q: 'tampon' }).length).toBeLessThan(rows.length)
    expect(filterRows(rows, { ...emptyFilters(), stockMin: 1e9 }).length).toBe(0)
  })
})

describe('12. pont: javasolt kezelések', () => {
  it('a mintaadatban van nyitott javaslat és újrajelzésre váró', () => {
    expect(db.suggestions.some(isOpenSuggestion)).toBe(true)
    expect(db.suggestions.some(needsFollowUp)).toBe(true)
  })
})

describe('6. és 9. pont: ütközés és migráció', () => {
  it('a seed időpontjai nem ütköznek egymással', () => {
    db.appointments.forEach(a => expect(conflictsOf(db, a)).toHaveLength(0))
  })
  it('a v4 adat nem destruktívan migrálódik', () => {
    const old = JSON.parse(JSON.stringify(db))
    delete old.suggestions; delete old.recallSnoozes; delete old.savedFilters; delete old.settings.recallTemplates
    old.appointments.forEach((a: Record<string, unknown>) => { a.confirmed = true })
    const m = migrate(old, 5)
    expect(m.suggestions).toEqual([]); expect(m.settings.recallTemplates.length).toBeGreaterThan(0)
    expect(m.appointments.length).toBe(db.appointments.length)
    expect(m.appointments.every(a => !('confirmed' in a))).toBe(true)
  })
})
