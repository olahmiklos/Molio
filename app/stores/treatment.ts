// Aktuális kezelés: diktálás értelmezése, fogak és felszínek, anyagjavaslat, díj, jóváhagyás,
// fogazati státusz felvétele, csatolmányok (2.2, 2.2.1, 2.2.5–2.2.7)
import { defineStore } from 'pinia'
import { useDataStore } from './data'
import { usePatientStore } from './patient'
import { useSuggestionStore } from './suggestion'
import { addDays, fmtDate, fromMin, nowMin, today, uid } from '~/utils/dates'
import type { ItemOrigin, LotUse, Planned, PlannedItem, Surface, SurfaceMap, VisitItem } from '~/utils/types'
import { analyze, analyzeItems, analyzeStatus, type ItemParse, type ParseResult, type StatusParse } from '~/utils/parser'
import { itemFee, pkgForItems, recordForAppt, typeNames } from '~/utils/logic'
import { allTeeth, SURFACE_ORDER, toothLabel } from '~/utils/teeth'
import { guessDocType } from '~/utils/defaults'
import { useRepository } from '~/repositories'
import { consumeStock, previewLots, returnStock } from '~/utils/stock'
import { patientInfoDraft, usableBatches } from '~/utils/office'
import { draftExpiry, liveDrafts } from '~/utils/v22'

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
  /** kezelési tételek (spec v2.1, 2. pont): foganként kézzel hozzárendelt műveletek, törölt párok, elhalasztott / javasolt állapot */
  assign: Record<string, string[]>
  rmPairs: string[]
  itemState: Record<string, 'postponed' | 'suggested'>
  planItems: PlannedItem[]
  hasPlan: boolean
  /** javasolt kezelések (12. pont): kézzel felvettek, a diktálásból felismertek közül törölt, módosított adatok */
  sugExtra: SugDraft[]
  rmSug: string[]
  sugMeta: Record<string, Partial<SugDraft>>
  /** diktálásból felismert fogállapot-változások (4. pont): kikapcsoltak és kézzel felvettek */
  statusOff: string[]
  statusManual: Record<string, string[]>
  confirmedConf: string[]
  /** a ⚠ jelölésű anyagsorok, amelyeket az orvos / asszisztens megerősített (spec v2.2, 4. pont) */
  confirmedRows: string[]
}

export type SItemState = 'done' | 'postponed' | 'suggested'
export interface SItem { key: string; tooth: number | null; typeId: string; surfaces: Surface[]; origin: ItemOrigin; state: SItemState; fee: number }
export interface SugDraft { key: string; tooth: number | null; typeId: string; surfaces: Surface[]; urgency: 'urgent' | 'recommended' | 'later'; due: string | null; note: string }
export const pairKey = (tooth: number | null, typeId: string) => `${tooth ?? 0}:${typeId}`

const EMPTY_PARSE: ParseResult = { teeth: [], surfaces: {}, orphanSurfaces: [], types: [], qty: {}, rel: {}, offDentition: [] }
const EMPTY_ITEMS: ItemParse = { done: [], suggested: [], suggestOnlyTeeth: [], doneTypes: [], conflicts: [] }

