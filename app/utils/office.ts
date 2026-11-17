// Rendelői adminisztráció (spec v2.0): kontroll-meghívók (recall), közérthető páciens-tájékoztató,
// beleegyező nyilatkozat sablonjai, EESZT-jelentés (szemléltetés), számla előkészítése, sterilizálás.
import { addDays, addMonths, dayDiff, fmtDate, fmtLong, today } from './dates'
import type { DB, Patient, TreatmentRecord } from './types'
import { doctorName, typeById } from './logic'
import { isPrimary, quadrant } from './teeth'

/* ---------- közérthető fogmegnevezés ---------- */
const NUM = ['', 'egyes', 'kettes', 'hármas', 'négyes', 'ötös', 'hatos', 'hetes', 'nyolcas']
const SIDE: Record<number, string> = { 1: 'jobb felső', 2: 'bal felső', 3: 'bal alsó', 4: 'jobb alsó', 5: 'jobb felső', 6: 'bal felső', 7: 'bal alsó', 8: 'jobb alsó' }
export const layTooth = (n: number) => `${SIDE[quadrant(n)] || ''} ${NUM[n % 10] || ''} ${isPrimary(n) ? 'tejfog' : 'fog'} (${n})`.trim()
export const layTeeth = (teeth: number[]) => teeth.length ? teeth.map(layTooth).join(', ') : ''

/* ---------- kontroll-meghívó (recall) ---------- */
export interface RecallRow {
  patient: Patient
  typeId: string
  typeName: string
  last: string
  due: string
  days: number
  state: 'overdue' | 'due' | 'soon'
  invitedAt: string | null
  booked: string | null
}
/**
 * Minden páciensre és minden kontrollos kezeléstípusra (recallMonths): a legutóbbi ilyen kezelés + intervallum = esedékesség.
 * Ha a páciensnek van jövőbeli időpontja ugyanerre a típusra, az „foglalva”.
 */
export function recallRows(db: DB, aheadDays = 45): RecallRow[] {
  const t0 = today(), out: RecallRow[] = []
  db.types.filter(t => (t.recallMonths || 0) > 0).forEach(t => {
    db.patients.forEach(p => {
      const last = db.records.filter(r => r.patientId === p.id && r.typeIds.includes(t.id)).map(r => r.date).sort().pop()
      if (!last) return
      const due = addMonths(last, t.recallMonths!)
      const days = dayDiff(t0, due)
      if (days > aheadDays) return
      const fut = db.appointments.filter(a => a.patientId === p.id && a.date >= t0 && a.typeIds.includes(t.id) && a.status !== 'noshow').map(a => a.date).sort()[0] || null
      const inv = db.recallInvites.filter(i => i.patientId === p.id && i.typeId === t.id && i.date >= last).map(i => i.date).sort().pop() || null
      out.push({ patient: p, typeId: t.id, typeName: t.name, last, due, days, state: days < -14 ? 'overdue' : days <= 0 ? 'due' : 'soon', invitedAt: inv, booked: fut })
    })
  })
  return out.sort((a, b) => a.due.localeCompare(b.due))
}
export const nextRecall = (db: DB, pid: string) => {
  const list: { typeName: string; due: string }[] = []
  db.types.filter(t => (t.recallMonths || 0) > 0).forEach(t => {
    const last = db.records.filter(r => r.patientId === pid && r.typeIds.includes(t.id)).map(r => r.date).sort().pop()
    if (last) list.push({ typeName: t.name, due: addMonths(last, t.recallMonths!) })
  })
  return list.sort((a, b) => a.due.localeCompare(b.due))[0] || null
}
export const RECALL_SMS = 'Kedves {név}! Legutóbbi kezelése óta eltelt az ajánlott idő, esedékes: {kezelés}. Foglaljon időpontot a {telefon} számon vagy válaszoljon erre az üzenetre. {klinika}'
export const recallText = (db: DB, r: Pick<RecallRow, 'patient' | 'typeName'>) =>
  RECALL_SMS.replace('{név}', r.patient.name).replace('{kezelés}', r.typeName.toLowerCase()).replace('{telefon}', db.settings.phone).replace('{klinika}', db.settings.clinic)

