// A specifikáció v2.4 tiszta függvényeinek tesztjei (5., 7., 8., 9., 10., 12., 15., 17., 19., 20., 21. pont)
import { describe, expect, it } from 'vitest'
// @ts-expect-error – a Node típusdefiníciói nincsenek telepítve (a tesztek Node-ban futnak)
import { readFileSync } from 'node:fs'
// @ts-expect-error – lásd fent
import { join } from 'node:path'
import { canonTokens, overlapRatio, rating, reliableSuggestion, uncertainWords, uncertaintyStats, veryDifferent, whisperVerdict, wordAccuracy, wordNumber } from '../app/utils/dict/quality'
import { prepareAudio, resampleFiltered, resampleLinear, toWav } from '../app/utils/dict/audio'
import { buildPrompt } from '../app/utils/dict/prompt'
import { findMacros, nameConflict, shouldRecommend, comboSig, type Macro } from '../app/utils/dict/macro'
import { correctionPairs, looksPersonal } from '../app/utils/dict/learn'
import { defaultItems, defaultTypes } from '../app/utils/defaults'
import { addDays, dow, today } from '../app/utils/dates'
import { conflictGroups, conflictUrgency, laneLayout } from '../app/utils/conflicts'
import { affectedBy, defaultDoctorTpl, isWorking, nextWorkingStart, offSchedule, periodsOn, receptionGaps, weekText } from '../app/utils/schedule'
import { approveAndSend, archiveExpired, ensureV24, infoState, mergePlan, planMarks, previousNextSteps, queueInfo, restoreInfo, todoAlerts } from '../app/utils/v24'
import { buildTasks } from '../app/utils/v22'
import { seed } from '../app/utils/seed'
import { isNewVisit, shortUA } from '../app/utils/visit'
import { branchOf, isBot, isTestHost, wavInfo } from '../worker/index'
import type { Appointment, DB } from '../app/utils/types'

const types = defaultTypes(), items = defaultItems()
const nextDow = (want: number) => { let d = addDays(today(), 1); while (dow(d) !== want) d = addDays(d, 1); return d }
const fresh = (): DB => { const db = ensureV24(seed()); db.appointments = []; return db }
const appt = (o: Partial<Appointment> & { id: string; date: string; start: string }): Appointment => ({ patientId: 'p1', doctorId: 'csempesz', roomId: 'room-1', dur: 60, buffer: 0, typeIds: ['tomes'], note: '', remind: { sms: true, email: false }, created: today(), ...o })

describe('v2.4 5. pont: a Whisper szövegének használhatósága (B-009)', () => {
  it('a számneveket számmá alakítja', () => {
    expect(wordNumber('harminchat')).toBe(36)
    expect(wordNumber('harminchatos')).toBe(36)
    expect(wordNumber('hatos')).toBe(6)
    expect(wordNumber('tizenhat')).toBe(16)
    expect(canonTokens('Fog 36-os, jobb fent hatos')).toEqual(['fog', '36', 'jobb', 'fent', '6'])
  })
  it('a felhasználói teszt értelmetlen Whisper-szövege a böngészőhöz képest használhatatlan → váltás', () => {
    const v = whisperVerdict('Fókármintzhat, fókármintzhatós, fókármintzhatós, fókármintzhat, Jókfenthatós', 'Fok 36 fok, 36-os fok, 36 jobb fent 6-os', 6)
    expect(v.usable).toBe(false)
    expect(v.ratio).toBeLessThan(0.3)
  })
  it('a jó Whisper-szöveg használható, és a számnév = számjegy', () => {
    const v = whisperVerdict('Fog harminchat. Fog 36-os. Jobb fent hatos.', 'fog 36 fog 36-os jobb fent 6-os', 6)
    expect(v.usable).toBe(true)
    expect(overlapRatio('Fog harminchat. Fog 36-os.', 'fog 36 fog 36-os')).toBeGreaterThanOrEqual(0.75)
  })
  it('böngésző szöveg nélkül az összevetés nem lehetséges, a kitaláció-szűrő marad', () => {
    expect(whisperVerdict('Köszönöm a figyelmet.', '').usable).toBe(false)
    expect(whisperVerdict('36-os fog tömés', '').usable).toBe(true)
  })
  it('szó-szintű egyezés a tesztfelvétel várt szövegével (küszöb 80%)', () => {
    expect(wordAccuracy('Fog harminchat. Fog 36-os. Jobb fent hatos.', 'fog 36, fog 36-os, jobb fent 6-os').ratio).toBe(1)
    expect(wordAccuracy('Fog harminchat. Fog 36-os. Jobb fent hatos.', 'Fókármintzhat, fókármintzhatós').ratio).toBeLessThan(0.8)
  })
})