export const useTreatmentStore = defineStore('treatment', () => {
  const data = useDataStore()
  const patients = usePatientStore()
  const db = computed(() => data.db)
  const s = ref<Session | null>(null)
  const parsed = ref<ParseResult>(EMPTY_PARSE)
  const statusParsed = ref<StatusParse>({ teeth: {}, unparsed: [], offDentition: [] })
  const itemParse = ref<ItemParse>(EMPTY_ITEMS)
  const dictStatus = ref<Record<string, string[]>>({})
  const sugs = useSuggestionStore()
  let timer: ReturnType<typeof setTimeout> | null = null
  let sTimer: ReturnType<typeof setTimeout> | null = null

  const isBound = (id: string) => !!db.value.types.find(t => t.id === id)?.toothBound
  const patient = computed(() => (s.value ? patients.byId(s.value.patientId) : undefined))
  const dentition = computed(() => patient.value?.dentition || 'permanent')

  function base(o: Partial<Session> & { patientId: string; doctorId: string; date: string; time: string }): Session {
    return { key: 'k' + uid(), recordId: null, appointmentId: null, text: '', teeth: [], types: [], rmTeeth: [], rmTypes: [], manualSurf: {}, rmSurf: {}, overrides: {}, unchecked: [], extra: [], planned: null, focusTooth: null, mode: 'treat', sterBatch: usableBatches(db.value)[0]?.batch || null, statusText: '', statusEdits: {}, assign: {}, rmPairs: [], itemState: {}, planItems: [], hasPlan: false, sugExtra: [], rmSug: [], sugMeta: {}, statusOff: [], statusManual: {}, confirmedConf: [], confirmedRows: [], ...o }
  }
  const nowSlot = () => fromMin(Math.min(Math.max(Math.floor(nowMin() / 30) * 30, db.value.settings.startHour * 60), db.value.settings.endHour * 60 - 30))

  /** az előjegyzett tételek: a foglalás saját tételei, vagy a tervezett fogak × a foglalt műveletek */
  function plannedItemsOf(a: { items?: PlannedItem[]; planned?: Planned | null; typeIds: string[] }): PlannedItem[] {
    if (a.items?.length) return a.items.map(i => ({ ...i, surfaces: [...i.surfaces] }))
    const out: PlannedItem[] = []
    a.typeIds.forEach(tid => {
      if (isBound(tid) && a.planned?.teeth.length) a.planned.teeth.forEach(n => out.push({ tooth: n, typeId: tid, surfaces: [...(a.planned!.surfaces[n] || [])] }))
      else out.push({ tooth: null, typeId: tid, surfaces: [] })
    })
    return out
  }
  /** kezelés indítása az időpontból: a páciens, az előjegyzett tételek és a tervezett fog/felszín átkerül */
  function startFromAppointment(apptId: string) {
    const a = db.value.appointments.find(x => x.id === apptId); if (!a) return
    const planned = a.planned ? JSON.parse(JSON.stringify(a.planned)) as Planned : null
    const planItems = plannedItemsOf(a)
    const assign: Record<string, string[]> = {}, surf: SurfaceMap = {}
    planItems.forEach(i => { if (i.tooth) { (assign[i.tooth] = assign[i.tooth] || []).push(i.typeId); surf[i.tooth] = [...new Set([...(surf[i.tooth] || []), ...i.surfaces])] } })
    const teeth = [...new Set(planItems.map(i => i.tooth).filter((n): n is number => !!n))]
    s.value = base({ patientId: a.patientId, appointmentId: a.id, doctorId: a.doctorId, date: today(), time: a.date === today() ? a.start : nowSlot(), types: [...a.typeIds], planned, teeth, assign, planItems, hasPlan: true, manualSurf: planned ? { ...JSON.parse(JSON.stringify(planned.surfaces)), ...surf } : surf })
    parsed.value = EMPTY_PARSE; itemParse.value = EMPTY_ITEMS; dictStatus.value = {}
    restoreDraft()
  }
  function startNew(pid: string) {
    const pdoc = patients.byId(pid)?.doctorId
    s.value = base({ patientId: pid, doctorId: pdoc || db.value.doctors[0]!.id, date: today(), time: nowSlot() })
    parsed.value = EMPTY_PARSE; itemParse.value = EMPTY_ITEMS; dictStatus.value = {}
    restoreDraft()
  }
  /* ---------- diktálási piszkozat (spec v2.2, 4. pont): 7 napig megmarad, készletet nem von le ---------- */
  const draftOf = (pid: string, apptId: string | null) => liveDrafts(db.value).find(d => d.patientId === pid && d.appointmentId === apptId)
  const restored = ref(false)
  function restoreDraft() {
    const x = s.value; restored.value = false; if (!x || x.recordId) return
    const d = draftOf(x.patientId, x.appointmentId)
    if (d && d.text.trim()) { x.text = d.text; restored.value = true; applyParse() }
  }
  function saveDraft() {
    const x = s.value; if (!x || x.recordId) return
    db.value.drafts = liveDrafts(db.value).filter(d => !(d.patientId === x.patientId && d.appointmentId === x.appointmentId))
    if (x.text.trim()) db.value.drafts.push({ id: uid(), patientId: x.patientId, appointmentId: x.appointmentId, recordId: null, doctorId: x.doctorId, text: x.text, savedAt: new Date().toISOString(), expires: draftExpiry() })
  }
  function dropDraft(pid: string, apptId: string | null) { db.value.drafts = db.value.drafts.filter(d => !(d.patientId === pid && d.appointmentId === apptId)) }
  function editRecord(rid: string) {
    const r = db.value.records.find(x => x.id === rid); if (!r) return
    const assign: Record<string, string[]> = {}, itemState: Session['itemState'] = {}
    const its = r.items?.filter(i => i.typeId) || []
    its.forEach(i => { if (i.tooth) { (assign[i.tooth] = assign[i.tooth] || []).push(i.typeId); if (i.state === 'postponed') itemState[pairKey(i.tooth, i.typeId)] = 'postponed' } else if (i.state === 'postponed') itemState[pairKey(null, i.typeId)] = 'postponed' })
    const teeth = r.items?.length ? [...new Set(r.items.map(i => i.tooth).filter((n): n is number => !!n))] : [...r.teeth]
    const types = r.items?.length ? [...new Set(its.map(i => i.typeId))] : [...r.typeIds]
    s.value = base({ recordId: r.id, sterBatch: r.sterBatch ?? null, patientId: r.patientId, appointmentId: r.appointmentId, doctorId: r.doctorId, date: r.date, time: r.time, teeth, types, assign, itemState, text: r.text, manualSurf: JSON.parse(JSON.stringify(r.surfaces || {})), planned: r.planned ? JSON.parse(JSON.stringify(r.planned)) : null,
      hasPlan: !!r.planned || !!r.items?.some(i => i.origin !== 'manual'), planItems: (r.items || []).filter(i => i.origin === 'planned').map(i => ({ tooth: i.tooth, typeId: i.typeId, surfaces: [...i.surfaces] })) })
    parsed.value = analyze(r.text, db.value, { dentition: dentition.value })
    itemParse.value = EMPTY_ITEMS; dictStatus.value = {}
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
    timer = setTimeout(() => { applyParse(); saveDraft() }, delay)
  }
  /** a diktálás végén azonnali feldolgozás: az előnézet azonnal elkészül, nem vár a késleltetésre */
  function finishDictation() { if (timer) clearTimeout(timer); applyParse(); saveDraft() }
  function applyParse() {
    if (!s.value) return
    const x = s.value
    parsed.value = analyze(x.text, db.value, { dentition: dentition.value })
    itemParse.value = analyzeItems(x.text, db.value)
    const ip = itemParse.value
    // a csak javaslatként említett fog és művelet nem elvégzett kezelés (12. pont)
    if (ip.suggested.length) {
      parsed.value.teeth = parsed.value.teeth.filter(t => !ip.suggestOnlyTeeth.includes(t))
      parsed.value.types = parsed.value.types.filter(t => ip.doneTypes.includes(t))
    }
    // fogállapot-változás a diktálásból (4. pont): csak a kimondott fogakra
    dictStatus.value = analyzeStatus(x.text, db.value.settings.statusDict, dentition.value, { explicitOnly: true }).teeth
    // a csak állapotként említett fog (pl. „16-os hiányzik”) nem kezelt fog
    const doneTeeth = new Set(ip.done.map(d => d.tooth))
    const statusOnly = Object.keys(dictStatus.value).map(Number).filter(n => !doneTeeth.has(n))
    parsed.value.teeth = parsed.value.teeth.filter(t => !statusOnly.includes(t))
    parsed.value.teeth.forEach(t => { if (!x.rmTeeth.includes(t) && !x.teeth.includes(t)) x.teeth.push(t) })
    parsed.value.types.forEach(t => { if (!x.rmTypes.includes(t) && !x.types.includes(t)) x.types.push(t) })
    if (parsed.value.teeth.length) x.focusTooth = parsed.value.teeth[parsed.value.teeth.length - 1]!
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

  /* ---------- kezelési tételek: fog × művelet (2. pont) ---------- */
  const items = computed<SItem[]>(() => {
    const x = s.value; if (!x) return []
    const explicit: { tooth: number | null; typeId: string }[] = []
    const addP = (tooth: number | null, typeId: string) => { if (!explicit.some(p => p.tooth === tooth && p.typeId === typeId)) explicit.push({ tooth, typeId }) }
    itemParse.value.done.forEach(p => addP(p.tooth, p.typeId))
    Object.entries(x.assign).forEach(([n, ts]) => ts.forEach(t => addP(Number(n), t)))
    x.planItems.forEach(p => { if (p.tooth) addP(p.tooth, p.typeId) })
    const valid = (p: { tooth: number | null; typeId: string }) => x.types.includes(p.typeId) && (p.tooth === null || x.teeth.includes(p.tooth)) && !x.rmPairs.includes(pairKey(p.tooth, p.typeId))
    const pairs = explicit.filter(p => p.tooth !== null && valid(p))
    const covered = new Set(pairs.map(p => p.tooth))
    x.types.forEach(tid => {
      if (isBound(tid)) {
        const has = explicit.some(p => p.typeId === tid && p.tooth !== null && x.teeth.includes(p.tooth))
        x.teeth.forEach(n => {
          if (pairs.some(p => p.tooth === n && p.typeId === tid)) return
          // kézzel jelölt fog: minden olyan műveletet megkap, amelyhez még nincs explicit fog
          if ((!has || !covered.has(n)) && !x.rmPairs.includes(pairKey(n, tid))) pairs.push({ tooth: n, typeId: tid })
        })
      } else if (!x.rmPairs.includes(pairKey(null, tid))) pairs.push({ tooth: null, typeId: tid })
    })
    return pairs.sort((a, b) => (a.tooth ?? 999) - (b.tooth ?? 999)).map(p => {
      const key = pairKey(p.tooth, p.typeId)
      const planned = x.planItems.some(i => i.tooth === p.tooth && i.typeId === p.typeId)
      const origin: ItemOrigin = planned ? 'planned' : x.hasPlan ? 'added' : 'manual'
      const st = x.itemState[key] === 'postponed' ? 'postponed' : 'done'
      const sf = p.tooth ? [...(surfaces.value[p.tooth] || [])] : []
      return { key, tooth: p.tooth, typeId: p.typeId, surfaces: sf, origin, state: st as SItemState, fee: itemFee(db.value, p.typeId, sf) }
    })
  })
  const doneItems = computed(() => items.value.filter(i => i.state === 'done'))
  const itemTotal = computed(() => doneItems.value.reduce((a, i) => a + i.fee, 0))
  function setItemState(key: string, st: 'done' | 'postponed') { const x = s.value; if (!x) return; if (st === 'done') delete x.itemState[key]; else x.itemState[key] = 'postponed' }
  function removeItem(key: string) {
    const x = s.value; if (!x) return
    if (!x.rmPairs.includes(key)) x.rmPairs.push(key)
    const it = items.value.find(i => i.key === key)
    if (it?.tooth && x.assign[it.tooth]) x.assign[it.tooth] = x.assign[it.tooth]!.filter(t => t !== it.typeId)
  }
  /** kezelés közben hozzáadott tétel (a kartonba „hozzáadva” jelöléssel kerül) */
  function addItem(tooth: number | null, typeId: string) {
    const x = s.value; if (!x) return
    if (tooth && !x.teeth.includes(tooth)) { x.teeth.push(tooth); x.rmTeeth = x.rmTeeth.filter(t => t !== tooth) }
    if (!x.types.includes(typeId)) { x.types.push(typeId); x.rmTypes = x.rmTypes.filter(t => t !== typeId) }
    x.rmPairs = x.rmPairs.filter(k => k !== pairKey(tooth, typeId))
    if (tooth) { x.assign[tooth] = [...new Set([...(x.assign[tooth] || []), typeId])]; x.focusTooth = tooth }
  }

  /* ---------- javasolt további kezelések (12. pont) ---------- */
  const suggestList = computed<SugDraft[]>(() => {
    const x = s.value; if (!x) return []
    const list: SugDraft[] = itemParse.value.suggested.filter(p => !x.rmSug.includes(pairKey(p.tooth, p.typeId))).map(p => ({
      key: pairKey(p.tooth, p.typeId), tooth: p.tooth, typeId: p.typeId, surfaces: p.tooth ? [...(surfaces.value[p.tooth] || x.manualSurf[p.tooth] || [])] : [],
      urgency: p.urgent ? 'urgent' : 'recommended', due: p.dueDays !== null ? addDays(x.date, p.dueDays) : null, note: '' }))
    x.sugExtra.forEach(e => { if (!list.some(l => l.key === e.key)) list.push(e) })
    return list.map(l => ({ ...l, ...(x.sugMeta[l.key] || {}) }))
  })
  function addSuggestion(tooth: number | null, typeId: string) {
    const x = s.value; if (!x) return
    const key = pairKey(tooth, typeId); x.rmSug = x.rmSug.filter(k => k !== key)
    if (!x.sugExtra.some(e => e.key === key)) x.sugExtra.push({ key, tooth, typeId, surfaces: [], urgency: 'recommended', due: null, note: '' })
  }
  function removeSuggestion(key: string) { const x = s.value; if (!x) return; x.sugExtra = x.sugExtra.filter(e => e.key !== key); if (!x.rmSug.includes(key)) x.rmSug.push(key) }
  function setSuggestion(key: string, patch: Partial<SugDraft>) { const x = s.value; if (!x) return; x.sugMeta[key] = { ...(x.sugMeta[key] || {}), ...patch } }

  /* ---------- diktált fogállapot-változás (4. pont) ---------- */
  const statusChanges = computed(() => {
    const x = s.value; if (!x) return [] as { tooth: number; from: string[]; to: string[]; manual: boolean }[]
    const prev = patients.latestStatus(x.patientId)?.teeth || {}
    const merged: Record<string, string[]> = {}
    Object.entries(dictStatus.value).forEach(([n, st]) => { if (!x.statusOff.includes(n)) merged[n] = st })
    Object.entries(x.statusManual).forEach(([n, st]) => { merged[n] = st })
    return Object.entries(merged).map(([n, to]) => ({ tooth: Number(n), from: prev[n] || [], to, manual: n in x.statusManual }))
      .filter(c => [...c.from].sort().join() !== [...c.to].sort().join()).sort((a, b) => a.tooth - b.tooth)
  })
  function setStatusChange(n: number, to: string[] | null) { const x = s.value; if (!x) return; if (to === null) { delete x.statusManual[n]; if (!x.statusOff.includes(String(n))) x.statusOff.push(String(n)) } else { x.statusManual[n] = to; x.statusOff = x.statusOff.filter(k => k !== String(n)) } }
  /** „bal alsó 48-as”: az oldal és a fogszám ellentmond – a mentés előtt meg kell erősíteni */
  const sideConflicts = computed(() => itemParse.value.conflicts.filter(c => !s.value?.confirmedConf.includes(c.key)))
  function confirmConflict(key: string) { const x = s.value; if (x && !x.confirmedConf.includes(key)) x.confirmedConf.push(key) }

  /* ---------- anyagjavaslat ---------- */
  const rows = computed<MatRow[]>(() => {
    const x = s.value; if (!x) return []
    const pkg = pkgForItems(db.value, doneItems.value)
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
  const toReview = computed(() => s.value?.recordId ? 0 : rows.value.filter(r => r.checked && (r.st === 'diff' || r.st === 'dict') && !s.value?.confirmedRows.includes(r.id)).length)
  const confirmRow = (id: string) => { const x = s.value; if (x && !x.confirmedRows.includes(id)) x.confirmedRows.push(id) }
  function setChecked(id: string, on: boolean) { const x = s.value; if (!x) return; x.unchecked = on ? x.unchecked.filter(v => v !== id) : [...x.unchecked, id] }
  function setQty(id: string, v: number) { if (s.value) { s.value.overrides[id] = Math.max(0, Number(v) || 0); confirmRow(id) } }
  function resetQty(id: string) { if (s.value) delete s.value.overrides[id] }
  function addMaterial(id: string) { const x = s.value; if (!x) return; if (!x.extra.includes(id)) x.extra.push(id); setChecked(id, true); if (x.overrides[id] === undefined) x.overrides[id] = 1 }

  const fee = itemTotal
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
    saveDraft()
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
    if (!items.value.length && !x.text.trim()) return { error: 'Válassz kezelést vagy diktálj leírást.' }
    if (sideConflicts.value.length) return { error: 'Oldal és fogszám ellentmond (' + sideConflicts.value.map(c => c.said).join(', ') + '). Erősítsd meg a fogszámot a mentés előtt.' }
    if (toReview.value) return { error: `${toReview.value} ⚠ jelölésű anyagsort meg kell erősíteni (Megerősítem, vagy módosítsd a mennyiséget), mielőtt a kezelés véglegesíthető.` }
    const mats = rows.value.filter(r => r.checked && r.qty > 0).map(r => ({ item: r.id, qty: r.qty }))
    const before: Record<string, number> = {}; db.value.items.forEach(i => { before[i.id] = i.stock })
    const done = doneItems.value
    const typeIds = [...new Set(done.map(i => i.typeId))]
    const teeth = [...new Set(done.map(i => i.tooth).filter((n): n is number => !!n))].sort((a, b) => a - b)
    const surf: SurfaceMap = {}; teeth.forEach(n => { if (surfaces.value[n]?.length) surf[n] = [...surfaces.value[n]!] })
    const tn = typeNames(db.value, typeIds)
    const common = { doctorId: x.doctorId, typeIds, teeth, surfaces: surf, items: items.value.map(i => ({ id: uid(), tooth: i.tooth, typeId: i.typeId, surfaces: i.surfaces, origin: i.origin, state: i.state as 'done' | 'postponed', fee: i.fee })) as VisitItem[], planned: x.planned, extended: extendedTeeth.value.length > 0, text: x.text.trim(), fee: fee.value, sterBatch: x.sterBatch }
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
      rec.editLog = [...(rec.editLog || []), { at: today() + ' ' + fromMin(nowMin()), by: db.value.doctors.find(d => d.id === x.doctorId)?.name || '', note: 'Utólagos módosítás' }]
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
    // javasolt további kezelések: asszisztensi teendőlista (12. pont); a most elvégzett tételek lezárják a korábbi javaslatot
    suggestList.value.forEach(g => sugs.add({ patientId: x.patientId, recordId: recId, doctorId: x.doctorId, tooth: g.tooth, typeId: g.typeId, surfaces: g.surfaces, note: g.note, urgency: g.urgency, due: g.due, remindAt: null, callback: false }))
    sugs.completeFor(x.patientId, x.appointmentId, done.map(i => ({ tooth: i.tooth, typeId: i.typeId })))
    // diktált fogállapot-változás: rögzítés a státuszba, a kezelés napjával (4. pont)
    const chg = statusChanges.value
    if (chg.length) { const m: Record<string, string[]> = {}; chg.forEach(c => { m[c.tooth] = c.to }); patients.addStatus(x.patientId, m, 'Diktálásból rögzítve', 'dictation') }
    dropDraft(x.patientId, x.appointmentId)
    const nSug = suggestList.value.length
    const pid = x.patientId
    s.value = null
    return { warns, statusOffer, patientId: pid, recordId: recId, hasInfo: !x.recordId, statusChanged: chg.length, suggested: nSug }
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
    items, doneItems, itemTotal, setItemState, removeItem, addItem, itemParse, suggestList, addSuggestion, removeSuggestion, setSuggestion, statusChanges, setStatusChange, sideConflicts, confirmConflict, dictStatus,
    surfaces, toggleSurface, needsSurface, missingSurface, extendedTeeth, offDentition,
    rows, toReview, setChecked, setQty, resetQty, addMaterial, fee, lotPreview, cost, consents,
    attachments, upload, cancel, hasUnsaved, approve, finishDictation, confirmRow, saveDraft, restored, draftOf, dropDraft,
    setMode, setStatusText, statusDraft, setToothStatus, statusConflicts, approveStatus, discardStatus, isDoneAppt,
  }
})