/* ---------- közérthető páciens-tájékoztató ---------- */
export const LAY: Record<string, { name: string; what: string; care: string[] }> = {
  kontroll: { name: 'Állapotfelmérés', what: 'átvizsgáltuk a fogakat és az ínyt.', care: ['Napi kétszeri fogmosás és esti fogselyem- vagy fogköztisztító-kefe-használat javasolt.'] },
  tomes: { name: 'Fogszínű tömés', what: 'a szuvas részt eltávolítottuk, és fogszínű (kompozit) tömést készítettünk.', care: ['Az érzéstelenítés 2–3 óra alatt múlik el; addig ne egyen, és vigyázzon, hogy ne harapja meg az arcát vagy a nyelvét.', 'A tömés azonnal terhelhető. Ha harapáskor magasnak érzi, jelezze, és igazítunk rajta.'] },
  fogko: { name: 'Fogkő-eltávolítás', what: 'eltávolítottuk a fogkövet, és políroztuk a fogfelszíneket.', care: ['Az íny 1–2 napig érzékeny lehet, enyhe vérzés előfordulhat – ez normális.'] },
  huzas: { name: 'Foghúzás', what: 'a fogat eltávolítottuk.', care: ['A sebre tett gézt 30 percig tartsa harapva.', 'Aznap ne öblögessen erősen, ne dohányozzon, ne igyon forró italt, és ne sportoljon.', 'Ha a vérzés nem áll el, vagy erős fájdalom, duzzanat jelentkezik, hívja a rendelőt.'] },
  korona: { name: 'Előkészítés koronához', what: 'a fogat előkészítettük a koronához, lenyomatot vettünk, és ideiglenes koronát kapott.', care: ['Az ideiglenes koronával ne rágjon ragacsos, kemény ételt.', 'Ha az ideiglenes korona leesik, tegye el, és hívja a rendelőt.'] },
  gyoker: { name: 'Gyökérkezelés', what: 'kitisztítottuk és lezártuk a fog gyökércsatornáit.', care: ['Néhány napig enyhe nyomásérzékenység normális; szükség esetén szokásos fájdalomcsillapító szedhető.', 'A végleges ellátásig ne harapjon erősen a fogra.'] },
  implant: { name: 'Implantátum beültetése', what: 'implantátumot (műgyökeret) ültettünk be.', care: ['Az első napokban hidegen borogassa az arcát, és langyos, puha ételt egyen.', 'Ne dohányozzon, és ne öblögessen erősen.', 'A varratszedés kb. 7–10 nap múlva lesz.'] },
}

export function patientInfoDraft(db: DB, rec: Pick<TreatmentRecord, 'patientId' | 'doctorId' | 'date' | 'typeIds' | 'teeth'>) {
  const p = db.patients.find(x => x.id === rec.patientId)
  const lines: string[] = [`Kedves ${p?.name || 'Páciensünk'}!`, '', `Összefoglaló a ${fmtLong(rec.date)} kezeléséről:`]
  const care: string[] = []
  rec.typeIds.forEach(id => {
    const l = LAY[id], t = typeById(db, id)
    const teeth = layTeeth(rec.teeth)
    if (l) { lines.push(`• ${l.name}${teeth && id !== 'fogko' && id !== 'kontroll' ? ' – ' + teeth : ''}: ${l.what}`); l.care.forEach(c => { if (!care.includes(c)) care.push(c) }) }
    else if (t) lines.push(`• ${t.name}${teeth ? ' – ' + teeth : ''}.`)
  })
  if (care.length) { lines.push('', 'Otthoni teendők:'); care.forEach(c => lines.push('• ' + c)) }
  const next = db.appointments.filter(a => a.patientId === rec.patientId && a.date > rec.date && a.status !== 'noshow').sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))[0]
  if (next) lines.push('', `Következő időpontja: ${fmtDate(next.date)} ${next.start}.`)
  else {
    const rc = nextRecall(db, rec.patientId)
    if (rc) lines.push('', `Javasolt következő ellenőrzés: ${fmtDate(rc.due)} körül (${rc.typeName.toLowerCase()}).`)
  }
  lines.push('', `Ha kérdése van, hívjon minket: ${db.settings.phone}.`, '', 'Üdvözlettel:', doctorName(db, rec.doctorId), db.settings.clinic)
  return lines.join('\n')
}