describe('v2.4 5. és 12. pont: hang, WAV és tesztfelvételek', () => {
  // @ts-expect-error – __dirname a Node-ban
  const fx = join(__dirname, 'fixtures/hang')
  it('a repóban tárolt tesztfelvételek 16 kHz-es, mono, 16 bites WAV-ok, a fejléc egyezik a tényleges adattal', () => {
    const spec = JSON.parse(readFileSync(join(fx, 'varhato.json'), 'utf8')) as { felvetelek: { fajl: string; szoveg: string }[] }
    expect(spec.felvetelek).toHaveLength(2)
    for (const f of spec.felvetelek) {
      const w = wavInfo(new Uint8Array(readFileSync(join(fx, f.fajl))))
      expect(w.ok).toBe(true); expect(w.rate).toBe(16000); expect(w.channels).toBe(1); expect(w.bits).toBe(16); expect(w.headerMatches).toBe(true)
      expect(w.seconds).toBeGreaterThan(3); expect(w.seconds).toBeLessThan(30)
    }
  })
  it('a program által készített WAV fejléce egyezik a tényleges adattal', () => {
    const rate = 48000, s = new Float32Array(rate).map((_, i) => 0.3 * Math.sin(2 * Math.PI * 440 * i / rate))
    const { pcm, stats } = prepareAudio(s, rate)
    const w = wavInfo(toWav(pcm))
    expect(w.rate).toBe(16000); expect(w.channels).toBe(1); expect(w.headerMatches).toBe(true)
    expect(Math.abs(w.seconds - stats.seconds)).toBeLessThan(0.01)
  })
  it('a szűrt átalakítás elnyomja a 8 kHz fölötti összetevőt (nincs aliasing), a lineáris nem', () => {
    const rate = 48000, n = rate / 2, s = new Float32Array(n).map((_, i) => Math.sin(2 * Math.PI * 12000 * i / rate))
    const rms = (x: Float32Array) => Math.sqrt(x.reduce((a, v) => a + v * v, 0) / x.length)
    const lin = rms(resampleLinear(s, rate)), filt = rms(resampleFiltered(s, rate))
    expect(filt).toBeLessThan(0.1)
    expect(lin).toBeGreaterThan(filt * 3)
  })
  it('a beszédsávot (1 kHz) a szűrt átalakítás megtartja', () => {
    const rate = 48000, n = rate / 2, s = new Float32Array(n).map((_, i) => Math.sin(2 * Math.PI * 1000 * i / rate))
    const o = resampleFiltered(s, rate), r = Math.sqrt(o.reduce((a, v) => a + v * v, 0) / o.length)
    expect(r).toBeGreaterThan(0.6)
  })
  it('a szakszó-szöveg alapból rövid mondatos (nem vesszős lista), és kikapcsolható', () => {
    const m = buildPrompt({ plannedTypes: ['tomes'], types, items, learned: [] })
    const list = buildPrompt({ plannedTypes: ['tomes'], types, items, learned: [], style: 'lista' })
    expect(m.split('. ').length).toBeGreaterThanOrEqual(4); expect(m.split(',').length).toBeLessThanOrEqual(4); expect(list.split(',').length).toBeGreaterThan(10); expect(m.length).toBeLessThanOrEqual(420)
    expect(buildPrompt({ plannedTypes: [], types, items, learned: [], style: 'nincs' })).toBe('')
    expect(buildPrompt({ plannedTypes: [], types, items, learned: [], style: 'lista' })).toContain('Előforduló kifejezések')
  })
})

