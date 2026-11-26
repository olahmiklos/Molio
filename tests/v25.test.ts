// A specifikáció v2.5 tiszta függvényeinek tesztjei (1., 3., 4., 5. pont)
import { describe, expect, it } from 'vitest'
import { addDays, today } from '../app/utils/dates'
import { seed } from '../app/utils/seed'
import { ensureV24 } from '../app/utils/v24'
import { activeRooms, deleteRoom, ensureV25, nextRoomName, planColumns, roomRemoval, setRoomActive } from '../app/utils/v25'
import { clauseWithKw, clauseWithTooth, clauseWithWord, correctionRate, matchRules, phraseIn, safePhrase, sameTarget, type InterpRule } from '../app/utils/dict/interp'
import { OUTDATED_BUILD_PATH, outdatedBuild404 } from '../worker/index'
import worker from '../worker/index'
import type { Appointment, DB } from '../app/utils/types'

const fresh = (): DB => { const db = ensureV25(ensureV24(seed())); db.appointments = []; return db }
const appt = (o: Partial<Appointment> & { id: string; date: string }): Appointment => ({ patientId: 'p1', doctorId: 'csempesz', roomId: 'room-1', start: '10:00', dur: 30, buffer: 0, typeIds: ['kontroll'], note: '', remind: { sms: true, email: false }, created: today(), ...o })

describe('v2.5 1. pont (B-008): nincs csendes újratöltés', () => {
  it('a Worker a /_nuxt/builds/latest.json kérésre 404-et ad, gyorsítótárazás nélkül', async () => {
    expect(OUTDATED_BUILD_PATH).toBe('/_nuxt/builds/latest.json')
    const r = outdatedBuild404()
    expect(r.status).toBe(404)
    expect(r.headers.get('cache-control')).toContain('no-store')
    const env = { ASSETS: { fetch: async () => new Response('static', { status: 200 }) }, AI: { run: async () => ({}) } }
    const res = await worker.fetch(new Request('https://molio.example.dev/_nuxt/builds/latest.json?123'), env as never)
    expect(res.status).toBe(404)
    const other = await worker.fetch(new Request('https://molio.example.dev/_nuxt/app.js'), env as never)
    expect(other.status).toBe(200)
  })
})

describe('v2.5 3. pont: rendelő törlése és inaktiválása', () => {
  it('a 2. minta-rendelő a törlés után újratöltéskor sem jön vissza', () => {
    const db = fresh()
    expect(db.rooms.map(r => r.id)).toContain('room-2')
    db.doctors.forEach(d => { d.roomId = 'room-1' })
    expect(roomRemoval(db, 'room-2').kind).toBe('delete')
    deleteRoom(db, 'room-2')
    const reloaded = ensureV25(ensureV24(JSON.parse(JSON.stringify(db))))
    expect(reloaded.rooms.map(r => r.id)).not.toContain('room-2')
  })
  it('hozzárendelt orvos vagy jövőbeli időpont esetén nem törölhető, és megnevezi, mi kapcsolódik', () => {
    const db = fresh()
    const v = roomRemoval(db, 'room-2')
    expect(v.kind).toBe('blocked')
    if (v.kind === 'blocked') expect(v.reasons.join(' ')).toMatch(/hozzárendelt orvos/)
    db.doctors.forEach(d => { d.roomId = 'room-2' })
    db.appointments.push(appt({ id: 'a1', date: addDays(today(), 3) }))
    const w = roomRemoval(db, 'room-1')
    expect(w.kind).toBe('delete')
    const z = roomRemoval(db, 'room-2')
    expect(z.kind).toBe('blocked')
    if (z.kind === 'blocked') expect(z.reasons.join(' ')).toMatch(/1 jövőbeli időpont/)
  })
  it('csak múltbeli adatnál törlés helyett inaktiválható; az inaktív rendelő eltűnik a választókból', () => {
    const db = fresh()
    db.doctors.forEach(d => { d.roomId = 'room-2' })
    db.appointments.push(appt({ id: 'old', date: addDays(today(), -10), roomId: 'room-1' }))
    const v = roomRemoval(db, 'room-1')
    expect(v.kind).toBe('inactivate')
    setRoomActive(db, 'room-1', false)
    expect(activeRooms(db).map(r => r.id)).toEqual(['room-2'])
    expect(db.rooms.some(r => r.id === 'room-1')).toBe(true)
  })
  it('az utolsó aktív rendelő nem törölhető', () => {
    const db = fresh()
    db.doctors.forEach(d => { d.roomId = 'room-x' })
    deleteRoom(db, 'room-2')
    expect(roomRemoval(db, 'room-1').kind).toBe('last')
  })
})