/* ---------- beleegyező nyilatkozat ---------- */
export const CONSENT_TPL: Record<string, { title: string; body: string }> = {
  altalanos: { title: 'Beleegyező nyilatkozat fogászati kezeléshez', body: 'A tervezett kezelés: {kezelés} ({fogak}).\n\nA kezelőorvos szóban tájékoztatott a kezelés menetéről, várható előnyeiről, lehetséges kockázatairól (pl. érzékenység, fájdalom, gyulladás, az érzéstelenítés mellékhatásai) és az alternatív kezelési lehetőségekről, valamint arról, mi történhet, ha a kezelést nem végezzük el.\n\nKérdéseimet feltehettem, azokra érthető választ kaptam. Az egészségi állapotomra vonatkozó adatokat a legjobb tudásom szerint adtam meg.' },
  tomes: { title: 'Beleegyező nyilatkozat – tömés', body: 'A tervezett kezelés: {kezelés} ({fogak}).\n\nTudomásul veszem, hogy a szuvas fogrész eltávolítása után a fog átmenetileg érzékeny lehet hidegre, melegre és rágásra. Mély szuvasodásnál előfordulhat, hogy a fogbél begyullad, és később gyökérkezelés válik szükségessé. A tömés színe kis mértékben eltérhet a fog színétől.\n\nA kezelőorvos tájékoztatott az alternatívákról (pl. betét, korona) és arról, mi történhet, ha a kezelést nem végezzük el. Kérdéseimre érthető választ kaptam.' },
  gyoker: { title: 'Beleegyező nyilatkozat – gyökérkezelés', body: 'A tervezett kezelés: {kezelés} ({fogak}).\n\nTudomásul veszem, hogy a gyökérkezelés több alkalmat igényelhet, a kezelés után napokig nyomásérzékenység léphet fel, és ritkán műszertörés, a gyökér átfúródása vagy a gyulladás fennmaradása előfordulhat, amely ismételt kezelést, gyökércsúcs-rezekciót vagy a fog eltávolítását teheti szükségessé. A gyökérkezelt fog törékenyebb, ezért korona javasolt.\n\nA kezelőorvos tájékoztatott az alternatívákról (pl. foghúzás) és arról, mi történhet, ha a kezelést nem végezzük el. Kérdéseimre érthető választ kaptam.' },
  huzas: { title: 'Beleegyező nyilatkozat – foghúzás', body: 'A tervezett kezelés: {kezelés} ({fogak}).\n\nTudomásul veszem, hogy a beavatkozás után fájdalom, duzzanat, vérzés, ritkán száraz alveolus (fájdalmas sebgyógyulás), szomszédos fog sérülése, alsó bölcsességfognál átmeneti vagy tartós zsibbadás, felső fogaknál az arcüreg megnyílása fordulhat elő.\n\nA kezelőorvos tájékoztatott a teendőkről és a fog pótlásának lehetőségeiről. Kérdéseimre érthető választ kaptam.' },
  korona: { title: 'Beleegyező nyilatkozat – korona', body: 'A tervezett kezelés: {kezelés} ({fogak}).\n\nTudomásul veszem, hogy a fog csiszolása visszafordíthatatlan, a csiszolt fog érzékeny lehet, és ritkán a fogbél gyulladása miatt gyökérkezelés válhat szükségessé. Az ideiglenes korona leeshet.\n\nA kezelőorvos tájékoztatott az alternatívákról és a várható költségekről. Kérdéseimre érthető választ kaptam.' },
  implant: { title: 'Beleegyező nyilatkozat – implantátum beültetése', body: 'A tervezett kezelés: {kezelés} ({fogak}).\n\nTudomásul veszem, hogy a beavatkozás sebészi műtét, utána duzzanat, fájdalom, bevérzés jelentkezhet. Ritkán az implantátum nem csontosodik be, és el kell távolítani; alsó állcsontban az ideg sérülése miatt zsibbadás, felső állcsontban az arcüreg érintettsége előfordulhat. A dohányzás és egyes betegségek rontják a gyógyulás esélyét.\n\nA beültetett implantátum gyártási száma (LOT) a kartonomba kerül. A kezelőorvos tájékoztatott az alternatívákról (pl. híd, kivehető fogpótlás) és a várható költségekről. Kérdéseimre érthető választ kaptam.' },
}
export function consentFor(db: DB, typeIds: string[], teeth: number[]) {
  const key = typeIds.map(id => typeById(db, id)?.consent).find(Boolean) || 'altalanos'
  const tpl = CONSENT_TPL[key] || CONSENT_TPL.altalanos!
  const names = typeIds.map(id => typeById(db, id)?.name).filter(Boolean).join(', ') || 'fogászati kezelés'
  const body = tpl.body.replace('{kezelés}', names).replace('{fogak}', teeth.length ? layTeeth(teeth) : 'a teljes fogazat')
  return { key, title: tpl.title, text: body + '\n\nA fentiek ismeretében a kezeléshez hozzájárulok.' }
}