describe('v2.4 3., 17., 19. pont: betanítás és bizonytalan szavak', () => {
  it('szavas minősítés: jó ≥ 90, közepes 75–89, gyenge < 75', () => {
    expect(rating(95)).toBe('jó'); expect(rating(80)).toBe('közepes'); expect(rating(40)).toBe('gyenge')
  })
  it('nagyon eltérő szóból (negyvenhét ↔ hat) nincs szabályjavaslat, hangzásra hasonlóból igen; ismétlődésnél igen', () => {
    expect(veryDifferent('negyvenhet', 'hat')).toBe(true)
    expect(reliableSuggestion('negyvenhet', 'hat', 1)).toBe(false)
    expect(reliableSuggestion('negyvenhet', 'hat', 2)).toBe(true)
    expect(reliableSuggestion('polirpaszta', 'polirpasta', 1)).toBe(true)
  })
  it('a két felismerő eltérő szavai bizonytalannak jelölődnek, és mérhetők', () => {
    const unc = uncertainWords('fog harminchat extrakció', 'fog 36 extrakció')
    expect(unc).toEqual([])
    const u2 = uncertainWords('fok harminchat polírpaszta', 'fog 36 polírpaszta')
    expect(u2).toContain('fok')
    const st = uncertaintyStats('fog 36 polírpaszta', 'fok harminchat polírpaszta', u2)
    expect(st.precision).toBe(1); expect(st.coverage).toBe(1)
  })
})

describe('v2.4 6. pont: öntanulás', () => {
  it('a javított szöveg szavankénti cseréi', () => {
    expect(correctionPairs('fókármintzhat extrakció', 'fog harminchat extrakció')).toEqual([['fókármintzhat', 'fog harminchat']])
  })
  it('személynévnek / azonosítónak látszó szó nem mentődik', () => {
    expect(looksPersonal('Kiss Anna')).toBe(true); expect(looksPersonal('123 456 789')).toBe(true); expect(looksPersonal('polírpaszta')).toBe(false)
  })
})

describe('v2.4 15. pont: rövidítések', () => {
  const m: Macro = { id: 'm1', name: 'szokásos kontroll', aliases: ['sima kontroll'], lines: [{ kind: 'type', id: 'kontroll' }, { kind: 'type', id: 'fogko' }, { kind: 'type', id: 'tomes' }, { kind: 'mat', id: 'polir', qty: 2 }, { kind: 'mat', id: 'tamp', qty: 3 }], active: true, uses: 0, lastUsed: '', created: '' }
  const ctx = { types, items }
  it('a név felismerése, a fogszám és az elhagyás ugyanabban a mondatban; a parsernek a név és a „nélkül” kimarad', () => {
    const r = findMacros('szokasos kontroll a 36-osra, plusz ket tampon, de fogko nelkul. utana polirozas', [m], ctx)
    expect(r.hits).toHaveLength(1)
    const h = r.hits[0]!
    expect(h.teeth).toEqual([36])
    expect(h.lines.find(l => l.id === 'fogko')!.omitted).toBe(true)
    expect(h.needsTooth).toBe(false)
    expect(r.text).not.toContain('szokasos'); expect(r.text).not.toContain('nelkul'); expect(r.text).toContain('plusz ket tampon'); expect(r.text).toContain('utana polirozas')
  })
  it('hiányzó fogszámnál egyetlen kérdés kell; a másik elhangzó alak is működik', () => {
    const r = findMacros('sima kontroll.', [m], ctx)
    expect(r.hits[0]!.needsTooth).toBe(true)
  })
  it('a név nem lehet azonos katalógus-tétel, anyag vagy másik rövidítés nevével', () => {
    expect(nameConflict('polírpaszta', ctx, [])).toBeTruthy()
    expect(nameConflict('sima kontroll', ctx, [m])).toBeTruthy()
    expect(nameConflict('reggeli csomag', ctx, [m])).toBeNull()
  })
  it('ajánlás: ugyanaz a kombináció legalább 3-szor 30 napon belül', () => {
    const sig = comboSig(['kontroll', 'fogko'], ['polir'])
    const now = Date.now(), at = (d: number) => new Date(now - d * 86400000).toISOString()
    expect(shouldRecommend([{ sig, at: at(1) }, { sig, at: at(2) }], sig, [], [])).toBe(false)
    expect(shouldRecommend([{ sig, at: at(1) }, { sig, at: at(2) }, { sig, at: at(3) }], sig, [], [])).toBe(true)
    expect(shouldRecommend([{ sig, at: at(1) }, { sig, at: at(2) }, { sig, at: at(40) }], sig, [], [])).toBe(false)
    expect(shouldRecommend([{ sig, at: at(1) }, { sig, at: at(2) }, { sig, at: at(3) }], sig, [], [sig])).toBe(false)
  })
})

