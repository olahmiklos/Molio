// Mintaadatok (Cooldent Kft., kitalált páciensek), az első megnyitás napjához igazítva.
// A böngészős demó és a PostgreSQL seed (prisma/seed.ts) ugyanezt a generátort használja.
import { addDays, dow, fromMin, toMin, today, uid } from './dates'
import type { Appointment, DB, Patient, StatusSnapshot, SurfaceMap } from './types'
import { defaultItems, defaultNotify, defaultTypes, ROOM_ID, SITE_ID } from './defaults'
import { analyze, DEFAULT_STATUS_DICT } from './parser'
import { bufferFor, feeFor, forecastItem, HORIZON, pkgFor, surfacesFor, typeNames } from './logic'
import { overlaps } from './calendar'
import { allTeeth } from './teeth'

export const DB_VERSION = 3

function tajFrom(base8: string) {
  const d = base8.split('').map(Number)
  let s = 0; d.forEach((v, i) => { s += v * (i % 2 === 0 ? 3 : 7) })
  const full = base8 + (s % 10)
  return full.slice(0, 3) + ' ' + full.slice(3, 6) + ' ' + full.slice(6)
}

/** mintadiktálások a korábbi kezelésekhez (típusonként több változat, eltérő fogakkal) */
export const SAMPLE_TEXT: Record<string, string[]> = {
  tomes: [
    '36-os fog, disztális felszínen szuvasodás. Érzéstelenítés egy ampulla artikainnal. Kavitás preparálása, savazás, bond, kompozit tömés két rétegben, polírozás. Panaszmentes.',
    '25-ös fog, meziális és rágófelszíni szuvasodás. Érzéstelenítés lidokain ampullával. Savazás, bond, kompozit tömés, polírozás.',
    '14-es fog okkluzális kompozit tömése érzéstelenítés nélkül. Polírozás. Kontroll fél év múlva.',
    '46-os MOD kompozit tömés. Érzéstelenítés két ampulla artikainnal. Kérek négy tampont. Polírozás.',
  ],
  gyoker: [
    '46-os fog gyökérkezelése. Érzéstelenítés után trepanálás, a gyökércsatornák feltárása és tágítása reszelőkkel, öblítés nátrium-hipoklorittal. Guttapercha csúcsokkal gyökértöltés, ideiglenes zárás. Kontroll két hét múlva.',
    '21-es fog gyökérkezelése. Trepanálás, tágítás reszelőkkel, öblítés. Gyökértöltés guttapercha csúcsokkal, ideiglenes zárás. Korona javasolt.',
  ],
  fogko: ['Fogkő-eltávolítás ultrahanggal az alsó és felső fogívben, ezt követően polírozás polírpasztával. Szájhigiéniás tanácsadás.'],
  kontroll: ['Éves állapotfelmérés. A fogazat ép, új szuvasodás nem látható. Enyhe fogkő, fogkő-eltávolítás javasolt fél éven belül.'],
  huzas: [
    '38-as bölcsességfog eltávolítása érzéstelenítésben. A seb tamponnal ellátva. Utasítások szóban átadva.',
    '48-as bölcsességfog eltávolítása. Két gézlap a sebre. Kontroll egy hét múlva.',
  ],
  korona: [
    '21-es fog előkészítése koronához: csiszolás, lenyomatvétel szilikon lenyomatanyaggal, ideiglenes korona felhelyezése.',
    '16-os fog előkészítése koronához, lenyomatvétel, ideiglenes korona.',
  ],
}

/** a tömésre foglalt időpontok tervezett foga és felszíne */
const PLANNED: { teeth: number[]; surfaces: SurfaceMap }[] = [
  { teeth: [26], surfaces: { 26: ['M'] } },
  { teeth: [15], surfaces: { 15: ['D', 'O'] } },
  { teeth: [47], surfaces: { 47: ['O'] } },
  { teeth: [24], surfaces: { 24: ['M', 'O', 'D'] } },
]

