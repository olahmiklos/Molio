// Aktuális kezelés: diktálás értelmezése, fogak és felszínek, anyagjavaslat, díj, jóváhagyás,
// fogazati státusz felvétele, csatolmányok (2.2, 2.2.1, 2.2.5–2.2.7)
import { defineStore } from 'pinia'
import { useDataStore } from './data'
import { usePatientStore } from './patient'
import { fmtDate, fromMin, nowMin, today, uid } from '~/utils/dates'
import type { LotUse, Planned, Surface, SurfaceMap } from '~/utils/types'
import { analyze, analyzeStatus, type ParseResult, type StatusParse } from '~/utils/parser'
import { feeFor, pkgFor, recordForAppt, surfacesFor, typeNames } from '~/utils/logic'
import { SURFACE_ORDER, toothLabel } from '~/utils/teeth'
import { guessDocType } from '~/utils/defaults'
import { useRepository } from '~/repositories'
import { consumeStock, previewLots, returnStock } from '~/utils/stock'
import { patientInfoDraft, usableBatches } from '~/utils/office'

export type RowState = 'ok' | 'diff' | 'dict' | 'pkg' | 'manual'
export interface MatRow { id: string; pk: number; dq?: number; dRel?: number; st: RowState; auto: number; qty: number; manual: boolean; checked: boolean }

interface Session {
  key: string
  recordId: string | null
  patientId: string
  appointmentId: string | null
  doctorId: string
  date: string
  time: string
  text: string
  teeth: number[]
  types: string[]
  rmTeeth: number[]
  rmTypes: string[]
  manualSurf: SurfaceMap
  rmSurf: SurfaceMap
  overrides: Record<string, number>
  unchecked: string[]
  extra: string[]
  planned: Planned | null
  focusTooth: number | null
  mode: 'treat' | 'status'
  sterBatch: string | null
  statusText: string
  statusEdits: Record<string, string[]>
}

const EMPTY_PARSE: ParseResult = { teeth: [], surfaces: {}, orphanSurfaces: [], types: [], qty: {}, rel: {}, offDentition: [] }

