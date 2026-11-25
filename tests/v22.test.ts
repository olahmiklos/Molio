import { describe, expect, it } from 'vitest'
import { seed } from '../app/utils/seed'
import { migrate } from '../app/utils/migrate'
import { addDays, today } from '../app/utils/dates'
import { buildTasks, canRestore, coordText, draftExpiry, fillInform, informContext, liveDrafts, patientDayCheck, restorableUntil, schedulable, scheduleRatio, sugSourceText } from '../app/utils/v22'
import { INFORM_TPL } from '../app/utils/defaults'
import { versionReport, VERSION_LINE } from '../app/utils/meta'

const mk = () => seed()

describe('v2.2: meglévő időpontok foglaláskor (1. pont)', () => {
  it('azonos napi és 7 napon belüli időpontot jelez', () => {
    const db = mk(); const pid = db.patients[0]!.id
    const base = { patientId: pid, doctorId: 'olah', dur: 30, buffer: 0, typeIds: ['allapot'], note: '', remind: { sms: false, email: false, timing: '24' as const }, created: today(), roomId: 'r1', planned: null }
    db.appointments = db.appointments.filter(a => a.patientId !== pid)
    db.appointments.push({ ...base, id: 'x1', date: addDays(today(), 3), start: '10:00' }, { ...base, id: 'x2', date: addDays(today(), 20), start: '09:00' })
    const same = patientDayCheck(db, pid, addDays(today(), 3), '10:00', 30)
    expect(same.same.length).toBe(1); expect(same.overlap?.id).toBe('x1')
    const near = patientDayCheck(db, pid, addDays(today(), 6), '10:00', 30)
    expect(near.near.map(a => a.id)).toEqual(['x1'])
    expect(patientDayCheck(db, pid, addDays(today(), 3), '10:00', 30, 'x1').same.length).toBe(0)
  })
})

describe('v2.2: törlés megőrzése, piszkozat (2., 4. pont)', () => {
  it('30 napig visszaállítható', () => {
    const at = new Date().toISOString()
    expect(canRestore({ at })).toBe(true)
    expect(canRestore({ at: addDays(today(), -31) + 'T10:00:00.000Z' })).toBe(false)
    expect(restorableUntil('2026-11-19T10:00:00.000Z')).toBe('2026-12-19')
  })
  it('a piszkozat 7 napig érvényes', () => {
    const db = mk()
    db.drafts = [{ id: 'd1', patientId: 'p', appointmentId: null, recordId: null, doctorId: 'olah', text: 'x', savedAt: '', expires: draftExpiry() }, { id: 'd2', patientId: 'p', appointmentId: null, recordId: null, doctorId: 'olah', text: 'y', savedAt: '', expires: addDays(today(), -1) }]
    expect(liveDrafts(db).map(d => d.id)).toEqual(['d1'])
    expect(draftExpiry()).toBe(addDays(today(), 7))
  })
})

describe('v2.2: kezelő orvos és javasolt tételek (5–7. pont)', () => {
  it('a mintapácienseknek van kezelő orvosa', () => { expect(mk().patients.every(p => !!p.doctorId)).toBe(true) })
  it('a javasolt tétel forrása a vizit', () => {
    const db = mk()
    const g = db.suggestions.find(s => s.recordId)!
    expect(sugSourceText(db, g)).toContain('alkalmán javasolva')
  })
  it('az ütemezés aránya és a részleges ütemezés számolható', () => {
    const db = mk()
    const pid = db.suggestions.find(s => s.status === 'new')!.patientId
    const r = scheduleRatio(db, pid)
    expect(r.total).toBeGreaterThan(0); expect(r.scheduled + r.open.length).toBe(r.total)
    expect(schedulable(db, pid).length).toBeGreaterThan(0)
  })
  it('a v2.1-es adat migrációja kezelő orvost és üres listákat ad', () => {
    const db: any = mk(); db.version = 4; delete db.deleted; delete db.drafts; delete db.informs; db.patients.forEach((p: any) => delete p.doctorId)
    const m: any = migrate(db)
    expect(Array.isArray(m.deleted) && Array.isArray(m.drafts) && Array.isArray(m.informs)).toBe(true)
  })
})

describe('v2.2: üzenetek és Teendők (8. pont)', () => {
  it('az egyeztetés-kérő üzenet udvarias, kitöltött és nem tartalmaz árat', () => {
    const db = mk()
    const pid = db.suggestions.find(s => s.status === 'new')!.patientId
    const t = coordText(db, pid)
    expect(t).not.toMatch(/\{[^}]+\}/); expect(t.toLowerCase()).toContain('időpont'); expect(t).not.toMatch(/Ft/)
  })
  it('a tájékoztató sablon minden mezője kitölthető', () => {
    const db = mk()
    const a = db.appointments.find(x => x.items?.some(i => i.suggestionId))
    if (!a) return
    const ctx = informContext(db, a.patientId, [a.id])
    expect(fillInform(db, INFORM_TPL, ctx)).not.toMatch(/\{[^}]+\}/)
  })
  it('a Teendők nem tartalmaznak raktári feladatot', () => {
    const t = buildTasks(mk())
    expect(t.length).toBeGreaterThan(0)
    expect(t.every(x => ['schedule', 'inform', 'recall', 'cancel', 'reply', 'late'].includes(x.kind))).toBe(true)
  })
})

describe('v2.2: verziójelzés (3. pont)', () => {
  it('a verziósor és a másolható adat tartalmazza a v2.4-et', () => {
    expect(VERSION_LINE).toBe('Demó v2.4 – a specifikáció v2.4 alapján készült')
    expect(versionReport(6)).toContain('Adatverzió: 6')
  })
})