describe('v2.5 5. pont (B-015): alaprajz', () => {
  it('új rendelő automatikus sorszámozott nevet kap, foglalt sorszámot nem ad ki', () => {
    expect(nextRoomName([{ name: '1. rendelő' }, { name: '2. rendelő' }])).toBe('3. rendelő')
    expect(nextRoomName([{ name: '1. rendelő' }, { name: '3. rendelő' }])).toBe('4. rendelő')
    expect(nextRoomName([{ name: 'Sebészet' }])).toBe('2. rendelő')
  })
  it('soronként asztali gépen legfeljebb 3, táblagépen 2, telefonon 1 rendelő', () => {
    expect(planColumns(1440, 7)).toBe(3)
    expect(planColumns(820, 7)).toBe(2)
    expect(planColumns(390, 7)).toBe(1)
    expect(planColumns(1440, 2)).toBe(2)
  })
})

describe('v2.5 4. pont: értelmezési javítás tanulása és mérése', () => {
  const rule = (o: Partial<InterpRule>): InterpRule => ({ id: 'i1', phrase: 'kerek ot tampont', cat: 'mennyiség', item: 'tamp', qty: 5, active: true, created: '', source: 'javitas', scope: 'rendelo', from: 'kerek ot tampont', to: 'Vattatampon 5 db', ...o })
  it('a tételt említő mondatrészből lesz a kifejezés', () => {
    expect(clauseWithKw('36-os fog, kompozit tömés. Kérek öt tampont. Polírozás.', ['tampon*'])).toBe('kerek ot tampont')
    expect(clauseWithKw('polírozás', ['tampon*'])).toBeNull()
    expect(clauseWithWord('fog 36, kerek ot pamacsot', ['pamacsot'])).toBe('kerek ot pamacsot')
    expect(clauseWithTooth('fog 36 tomes, fog 25 polir', 25)).toBe('fog 25 polir')
  })
  it('a szabály a következő diktálásban szóhatáron illeszkedik; a visszavont és a kikapcsolt nem fut', () => {
    expect(phraseIn('Fog 36, kérek öt tampont.', 'kerek ot tampont')).toBe(true)
    expect(phraseIn('kerek otven tampont', 'kerek ot tampont')).toBe(false)
    const r = rule({})
    expect(matchRules('kérek öt tampont', [r]).length).toBe(1)
    expect(matchRules('kérek öt tampont', [r], ['i1']).length).toBe(0)
    expect(matchRules('kérek öt tampont', [{ ...r, active: false }]).length).toBe(0)
  })
  it('ugyanarra a kifejezésre és tételre vonatkozó javítás ütközés (a legutóbbi érvényes); személyes adatból nem lesz szabály', () => {
    expect(sameTarget(rule({}), rule({ qty: 4 }))).toBe(true)
    expect(sameTarget(rule({}), rule({ item: 'gez' }))).toBe(false)
    expect(safePhrase('Kovács Anna')).toBe(false)
    expect(safePhrase('kerek ot tampont')).toBe(true)
  })
  it('mérés: lefutások és utólagos javítások aránya', () => {
    expect(correctionRate({ uses: 0, corrected: 0 })).toBeNull()
    expect(correctionRate({ uses: 4, corrected: 1 })).toBe(0.25)
  })
})