describe('v2.4 21. pont: beosztás', () => {
  it('alapbeállítás: kedd–péntek 10:00–20:00, hétfőn nincs rendelés', () => {
    const db = fresh()
    expect(weekText(defaultDoctorTpl())).toBe('kedd–péntek 10:00–20:00')
    expect(isWorking(db, 'csempesz', nextDow(2), '10:00', 60)).toBe(true)
    expect(isWorking(db, 'csempesz', nextDow(1), '10:00', 60)).toBe(false)
    expect(isWorking(db, 'csempesz', nextDow(2), '19:30', 60)).toBe(false)
  })
  it('napi eltérés: az adott napra a sablon helyett érvényes; a legközelebbi rendelési idő', () => {
    const db = fresh(), thu = nextDow(4)
    db.schedule!.overrides.push({ kind: 'doctor', personId: 'csempesz', date: thu, periods: [], at: '' })
    expect(periodsOn(db, 'doctor', 'csempesz', thu)).toEqual([])
    expect(nextWorkingStart(db, 'csempesz', thu, 60)![0]).not.toBe(thu)
  })
  it('a módosítás a meglévő időpontot nem törli, de „beosztáson kívül” teendő keletkezik, és előre jelzi, hányat érint', () => {
    const db = fresh(), wed = nextDow(3)
    db.appointments.push(appt({ id: 'a1', date: wed, start: '11:00' }))
    const hit = affectedBy(db, s => { s.doctor.csempesz = { ...defaultDoctorTpl(), 3: [] } }, () => false)
    expect(hit.map(a => a.id)).toEqual(['a1'])
    db.schedule!.doctor.csempesz = { ...defaultDoctorTpl(), 3: [] }
    expect(db.appointments).toHaveLength(1)
    expect(offSchedule(db, () => false).map(a => a.id)).toEqual(['a1'])
    expect(buildTasks(db).some(t => t.kind === 'offsched' && t.ref === 'a1')).toBe(true)
  })
  it('a recepció lefedettsége: ha nincs recepciós, hiány látszik', () => {
    const db = fresh(), tue = nextDow(2)
    expect(receptionGaps(db, tue)).toEqual([])
    db.schedule!.overrides.push({ kind: 'reception', personId: db.staff!.receptionists[0]!.id, date: tue, periods: [['10:00', '15:00']], at: '' })
    expect(receptionGaps(db, tue)).toEqual([['15:00', '20:00']])
  })
})

describe('v2.4 7. pont: időpont-ütközés (B-010)', () => {
  it('az átfedő időpontok külön sávba kerülnek (egyik sem takarja el a másikat)', () => {
    const d = nextDow(4)
    const l = laneLayout([appt({ id: 'a', date: d, start: '17:30', dur: 90 }), appt({ id: 'b', date: d, start: '18:30', dur: 60 }), appt({ id: 'c', date: d, start: '12:00' })])
    expect(l.get('a')).toEqual({ lane: 0, n: 2 }); expect(l.get('b')).toEqual({ lane: 1, n: 2 }); expect(l.get('c')).toEqual({ lane: 0, n: 1 })
  })
  it('ütköző csoport → teendő; a csak ráhagyás-ütközés enyhébb; a szándékos átfedés lezárja', () => {
    const db = fresh(), d = nextDow(4)
    db.appointments.push(appt({ id: 'a', date: d, start: '17:30', dur: 90 }), appt({ id: 'b', date: d, start: '18:30', dur: 60, patientId: 'p2' }))
    let g = conflictGroups(db)
    expect(g).toHaveLength(1); expect(g[0]!.hard).toBe(true)
    expect(buildTasks(db).filter(t => t.kind === 'conflict')).toHaveLength(1)
    db.appointments[1]!.start = '19:00'; db.appointments[0]!.buffer = 30
    g = conflictGroups(db); expect(g[0]!.hard).toBe(false)
    expect(conflictUrgency({ date: today(), hard: false })).toBe('recommended')
    db.appointments[0]!.overlapOk = [{ id: 'b', at: '', by: 'teszt' }]
    expect(conflictGroups(db)[0]!.ok).toBe(true)
    expect(buildTasks(db).filter(t => t.kind === 'conflict')).toHaveLength(0)
    expect(todoAlerts(db).total).toBe(0)
  })
})

