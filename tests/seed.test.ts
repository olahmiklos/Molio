import { describe, expect, it } from 'vitest'
import { seed } from '../app/utils/seed'
import { attention } from '../app/utils/logic'
import { toMin } from '../app/utils/dates'

describe('mintaadatok', () => {
  const db = seed()
  it('nincs ütköző időpont (a ráhagyással együtt), és minden a rendelési időn belül van', () => {
    for (const a of db.appointments) {
      const s = toMin(a.start), e = s + a.dur + a.buffer
      expect(s).toBeGreaterThanOrEqual(db.settings.startHour * 60)
      expect(e).toBeLessThanOrEqual(db.settings.endHour * 60)
      const clash = db.appointments.find(b => b.id !== a.id && b.doctorId === a.doctorId && b.date === a.date && !(e <= toMin(b.start) || toMin(b.start) + b.dur + b.buffer <= s))
      expect(clash).toBeUndefined()
    }
  })
  it('van korábbi kezelés felszínekkel, státusz és tejfogas páciens', () => {
    expect(db.records.some(r => Object.keys(r.surfaces).length)).toBe(true)
    expect(db.patients.some(p => p.dentition === 'primary')).toBe(true)
    expect(db.patients.some(p => p.statuses.length)).toBe(true)
  })
  it('a raktárban néhány anyag figyelmeztet', () => {
    const n = attention(db).length
    console.log('figyelmeztető anyagok:', attention(db).map(i => i.id).join(', '), '· időpontok:', db.appointments.length, '· kezelések:', db.records.length)
    expect(n).toBeGreaterThan(0)
    expect(n).toBeLessThan(7)
  })
})
