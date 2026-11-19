// Naptár: sávok, ütközés, szabad időpontok (a ráhagyási idő foglaltnak számít)
import { addDays, dow, fromMin, nowMin, toMin, today } from './dates'
import type { Appointment, DB } from './types'
import { HORIZON } from './logic'

export const slotsList = (db: DB) => { const out: number[] = []; for (let m = db.settings.startHour * 60; m < db.settings.endHour * 60; m += 30) out.push(m); return out }
export const apptsOn = (db: DB, date: string, doctorId?: string) => db.appointments.filter(a => a.date === date && (!doctorId || a.doctorId === doctorId))
/** foglalt sávok száma (kezelés + ráhagyás) */
export const usedSlots = (db: DB, date: string, doctorId?: string) => apptsOn(db, date, doctorId).reduce((s, a) => s + (a.dur + (a.buffer || 0)) / 30, 0)

export function overlaps(db: DB, doctorId: string, date: string, start: string, dur: number, buffer: number, exceptId?: string | null) {
  const s = toMin(start), e = s + dur + (buffer || 0)
  return db.appointments.find(a => a.id !== exceptId && a.doctorId === doctorId && a.date === date && !(e <= toMin(a.start) || toMin(a.start) + a.dur + (a.buffer || 0) <= s))
}

export function freeSlots(db: DB, doctorId: string, dur: number, buffer: number, n: number, exceptId?: string | null) {
  const out: [string, string][] = [], t0 = today(), nm = nowMin()
  for (let d = t0; out.length < n && d <= addDays(t0, HORIZON); d = addDays(d, 1)) {
    if (dow(d) > 5) continue
    for (const m of slotsList(db)) {
      if (m + dur + buffer > db.settings.endHour * 60) break
      if (d === t0 && m <= nm) continue
      if (!overlaps(db, doctorId, d, fromMin(m), dur, buffer, exceptId)) { out.push([d, fromMin(m)]); if (out.length >= n) break }
    }
  }
  return out
}

/** az adott időponttal (a ráhagyással együtt) ütköző másik foglalások ugyanannál az orvosnál */
export function conflictsOf(db: DB, a: Pick<Appointment, 'id' | 'doctorId' | 'date' | 'start' | 'dur' | 'buffer'>) {
  const s = toMin(a.start), e = s + a.dur + (a.buffer || 0)
  return db.appointments.filter(b => b.id !== a.id && b.doctorId === a.doctorId && b.date === a.date && !(e <= toMin(b.start) || toMin(b.start) + b.dur + (b.buffer || 0) <= s))
}