describe('v2.4 9. pont: összevonás egy időponttá (B-011)', () => {
  it('a kezelések megmaradnak, az időtartam összeadódik, a ráhagyás a nagyobbik', () => {
    const db = fresh(), d = nextDow(3)
    const a = appt({ id: 'a', date: d, start: '10:00', dur: 60, buffer: 30, typeIds: ['tomes'], items: [{ tooth: 36, typeId: 'tomes', surfaces: ['M'] }] })
    const p = mergePlan(db, a, { items: [{ tooth: 46, typeId: 'gyoker', surfaces: [] }], typeIds: ['gyoker'], buffer: 30 }, 'csempesz')
    expect(p.items).toHaveLength(2); expect(p.dur).toBe(150); expect(p.buffer).toBe(30)
    expect(p.items.map(i => i.typeId)).toEqual(['tomes', 'gyoker'])
  })
})

describe('v2.4 8. és 10. pont: Mai feladat, tájékoztató jóváhagyása', () => {
  it('az elvégzett tétel pipát kap, a hiányzó „még nincs rögzítve”, a jelölt „nem történt meg”', () => {
    const db = fresh()
    const m = planMarks(db, [{ tooth: 36, typeId: 'tomes' }, { tooth: null, typeId: 'kontroll' }, { tooth: 46, typeId: 'gyoker' }], [{ tooth: 36, typeId: 'tomes' }], { '46:gyoker': 'a páciens kérésére elhalasztva' })
    expect(m.map(x => x.state)).toEqual(['done', 'missing', 'notdone'])
  })
  it('az előző alkalom „következő lépése” a „Nem történt meg” megjegyzésből jön', () => {
    const db = seed(); const r = db.records.filter(x => x.patientId === db.patients[0]!.id).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))[0]!
    r.notDone = [{ tooth: 46, typeId: 'gyoker', note: 'folytatás jövő héten' }]
    expect(previousNextSteps(db, r.patientId)[0]).toContain('folytatás jövő héten')
  })
  it('jóváhagyási feladat csak e-mailes értesítést kérő páciensnél; 7 nap után archívum, visszahozás új határidővel', () => {
    const db = ensureV24(seed())
    const r = db.records[0]!; const p = db.patients.find(x => x.id === r.patientId)!
    r.patientInfo = { text: 'Kedves …', status: 'draft' }
    p.remind = { sms: true, email: false }
    expect(queueInfo(db, r)).toBe(false); expect(infoState(r)).toBe('none')
    p.remind = { sms: true, email: true }
    r.date = addDays(today(), -10)
    expect(queueInfo(db, r)).toBe(true)
    expect(infoState(r)).toBe('expired')
    expect(archiveExpired(db)).toBeGreaterThanOrEqual(1)
    expect(r.patientInfo.status).not.toBe('sent')
    expect(approveAndSend(db, r.id, 'Dr. Teszt')).toBe(false)
    expect(restoreInfo(db, r.id, 'Dr. Teszt')).toBe(true)
    expect(infoState(r)).toBe('pending'); expect(r.patientInfo.deadline).toBe(addDays(today(), 7))
    expect(approveAndSend(db, r.id, 'Dr. Teszt')).toBe(true)
    expect(infoState(r)).toBe('sent'); expect(r.patientInfo.log!.length).toBeGreaterThanOrEqual(3)
  })
})

describe('v2.4 20. pont: látogatás-napló', () => {
  it('a teszt gazdagép felismerése (az olvasó végpont a main gazdagépen nem létezik)', () => {
    expect(isTestHost('teszt-molio.olahmiklos.workers.dev')).toBe(true)
    expect(isTestHost('molio.olahmiklos.workers.dev')).toBe(false)
    expect(isTestHost('localhost:3000')).toBe(true)
    expect(branchOf('molio.olahmiklos.workers.dev')).toBe('main')
  })
  it('robotok és link-előnézetek nem írnak; böngésző-leírás; 30 perces látogatás-szabály', () => {
    expect(isBot('facebookexternalhit/1.1')).toBe(true); expect(isBot('WhatsApp/2.23')).toBe(true)
    expect(isBot('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1')).toBe(false)
    expect(shortUA('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1')).toBe('Safari · iPhone')
    const now = Date.now()
    expect(isNewVisit(null, now)).toBe(true)
    expect(isNewVisit(new Date(now - 10 * 60000).toISOString(), now)).toBe(false)
    expect(isNewVisit(new Date(now - 31 * 60000).toISOString(), now)).toBe(true)
  })
})
