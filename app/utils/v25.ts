// A specifikáció v2.5 üzleti szabályai (tiszta függvények, tesztelhetők):
// – 3. pont: rendelő (és váróterem) törlése, inaktiválása; mi kapcsolódik egy rendelőhöz;
// – 5. pont (B-015): új rendelő automatikus, sorszámozott neve; az alaprajz rácsának oszlopszáma;
// – a régebbi böngészős adatok kiegészítése úgy, hogy a törölt minta-rendelő újratöltés után se jöjjön vissza.
import { today } from './dates'
import type { Appointment, DB, Room } from './types'

/** a régi adatok kiegészítése: a v2.4 egyszer, a 2. minta-rendelő pótlásakor jelölést tesz – a törölt rendelő ezután nem kerül vissza */
export function ensureV25(db: DB): DB {
  db.rooms.forEach(r => { if (r.active === undefined) r.active = true })
  return db
}

/** az aktív (alaprajzon és a választókban megjelenő) rendelők */
export const activeRooms = (db: Pick<DB, 'rooms'>): Room[] => db.rooms.filter(r => r.active !== false)

/** az időpont rendelője: a jövőbeli időpontnál a kezelő orvos aktuális rendelője, a múltbelinél a rögzített rendelő */
export function apptRoom(db: Pick<DB, 'doctors'>, a: Appointment, t0 = today()): string | undefined {
  if (a.date >= t0) return db.doctors.find(d => d.id === a.doctorId)?.roomId || a.roomId
  return a.roomId
}

export interface RoomLinks {
  /** átrendelhető kapcsolat: amíg van, a rendelő nem törölhető (előbb át kell rendelni) */
  blocking: string[]
  /** csak múltbeli, át nem rendelhető adat: törlés helyett inaktiválható */
  past: string[]
}
/** mi kapcsolódik egy rendelőhöz (v2.5 3. pont 4–5.): hozzárendelt orvos (és így a jövőbeli beosztása), jövőbeli időpont; múltbeli időpont */
export function roomLinks(db: DB, roomId: string, isDone: (a: Appointment) => boolean = () => false, t0 = today()): RoomLinks {
  const blocking: string[] = [], past: string[] = []
  const docs = db.doctors.filter(d => d.roomId === roomId)
  if (docs.length) blocking.push(`hozzárendelt orvos: ${docs.map(d => d.name).join(', ')}`)
  const future = db.appointments.filter(a => a.date >= t0 && !isDone(a) && apptRoom(db, a, t0) === roomId)
  if (future.length) blocking.push(`${future.length} jövőbeli időpont`)
  const old = db.appointments.filter(a => (a.date < t0 || isDone(a)) && a.roomId === roomId)
  if (old.length) past.push(`${old.length} lezárt / múltbeli időpont`)
  return { blocking, past }
}

export type RemoveVerdict = { kind: 'delete' } | { kind: 'blocked'; reasons: string[] } | { kind: 'inactivate'; reasons: string[] } | { kind: 'last' }
/** törölhető-e a rendelő: ha átrendelhető adat kapcsolódik hozzá, nem; ha csak múltbeli, inaktiválható; különben törölhető */
export function roomRemoval(db: DB, roomId: string, isDone?: (a: Appointment) => boolean, t0 = today()): RemoveVerdict {
  const l = roomLinks(db, roomId, isDone, t0)
  if (l.blocking.length) return { kind: 'blocked', reasons: l.blocking }
  if (l.past.length) return { kind: 'inactivate', reasons: l.past }
  if (activeRooms(db).filter(r => r.id !== roomId).length === 0 && db.rooms.find(r => r.id === roomId)?.active !== false) return { kind: 'last' }
  return { kind: 'delete' }
}
/** a rendelő végleges törlése (a listából, az alaprajzról és a választókból is eltűnik) */
export function deleteRoom(db: DB, roomId: string): void {
  db.rooms = db.rooms.filter(r => r.id !== roomId)
}
/** inaktiválás: az alaprajzról és a választókból eltűnik, a múltbeli adatokban megmarad */
export function setRoomActive(db: DB, roomId: string, on: boolean): void {
  const r = db.rooms.find(x => x.id === roomId); if (r) r.active = on
}

/** v2.5 5. pont 5.: új rendelő automatikus, sorszámozott neve („3. rendelő”); foglalt sorszámot nem ad ki újra */
export function nextRoomName(rooms: Pick<Room, 'name'>[]): string {
  const used = new Set(rooms.map(r => r.name.trim().toLowerCase()))
  let n = rooms.length + 1
  while (used.has(`${n}. rendelő`)) n++
  return `${n}. rendelő`
}
/** v2.5 5. pont 1.: soronként asztali gépen legfeljebb 3, táblagépen 2, telefonon 1 rendelő (a tényleges elrendezést a CSS-rács adja) */
export function planColumns(width: number, rooms: number): number {
  const max = width >= 1024 ? 3 : width >= 600 ? 2 : 1
  return Math.max(1, Math.min(max, rooms))
}