export const useTreatmentStore = defineStore('treatment', () => {
  const data = useDataStore()
  const patients = usePatientStore()
  const db = computed(() => data.db)
  const s = ref<Session | null>(null)
  const parsed = ref<ParseResult>(EMPTY_PARSE)
  const statusParsed = ref<StatusParse>({ teeth: {}, unparsed: [], offDentition: [] })
  let timer: ReturnType<typeof setTimeout> | null = null
  let sTimer: ReturnType<typeof setTimeout> | null = null

  const patient = computed(() => (s.value ? patients.byId(s.value.patientId) : undefined))
  const dentition = computed(() => patient.value?.dentition || 'permanent')

  function base(o: Partial<Session> & { patientId: string; doctorId: string; date: string; time: string }): Session {
    return { key: 'k' + uid(), recordId: null, appointmentId: null, text: '', teeth: [], types: [], rmTeeth: [], rmTypes: [], manualSurf: {}, rmSurf: {}, overrides: {}, unchecked: [], extra: [], planned: null, focusTooth: null, mode: 'treat', sterBatch: usableBatches(db.value)[0]?.batch || null, statusText: '', statusEdits: {}, ...o }
  }
  const nowSlot = () => fromMin(Math.min(Math.max(Math.floor(nowMin() / 30) * 30, db.value.settings.startHour * 60), db.value.settings.endHour * 60 - 30))

  /** kezelés indítása az időpontból: a páciens, a kezeléstípus és a tervezett fog/felszín átkerül */
  function startFromAppointment(apptId: string) {
    const a = db.value.appointments.find(x => x.id === apptId); if (!a) return
    const planned = a.planned ? JSON.parse(JSON.stringify(a.planned)) as Planned : null
    s.value = base({ patientId: a.patientId, appointmentId: a.id, doctorId: a.doctorId, date: today(), time: a.date === today() ? a.start : nowSlot(), types: [...a.typeIds], planned, teeth: planned ? [...planned.teeth] : [], manualSurf: planned ? JSON.parse(JSON.stringify(planned.surfaces)) : {} })
    parsed.value = EMPTY_PARSE
  }
  function startNew(pid: string) {
    s.value = base({ patientId: pid, doctorId: db.value.doctors[0]!.id, date: today(), time: nowSlot() })
    parsed.value = EMPTY_PARSE
  }
  function editRecord(rid: string) {
    const r = db.value.records.find(x => x.id === rid); if (!r) return
    s.value = base({ recordId: r.id, sterBatch: r.sterBatch ?? null, patientId: r.patientId, appointmentId: r.appointmentId, doctorId: r.doctorId, date: r.date, time: r.time, teeth: [...r.teeth], types: [...r.typeIds], text: r.text, manualSurf: JSON.parse(JSON.stringify(r.surfaces || {})), planned: r.planned ? JSON.parse(JSON.stringify(r.planned)) : null })
    parsed.value = analyze(r.text, db.value, { dentition: dentition.value })
    const saved: Record<string, number> = {}; r.materials.forEach(m => { saved[m.item] = m.qty })
    rows.value.forEach(row => { if (!(row.id in saved)) s.value!.unchecked.push(row.id) })
    Object.entries(saved).forEach(([k, q]) => { s.value!.overrides[k] = q; if (!s.value!.extra.includes(k)) s.value!.extra.push(k) })
  }
  const active = computed(() => !!s.value)

  /* ---------- diktálás és értelmezés ---------- */
  function setText(v: string, delay = 250) {
    if (!s.value) return
    s.value.text = v
    if (timer) clearTimeout(timer)
    timer = setTimeout(applyParse, delay)
  }
  function applyParse() {
    if (!s.value) return
    parsed.value = analyze(s.value.text, db.value, { dentition: dentition.value })
    parsed.value.teeth.forEach(t => { if (!s.value!.rmTeeth.includes(t) && !s.value!.teeth.includes(t)) s.value!.teeth.push(t) })
    parsed.value.types.forEach(t => { if (!s.value!.rmTypes.includes(t) && !s.value!.types.includes(t)) s.value!.types.push(t) })
    if (parsed.value.teeth.length) s.value.focusTooth = parsed.value.teeth[parsed.value.teeth.length - 1]!
  }
  /** kézi felülbírálat: a levett fogat vagy kezelést újraértelmezéskor nem jelöli vissza */
  function toggleTooth(n: number) {
    const x = s.value; if (!x) return
    if (x.teeth.includes(n)) { x.teeth = x.teeth.filter(t => t !== n); if (!x.rmTeeth.includes(n)) x.rmTeeth.push(n); if (x.focusTooth === n) x.focusTooth = x.teeth[0] ?? null }
    else { x.teeth.push(n); x.rmTeeth = x.rmTeeth.filter(t => t !== n); x.focusTooth = n }
  }
  function focus(n: number) { if (s.value) s.value.focusTooth = n }
  function toggleType(id: string) {
    const x = s.value; if (!x) return
    if (x.types.includes(id)) { x.types = x.types.filter(t => t !== id); if (!x.rmTypes.includes(id)) x.rmTypes.push(id) }
    else { x.types.push(id); x.rmTypes = x.rmTypes.filter(t => t !== id) }
  }

  /* ---------- felszínek ---------- */
  const surfaces = computed<SurfaceMap>(() => {
    const x = s.value; if (!x) return {}
    const out: SurfaceMap = {}
    const orphanTarget = x.focusTooth ?? (x.teeth.length === 1 ? x.teeth[0] : null)
    x.teeth.forEach(n => {
      const set = new Set<Surface>([...(parsed.value.surfaces[n] || []), ...(x.manualSurf[n] || [])])
      if (n === orphanTarget) parsed.value.orphanSurfaces.forEach(sf => set.add(sf))
      ;(x.rmSurf[n] || []).forEach(sf => set.delete(sf))
      out[n] = SURFACE_ORDER.filter(sf => set.has(sf))
    })
    return out
  })
  function toggleSurface(n: number, sf: Surface) {
    const x = s.value; if (!x) return
    if (!x.teeth.includes(n)) toggleTooth(n)
    const has = surfaces.value[n]?.includes(sf)
    const add = (m: SurfaceMap) => { m[n] = [...new Set([...(m[n] || []), sf])] }
    const rem = (m: SurfaceMap) => { m[n] = (m[n] || []).filter(v => v !== sf) }
    if (has) { rem(x.manualSurf); add(x.rmSurf) } else { add(x.manualSurf); rem(x.rmSurf) }
  }
  const needsSurface = computed(() => !!s.value?.types.some(id => db.value.types.find(t => t.id === id)?.needsSurface))
  /** tömésnél kötelező a felszín: ahol nincs, ellenőrizendő */
  const missingSurface = computed(() => (needsSurface.value && s.value ? s.value.teeth.filter(n => !surfaces.value[n]?.length) : []))
  /** a foglaláskor tervezett felszíneken túl kezelt felszínek („kezelés közben bővítve”) */
  const extendedTeeth = computed(() => {
    const p = s.value?.planned; if (!p) return [] as number[]
    return (s.value?.teeth || []).filter(n => (surfaces.value[n] || []).some(sf => !(p.surfaces[n] || []).includes(sf)) && (p.teeth.includes(n)))
  })
  const offDentition = computed(() => (s.value ? s.value.teeth.filter(n => parsed.value.offDentition.includes(n)) : []))

  /* ---------- anyagjavaslat ---------- */
  const rows = computed<MatRow[]>(() => {
    const x = s.value; if (!x) return []
    const teeth = x.teeth
    const pkg = pkgFor(db.value, x.types, Math.max(1, teeth.length), surfacesFor(teeth, surfaces.value))
    const ids = new Set([...Object.keys(pkg), ...Object.keys(parsed.value.qty), ...Object.keys(parsed.value.rel || {}), ...x.extra])
    const order = db.value.items.map(i => i.id)
    return [...ids].filter(id => db.value.items.some(i => i.id === id)).sort((a, b) => order.indexOf(a) - order.indexOf(b)).map(id => {
      // a diktált szám a teljes mennyiség; „még / plusz N” esetén a csomag + N
      const pk = pkg[id] || 0, abs = parsed.value.qty[id], dRel = parsed.value.rel?.[id]
      const dq = abs !== undefined ? abs : dRel !== undefined ? pk + dRel : undefined
      let st: RowState
      if (dq === undefined && pk > 0) st = 'pkg'
      else if (dq !== undefined && pk === 0) st = 'dict'
      else if (dq !== undefined && dq === pk) st = 'ok'
      else if (dq !== undefined) st = 'diff'
      else st = 'manual'
      const auto = dq !== undefined ? dq : pk > 0 ? pk : 1
      const qty = x.overrides[id] !== undefined ? x.overrides[id]! : auto
      return { id, pk, dq, dRel, st, auto, qty, manual: x.overrides[id] !== undefined && x.overrides[id] !== auto, checked: !x.unchecked.includes(id) }
    })
  })
  const toReview = computed(() => rows.value.filter(r => r.checked && (r.st === 'diff' || r.st === 'dict')).length)
  function setChecked(id: string, on: boolean) { const x = s.value; if (!x) return; x.unchecked = on ? x.unchecked.filter(v => v !== id) : [...x.unchecked, id] }
  function setQty(id: string, v: number) { if (s.value) s.value.overrides[id] = Math.max(0, Number(v) || 0) }
  function resetQty(id: string) { if (s.value) delete s.value.overrides[id] }
  function addMaterial(id: string) { const x = s.value; if (!x) return; if (!x.extra.includes(id)) x.extra.push(id); setChecked(id, true); if (x.overrides[id] === undefined) x.overrides[id] = 1 }

  const fee = computed(() => (s.value ? feeFor(db.value, s.value.types, s.value.teeth, surfaces.value) : 0))
  /** a kiadandó gyártási tételek előnézete (lejárat szerint) */
  const lotPreview = (id: string, qty: number) => (db.value.items.find(i => i.id === id)?.lotTracked ? previewLots(db.value, id, qty) : [])
  const cost = computed(() => rows.value.filter(r => r.checked && r.qty > 0).reduce((sum, r) => sum + r.qty * (db.value.items.find(i => i.id === r.id)?.price || 0), 0))
  const consents = computed(() => (s.value ? db.value.consents.filter(c => c.sessKey === s.value!.key || (s.value!.recordId && c.recordId === s.value!.recordId)) : []))

  /* ---------- csatolmányok ---------- */
  const attachments = computed(() => (s.value ? db.value.attachments.filter(a => a.sessKey === s.value!.key || (s.value!.recordId && a.recordId === s.value!.recordId)) : []))
  async function upload(files: FileList | File[], type: string, note: string) {
    const x = s.value; if (!x) return { count: 0, memOnly: 0 }
    const repo = useRepository()
    let memOnly = 0; const list = [...files]
    for (const f of list) {
      const id = 'a' + uid()
      const ok = await repo.putFile(id, f); if (!ok) memOnly++
      db.value.attachments.push({ id, patientId: x.patientId, recordId: x.recordId, sessKey: x.recordId ? null : x.key, type: guessDocType(f.name, type), name: f.name, mime: f.type || '', size: f.size, date: today(), note })
    }
    return { count: list.length, memOnly }
  }

  /* ---------- mentés ---------- */
  function cancel() {
    const x = s.value; if (!x) return
    const repo = useRepository()
    db.value.attachments.filter(a => a.sessKey === x.key).forEach(a => repo.deleteFile(a.id))
    db.value.attachments = db.value.attachments.filter(a => a.sessKey !== x.key)
    db.value.consents = db.value.consents.filter(c => c.sessKey !== x.key)
    s.value = null
  }
  const hasUnsaved = computed(() => !!s.value && ((!!s.value.text.trim() && !s.value.recordId) || attachments.value.some(a => a.sessKey === s.value!.key)))

  /** jóváhagyás: a kartonba kerül, az anyagok levonódnak a raktárból; visszaadja a készlet-figyelmeztetéseket és a státuszjavaslatot */
  function approve() {
    const x = s.value; if (!x) return null
    if (!x.types.length && !x.text.trim()) return { error: 'Válassz kezelést vagy diktálj leírást.' }
    const mats = rows.value.filter(r => r.checked && r.qty > 0).map(r => ({ item: r.id, qty: r.qty }))
    const before: Record<string, number> = {}; db.value.items.forEach(i => { before[i.id] = i.stock })
    const teeth = [...x.teeth].sort((a, b) => a - b)
    const surf: SurfaceMap = {}; teeth.forEach(n => { if (surfaces.value[n]?.length) surf[n] = [...surfaces.value[n]!] })
    const tn = typeNames(db.value, x.types)
    const common = { doctorId: x.doctorId, typeIds: [...x.types], teeth, surfaces: surf, planned: x.planned, extended: extendedTeeth.value.length > 0, text: x.text.trim(), fee: fee.value, sterBatch: x.sterBatch }
    const item = (id: string) => db.value.items.find(i => i.id === id)
    let recId: string
    if (x.recordId) {
      const rec = db.value.records.find(r => r.id === x.recordId)!
      const old: Record<string, number> = {}; rec.materials.forEach(m => { old[m.item] = m.qty })
      const nw: Record<string, number> = {}; mats.forEach(m => { nw[m.item] = m.qty })
      const newMats = mats.map(m => ({ ...m, lots: rec.materials.find(o => o.item === m.item)?.lots?.map(l => ({ ...l })) || [] }))
      new Set([...Object.keys(old), ...Object.keys(nw)]).forEach(id => {
        const diff = (nw[id] || 0) - (old[id] || 0)
        const it = item(id); if (!diff || !it) return
        const nm = newMats.find(m => m.item === id)
        let lots: LotUse[] = []
        if (diff > 0) { lots = consumeStock(db.value, it, diff); if (nm) nm.lots = [...(nm.lots || []), ...lots] }
        else {
          const oldLots = rec.materials.find(o => o.item === id)?.lots || []
          returnStock(db.value, it, -diff, oldLots)
          if (nm) { let left = -diff; nm.lots = (nm.lots || []).slice().reverse().map(l => { const q = Math.min(l.qty, left); left -= q; return { ...l, qty: l.qty - q } }).filter(l => l.qty > 0).reverse() }
        }
        db.value.movements.push({ id: uid(), item: id, date: today(), qty: -diff, kind: 'corr', recordId: rec.id, patientId: rec.patientId, note: 'Kezelés utólagos módosítása (' + fmtDate(rec.date) + ')', lots: diff > 0 ? lots : undefined })
      })
      Object.assign(rec, common, { materials: newMats.map(m => ({ ...m, lots: m.lots?.length ? m.lots : undefined, cost: m.qty * (item(m.item)?.price || 0) })) }); recId = rec.id
    } else {
      recId = uid()
      const used = mats.map(m => {
        const it = item(m.item); if (!it) return { ...m }
        const cost = m.qty * it.price
        const lots = consumeStock(db.value, it, m.qty)
        db.value.movements.push({ id: uid(), item: m.item, date: x.date, qty: -m.qty, kind: 'use', recordId: recId, patientId: x.patientId, note: tn, lots: lots.length ? lots : undefined })
        return { ...m, cost, lots: lots.length ? lots : undefined }
      })
      const rec = { id: recId, patientId: x.patientId, appointmentId: x.appointmentId, date: x.date, time: x.time, ...common, materials: used, eeszt: { status: 'pending' as const } }
      db.value.records.push({ ...rec, patientInfo: { text: patientInfoDraft(db.value, rec), status: 'draft' } })
    }
    db.value.consents.forEach(c => { if (c.sessKey === x.key) { c.recordId = recId; c.sessKey = null } })
    db.value.attachments.forEach(a => { if (a.sessKey === x.key) { a.recordId = recId; a.sessKey = null } })
    const warns: { level: 'err' | 'warn'; text: string }[] = []
    db.value.items.forEach(it => {
      if (it.stock < 0 && before[it.id] !== it.stock) warns.push({ level: 'err', text: `${it.name}: a készlet mínuszba ment (${it.stock} ${it.unit}). Készlet-eltérés van, leltár indokolt.` })
      else if (it.stock < it.target * 0.1 && before[it.id]! >= it.target * 0.1) warns.push({ level: 'warn', text: `${it.name}: a készlet 10% alá csökkent (${it.stock} / ${it.target} ${it.unit}). Rendeld meg!` })
    })
    // a kezelés után felajánlott fogállapot (tömés után tömött, húzás után hiányzik…)
    const statusOffer: Record<string, string[]> = {}
    x.types.forEach(id => {
      const t = db.value.types.find(v => v.id === id)
      if (t?.statusAfter) teeth.forEach(n => { statusOffer[n] = [...new Set([...(statusOffer[n] || []), t.statusAfter!])] })
    })
    const pid = x.patientId
    s.value = null
    return { warns, statusOffer, patientId: pid, recordId: recId, hasInfo: !x.recordId }
  }

  /* ---------- fogazati státusz felvétele diktálással (2.2.6) ---------- */
  function setMode(m: 'treat' | 'status') { if (s.value) s.value.mode = m }
  function setStatusText(v: string, delay = 250) {
    if (!s.value) return
    s.value.statusText = v
    if (sTimer) clearTimeout(sTimer)
    sTimer = setTimeout(() => { statusParsed.value = analyzeStatus(s.value?.statusText || '', db.value.settings.statusDict, dentition.value) }, delay)
  }
  const statusDraft = computed<Record<string, string[]>>(() => ({ ...statusParsed.value.teeth, ...(s.value?.statusEdits || {}) }))
  function setToothStatus(n: number, states: string[]) { if (s.value) s.value.statusEdits[n] = states }
  /** ellentmondás a korábbi adatokkal → ellenőrizendő */
  const statusConflicts = computed(() => {
    const out: Record<string, string> = {}
    if (!s.value) return out
    const recs = db.value.records.filter(r => r.patientId === s.value!.patientId)
    Object.entries(statusDraft.value).forEach(([n, st]) => {
      const tr = recs.filter(r => r.teeth.includes(Number(n)))
      if (st.includes('hianyzik') && tr.length && !tr.some(r => r.typeIds.includes('huzas'))) out[n] = `${toothLabel(Number(n))}: hiányzónak diktálva, de korábbi kezelés szerepel rajta`
      if (st.includes('ep') && tr.some(r => r.typeIds.some(t => ['tomes', 'gyoker', 'korona'].includes(t)))) out[n] = `${toothLabel(Number(n))}: épnek diktálva, de korábban kezelték`
      if (statusParsed.value.offDentition.includes(Number(n))) out[n] = `${toothLabel(Number(n))}: nem a beállított fogazathoz tartozik`
    })
    return out
  })
  function approveStatus() {
    const x = s.value; if (!x) return false
    if (!Object.keys(statusDraft.value).length) return false
    patients.addStatus(x.patientId, statusDraft.value, statusParsed.value.unparsed.length ? 'Nem értelmezett: ' + statusParsed.value.unparsed.join('; ') : '')
    x.statusText = ''; x.statusEdits = {}; statusParsed.value = { teeth: {}, unparsed: [], offDentition: [] }; x.mode = 'treat'
    return true
  }
  function discardStatus() {
    const x = s.value; if (!x) return
    x.statusText = ''; x.statusEdits = {}; statusParsed.value = { teeth: {}, unparsed: [], offDentition: [] }; x.mode = 'treat'
  }

  const isDoneAppt = (id: string) => !!recordForAppt(db.value, id)

  return {
    s, parsed, statusParsed, patient, dentition, active,
    startFromAppointment, startNew, editRecord, setText, applyParse, toggleTooth, focus, toggleType,
    surfaces, toggleSurface, needsSurface, missingSurface, extendedTeeth, offDentition,
    rows, toReview, setChecked, setQty, resetQty, addMaterial, fee, lotPreview, cost, consents,
    attachments, upload, cancel, hasUnsaved, approve,
    setMode, setStatusText, statusDraft, setToothStatus, statusConflicts, approveStatus, discardStatus, isDoneAppt,
  }
})