/* ---------- EESZT (szemléltetés) ---------- */
export function eesztPayload(db: DB, r: TreatmentRecord) {
  const p = db.patients.find(x => x.id === r.patientId)
  return [
    ['Ellátás típusa', 'Járóbeteg-ellátás – fogászat'],
    ['Ellátás ideje', `${fmtDate(r.date)} ${r.time}`],
    ['Egészségügyi szolgáltató', `${db.company.name} – ${db.sites[0]?.name || ''}`],
    ['Ellátó orvos', `${doctorName(db, r.doctorId)} (pecsétszám: a végleges rendszerben)`],
    ['Páciens', `${p?.name || ''}, TAJ: ${p?.taj || '–'}`],
    ['Beavatkozások', r.typeIds.map(id => typeById(db, id)?.name).filter(Boolean).join(', ') || '–'],
    ['Érintett fogak', r.teeth.join(', ') || '–'],
    ['Dokumentum', 'Ambuláns lap (kezelési leírás)'],
  ] as [string, string][]
}
export const eesztRef = () => 'EESZT-DEMO-' + String(Math.floor(10000000 + Math.random() * 89999999))

/* ---------- számla előkészítése (szemléltetés) ---------- */
export const PAY_METHODS: Record<string, string> = { cash: 'Készpénz', card: 'Bankkártya', transfer: 'Átutalás', fund: 'Egészségpénztári kártya' }
export const FUNDS = ['OTP Egészségpénztár', 'Prémium Egészségpénztár', 'Vasutas Egészségpénztár', 'Patika Egészségpénztár', 'Generali Egészségpénztár', 'Egyéb egészségpénztár']
export function nextInvoiceNo(db: DB, date = today()) {
  const y = date.slice(0, 4)
  const n = db.invoices.filter(i => i.no.includes(`-${y}-`)).length + 1
  return `DEMO-${y}-${String(n).padStart(4, '0')}`
}

/* ---------- sterilizálás ---------- */
export const STER_DEVICES = ['Autokláv 1 (B osztályú)', 'Autokláv 2 (B osztályú)']
export const STER_PROGRAMS = ['134 °C · 5,5 perc (csomagolt)', '121 °C · 20 perc (kímélő)', 'Bowie–Dick-teszt', 'Vákuumteszt']
export const batchNo = (db: DB, date: string) => {
  const n = db.sterCycles.filter(c => c.date === date).length + 1
  return `S-${date.slice(2, 4)}${date.slice(5, 7)}${date.slice(8, 10)}-${n}`
}
/** a ciklus után 30 napig használható a csomag (a végleges rendszerben beállítható) */
export const STER_VALID_DAYS = 30
export const usableBatches = (db: DB) => {
  const t0 = today(), from = addDays(t0, -STER_VALID_DAYS)
  return db.sterCycles.filter(c => c.ok && c.date >= from && c.date <= t0 && !/teszt/i.test(c.program)).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))
}
export const bowieDickToday = (db: DB) => db.sterCycles.some(c => c.date === today() && c.bowieDick !== null)