const statusFrom = (date: string, dentition: 'primary' | 'permanent', map: Record<string, string[]>, rest = 'ep', note = ''): StatusSnapshot => {
  const teeth: Record<string, string[]> = {}
  allTeeth(dentition).forEach(n => { teeth[n] = map[n] || [rest] })
  return { id: uid(), date, dentition, teeth, note }
}

export function seed(): DB {
  const t0 = today()
  const db: DB = {
    version: DB_VERSION, seededAt: t0,
    company: { id: 'cooldent', name: 'Cooldent Kft.', address: '1114 Budapest, Bartók Béla út 56.', phone: '+36 1 555 0123', email: 'info@cooldent.example' },
    sites: [{ id: SITE_ID, companyId: 'cooldent', name: 'Budai telephely', address: '1114 Budapest, Bartók Béla út 56.', phone: '+36 1 555 0123', startHour: 10, endHour: 20 }],
    rooms: [{ id: ROOM_ID, siteId: SITE_ID, name: '1. rendelő' }],
    settings: {
      clinic: 'Cooldent Kft.', address: '1114 Budapest, Bartók Béla út 56.', phone: '+36 1 555 0123', startHour: 10, endHour: 20,
      notify: defaultNotify(), primaryAgeLimit: 12, patientBuffer: 30, statusDict: DEFAULT_STATUS_DICT.map(d => ({ ...d, kw: [...d.kw] })),
    },
    doctors: [{ id: 'csempesz', name: 'Dr. Csempesz' }, { id: 'olah', name: 'Dr. Oláh' }],
    items: defaultItems(), types: defaultTypes(),
    patients: [], appointments: [], records: [], movements: [], attachments: [], events: [],
  }
  const yearsAgo = (y: number, md: string) => `${Number(t0.slice(0, 4)) - y}-${md}`
  const P: [string, string, string, string, string, string, string, string, boolean?][] = [
    ['Kiss Anna', '1978-03-14', '24187356', '+36 30 555 0101', 'kiss.anna@pelda.hu', '1111 Budapest, Bartók Béla út 21.', 'Penicillin-allergia.', ''],
    ['Nagy Péter', '1965-11-02', '11829304', '+36 20 555 0102', 'nagy.peter@pelda.hu', '1117 Budapest, Október huszonharmadika utca 8.', '', 'A számlát cégre kéri (Nagy és Társa Bt.).'],
    ['Szabó Eszter', '1990-07-21', '31455820', '+36 70 555 0103', 'szabo.eszter@pelda.hu', '2040 Budaörs, Szabadság út 45.', '', 'Fogorvostól tart, nyugodt tempót kér.', true],
    ['Tóth Gábor', '1983-01-09', '20937416', '+36 30 555 0104', 'toth.gabor@pelda.hu', '1114 Budapest, Bocskai út 3.', '', ''],
    ['Horváth Júlia', '1972-05-30', '17284065', '+36 20 555 0105', 'horvath.julia@pelda.hu', '1118 Budapest, Villányi út 60.', 'Vérhígítót szed – vérzékenység figyelése.', ''],
    ['Varga Bence', '1998-09-17', '35610972', '+36 70 555 0106', 'varga.bence@pelda.hu', '1119 Budapest, Fehérvári út 88.', '', 'Munkahelyéről jön, gyakran késik a forgalom miatt.'],
    ['Kovács Mária', '1956-12-05', '09347281', '+36 30 555 0107', 'kovacs.maria@pelda.hu', '1112 Budapest, Budaörsi út 14.', 'Magas vérnyomás, rendszeresen gyógyszert szed.', 'Délelőtti időpontot kér. Felső részleges fogpótlása van.'],
    ['Molnár Dávid', '1987-04-26', '22764019', '+36 20 555 0108', 'molnar.david@pelda.hu', '2030 Érd, Budai út 5.', '', ''],
    ['Kovács Lili', yearsAgo(8, '04-11'), '42319087', '+36 30 555 0107', 'kovacs.maria@pelda.hu', '1112 Budapest, Budaörsi út 14.', '', 'Nagymamája (Kovács Mária) kíséri; a kezelés után matricát kap.'],
    ['Tóth Bálint', yearsAgo(14, '02-23'), '43870215', '+36 30 555 0104', 'toth.gabor@pelda.hu', '1114 Budapest, Bocskai út 3.', 'Földimogyoró-allergia.', ''],
  ]
  db.patients = P.map((p, i): Patient => ({
    id: uid(), name: p[0], birth: p[1], taj: tajFrom(p[2]), phone: p[3], email: p[4], address: p[5],
    healthWarning: p[6], internalNote: p[7], needsBuffer: !!p[8],
    dentition: i === 8 ? 'primary' : 'permanent', dentitionHistory: [], statuses: [],
    created: i >= 8 ? addDays(t0, -2100) : addDays(t0, -200), remind: { sms: true, email: false },
  }))
  const pt = (i: number) => db.patients[i]!
  // fogazat és státusz
  pt(8).dentitionHistory = [{ date: addDays(t0, -2100), to: 'primary' }]
  pt(9).dentitionHistory = [{ date: addDays(t0, -2100), to: 'primary' }, { date: addDays(t0, -160), to: 'permanent' }]
  pt(0).statuses.push(statusFrom(addDays(t0, -400), 'permanent', { 18: ['hianyzik'], 28: ['hianyzik'], 38: ['hianyzik'], 48: ['hianyzik'], 26: ['tomott'], 36: ['szuvas'] }))
  pt(6).statuses.push(statusFrom(addDays(t0, -190), 'permanent', {
    18: ['hianyzik'], 17: ['hianyzik'], 28: ['hianyzik'], 38: ['hianyzik'], 48: ['hianyzik'], 16: ['korona'], 26: ['korona'], 25: ['hidtag'], 24: ['korona'],
    36: ['tomott'], 46: ['tomott'], 47: ['gyokerkezelt', 'korona'], 37: ['implantatum'], 14: ['gyokermaradvany'],
  }))
  pt(8).statuses.push(statusFrom(addDays(t0, -100), 'primary', { 75: ['szuvas'], 84: ['tomott'], 64: ['szuvas'] }))
  pt(9).statuses.push(statusFrom(addDays(t0, -2000), 'primary', { 55: ['szuvas'], 85: ['tomott'] }, 'ep', 'Tejfogazat, 8 évesen'))
  pt(9).statuses.push(statusFrom(addDays(t0, -150), 'permanent', { 18: ['hianyzik'], 28: ['hianyzik'], 38: ['hianyzik'], 48: ['hianyzik'], 16: ['tomott'] }, 'ep', 'Váltás maradó fogazatra'))

  const typeDur = (id: string) => db.types.find(t => t.id === id)!.dur
  const pastTypes = ['tomes', 'gyoker', 'fogko', 'kontroll', 'huzas', 'korona', 'tomes', 'fogko']
  const futTypes = ['fogko', 'tomes', 'fogko', 'gyoker', 'fogko', 'kontroll', 'tomes', 'fogko', 'huzas', 'fogko', 'korona', 'tomes']
  let k = 0, pastIdx = 0, futIdx = 0, planIdx = 0
  const end = db.settings.endHour * 60
  for (let d = addDays(t0, -14); d <= addDays(t0, HORIZON); d = addDays(d, 1)) {
    const w = dow(d)
    if (w < 2 || w > 5) continue // csak kedd–péntek
    const past = d < t0
    const type = past ? pastTypes[pastIdx % pastTypes.length]! : futTypes[futIdx % futTypes.length]!
    const patient = past ? pt(pastIdx % 8) : pt((futIdx * 3 + 1) % 8)
    if (past) pastIdx++; else futIdx++
    const dur = typeDur(type), buffer = bufferFor(db, [type], patient)
    const slots = (20 - 10) * 2 - (dur + buffer) / 30 + 1
    let start = 10 * 60 + 30 * ((k * 5 + 2) % slots)
    if (d === t0) start = Math.max(start, 15 * 60) // a mai időpont délután legyen
    if (start + dur + buffer > end) start = end - dur - buffer
    const planned = type === 'tomes' && !past ? PLANNED[planIdx++ % PLANNED.length]! : null
    db.appointments.push({ id: uid(), patientId: patient.id, doctorId: db.doctors[k % 2]!.id, roomId: ROOM_ID, date: d, start: fromMin(start), dur, buffer, typeIds: [type], note: '', remind: { sms: true, email: false }, created: t0, planned: planned ? JSON.parse(JSON.stringify(planned)) : null })
    k++
  }
  // a gyerekpáciensek időpontjai
  const nextWorkday = (from: string) => { let d = from; while (dow(d) > 5) d = addDays(d, 1); return d }
  db.appointments.push({ id: uid(), patientId: pt(8).id, doctorId: 'olah', roomId: ROOM_ID, date: nextWorkday(addDays(t0, 3)), start: '10:00', dur: 60, buffer: 0, typeIds: ['tomes'], note: 'Szülő kíséri', remind: { sms: true, email: true, timing: '24' }, created: t0, planned: { teeth: [75], surfaces: { 75: ['O'] } } })
  db.appointments.push({ id: uid(), patientId: pt(9).id, doctorId: 'csempesz', roomId: ROOM_ID, date: nextWorkday(addDays(t0, 6)), start: '10:30', dur: 30, buffer: 0, typeIds: ['kontroll'], note: '', remind: { sms: true, email: false, timing: '24' }, created: t0 })

  // sűrűbb naptár a közeli napokra: napi 2–3 további időpont a két orvosnál
  const extraTypes = ['kontroll', 'tomes', 'fogko', 'kontroll', 'tomes', 'gyoker', 'kontroll', 'tomes']
  let e = 0
  for (let d = addDays(t0, -10); d <= addDays(t0, 21); d = addDays(d, 1)) {
    if (dow(d) > 5) continue
    const n = 2 + (e % 2)
    for (let j = 0; j < n; j++, e++) {
      const type = extraTypes[e % extraTypes.length]!
      const patient = pt((e * 5 + 3) % 8)
      const doctorId = db.doctors[(e + 1) % 2]!.id
      const dur = typeDur(type), buffer = bufferFor(db, [type], patient)
      let found: number | null = null
      for (let k2 = 0; k2 < 20 && found === null; k2++) {
        const m = 10 * 60 + 30 * ((e * 7 + j * 5 + k2) % 20)
        if (m + dur + buffer > end) continue
        if (d === t0 && m < 13 * 60) continue
        if (!overlaps(db, doctorId, d, fromMin(m), dur, buffer)) found = m
      }
      if (found === null) continue
      const planned = type === 'tomes' && d >= t0 ? PLANNED[planIdx++ % PLANNED.length]! : null
      db.appointments.push({ id: uid(), patientId: patient.id, doctorId, roomId: ROOM_ID, date: d, start: fromMin(found), dur, buffer, typeIds: [type], note: '', remind: { sms: true, email: false }, created: t0, planned: planned ? JSON.parse(JSON.stringify(planned)) : null })
    }
  }

  // korábbi kezelések a múltbeli időpontokhoz
  const usedTotals: Record<string, number> = {}
  let recIdx = 0
  db.appointments.filter(a => a.date < t0).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)).forEach(a => {
    const tp = a.typeIds[0]!, variants = SAMPLE_TEXT[tp]!, text = variants[(recIdx++) % variants.length]!
    const parsed = analyze(text, db)
    const pk = pkgFor(db, a.typeIds, Math.max(1, parsed.teeth.length), surfacesFor(parsed.teeth, parsed.surfaces))
    const mats = Object.entries(pk).map(([item, qty]) => ({ item, qty }))
    const rec = { id: uid(), patientId: a.patientId, appointmentId: a.id, doctorId: a.doctorId, date: a.date, time: a.start, typeIds: a.typeIds.slice(), teeth: parsed.teeth, surfaces: parsed.surfaces, text, materials: mats, fee: feeFor(db, a.typeIds, parsed.teeth, parsed.surfaces) }
    db.records.push(rec)
    mats.forEach(m => {
      usedTotals[m.item] = (usedTotals[m.item] || 0) + m.qty
      db.movements.push({ id: uid(), item: m.item, date: a.date, qty: -m.qty, kind: 'use', recordId: rec.id, patientId: a.patientId, note: typeNames(db, a.typeIds) })
    })
  })
  // Kovács Lili korábbi tejfogas kezelése
  {
    const text = 'Jobb alsó négyes tejfog, rágófelszíni tömés kompozittal. Felületi érzéstelenítés. Szépen együttműködött.'
    const parsed = analyze(text, db)
    db.records.push({ id: uid(), patientId: pt(8).id, appointmentId: null, doctorId: 'olah', date: addDays(t0, -100), time: '11:00', typeIds: ['tomes'], teeth: parsed.teeth, surfaces: parsed.surfaces, text, materials: [{ item: 'komp', qty: 1 }, { item: 'bond', qty: 1 }, { item: 'topik', qty: 1 }], fee: feeFor(db, ['tomes'], parsed.teeth, parsed.surfaces) })
  }
  // nyitókészlet, hogy a mozgásnapló a jelenlegi készletre jöjjön ki
  db.items.forEach(it => {
    db.movements.push({ id: uid(), item: it.id, date: addDays(t0, -30), qty: it.stock + (usedTotals[it.id] || 0), kind: 'in', note: 'Nyitókészlet' })
  })
  // a polírpaszta előrejelzése legyen piros (bemutatóhoz)
  for (let guard = 0; guard < 30; guard++) {
    const f = forecastItem(db, db.items.find(i => i.id === 'polir')!)
    if (f.level === 'red') break
    const cand = db.appointments.filter(a => a.date >= t0 && a.typeIds[0] !== 'fogko' && a.typeIds[0] !== 'tomes').sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))[0]
    if (!cand) break
    const p = db.patients.find(x => x.id === cand.patientId)
    cand.typeIds = ['fogko']; cand.dur = 60; cand.buffer = bufferFor(db, ['fogko'], p); cand.planned = null
    if (toMin(cand.start) + 60 + cand.buffer > end) cand.start = fromMin(end - 60 - cand.buffer)
  }
  // megjelenési előzmények (a meg nem jelenési kockázat becsléséhez)
  const ev = (pi: number, daysAgo: number, kind: Appointment['status'] | 'attended' | 'latecancel' | 'late', min = 0) =>
    db.events.push({ id: uid(), patientId: pt(pi).id, date: addDays(t0, -daysAgo), kind: kind as never, min })
  ;[5, 3, 6, 2, 4, 3, 8, 4].forEach((n, pi) => { for (let j = 0; j < n; j++) ev(pi, 40 + j * 70 + pi * 3, 'attended') })
  ev(2, 95, 'noshow'); ev(2, 210, 'noshow'); ev(2, 150, 'latecancel') // Szabó Eszter
  ev(5, 120, 'noshow'); ev(5, 60, 'late', 20); ev(5, 180, 'late', 25) // Varga Bence – kétszer késett
  ev(3, 75, 'late', 15) // Tóth Gábor
  ev(7, 130, 'latecancel') // Molnár Dávid
  ev(8, 100, 'attended'); ev(9, 150, 'attended'); ev(9, 400, 'attended')
  // emlékeztetők: a legtöbben SMS-t kérnek, minden második e-mailt is; Kovács Mária nem kér
  db.patients.forEach((p, i) => { p.remind = i === 6 ? { sms: false, email: false } : { sms: true, email: i % 2 === 0 || i === 8 } })
  db.appointments.forEach(a => {
    const p = db.patients.find(x => x.id === a.patientId)!
    a.remind = { sms: p.remind.sms, email: p.remind.email, timing: '24' }
    a.created = a.date < t0 ? addDays(a.date, -14) : addDays(t0, -3)
  })
  const ff = db.appointments.find(a => a.date > t0 && a.patientId === pt(0).id); if (ff) ff.confirmed = true
  return db
}
