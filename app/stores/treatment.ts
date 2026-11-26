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
import { preprocess, type DictFlag, type PipeResult } from '~/utils/dict/pipeline'
import { buildVocab } from '~/utils/dict/vocab'
import { reviewFlags, type PairLite } from '~/utils/dict/review'
import { buildPrompt } from '~/utils/dict/prompt'
import { DEFAULT_HALLU as DEFAULT_HALLU_LIST } from '~/utils/dict/filters'
import { useDictStore } from './dict'
import type { DictResult } from './voice'
import { findMacros, comboSig, shouldRecommend, type MacroHit } from '~/utils/dict/macro'
import { correctionPairs, guessCat, isRiskyCat, scopeOf } from '~/utils/dict/learn'
import type { PromptStyle } from '~/utils/dict/prompt'
import { planMarks, queueInfo } from '~/utils/v24'
import { norm } from '~/utils/dates'
import { clauseWithKw, clauseWithTooth, clauseWithWord, matchRules, type InterpRule } from '~/utils/dict/interp'
import { useUiStore } from './ui'

export type RowState = 'ok' | 'diff' | 'dict' | 'pkg' | 'manual' | 'macro'
export interface MatRow { id: string; pk: number; dq?: number; dRel?: number; st: RowState; auto: number; qty: number; manual: boolean; checked: boolean; /** v2.4 15. pont: a sor (részben) rövidítésből jön */ macro?: string }

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
  /** v2.3: a ⚠ sorok választásai (szó-egyeztetés, kétértelmű szó), a megoldott jelzések, fogcserék, a diktálás adatai és az AI-értelmezés */
  picks: Record<string, string>
  resolved: Record<string, string>
  toothSub: Record<number, number>
  dict: { recognizer: string; live: string; seconds: number; differs: boolean; fallback: boolean; noSpeech: boolean; noted: string[]; whisper?: string; browserFinal?: string }
  /** v2.4 8. pont: a tervezett, de szándékosan el nem végzett tételek („Nem történt meg”) – kulcs → megjegyzés */
  notDone: Record<string, string>
  /** v2.4 15. pont: a rövidítéshez választott fog, a kétértelmű elhagyás döntése, a visszaállított (elhagyott) sorok */
  macroTooth: Record<string, number>
  macroOmit: Record<string, number>
  macroRestore: string[]
  /** v2.4 6. pont: az ebben a kezelésben visszavont tanult szabályok */
  undoRules: string[]
  /** v2.5 4. pont: az ebben a kezelésben tanult értelmezési szabályok (a következő diktálástól érvényesek, itt még nem futnak le),
   * a kézzel hozzáadott anyaghoz tanult szabály (a mennyiség utólagos módosítása ezt frissíti), és az itt lefutott tanult szabályok (mérés) */
  learnedHere?: string[]
  interpItem?: Record<string, string>
  seenRules?: string[]
  ai: { state: 'idle' | 'run' | 'done' | 'err'; model: string; items: { tooth: number | null; typeId: string; status: string }[]; materials: { item: string; qty: number }[]; error: string }
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
    return { key: 'k' + uid(), recordId: null, appointmentId: null, text: '', teeth: [], types: [], rmTeeth: [], rmTypes: [], manualSurf: {}, rmSurf: {}, overrides: {}, unchecked: [], extra: [], planned: null, focusTooth: null, mode: 'treat', sterBatch: usableBatches(db.value)[0]?.batch || null, statusText: '', statusEdits: {}, assign: {}, rmPairs: [], itemState: {}, planItems: [], hasPlan: false, sugExtra: [], rmSug: [], sugMeta: {}, statusOff: [], statusManual: {}, confirmedConf: [], confirmedRows: [], picks: {}, resolved: {}, toothSub: {}, dict: { recognizer: 'kézi', live: '', seconds: 0, differs: false, fallback: false, noSpeech: false, noted: [] }, ai: { state: 'idle', model: '', items: [], materials: [], error: '' }, notDone: {}, macroTooth: {}, macroOmit: {}, macroRestore: [], undoRules: [], ...o }
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
  /** kezelés indítása az időpontból: a páciens és az előjegyzett tételek (a „Mai feladat” összefoglalóhoz és az ellenőrzéshez) átkerülnek.
   * v2.4 8. pont 5.: a tervezett kezelések NEM töltődnek be automatikusan az eredménybe – az eredmény mindig a ténylegesen diktált (vagy kézzel rögzített) tartalom. */
  function startFromAppointment(apptId: string) {
    const a = db.value.appointments.find(x => x.id === apptId); if (!a) return
    const planned = a.planned ? JSON.parse(JSON.stringify(a.planned)) as Planned : null
    const planItems = plannedItemsOf(a)
    s.value = base({ patientId: a.patientId, appointmentId: a.id, doctorId: a.doctorId, date: today(), time: a.date === today() ? a.start : nowSlot(), types: [], planned, teeth: [], assign: {}, planItems, hasPlan: true, manualSurf: {} })
    parsed.value = EMPTY_PARSE; itemParse.value = EMPTY_ITEMS; dictStatus.value = {}
    restoreDraft()
  }
  /** v2.4 8. pont 9.: indítás a páciens előjegyzett (javasolt) kezelési tételéből: a „Mai feladat” a tételből készül */
  function startFromSuggestion(sid: string) {
    const g = db.value.suggestions.find(x => x.id === sid); if (!g) return
    s.value = base({ patientId: g.patientId, doctorId: g.performerId || patients.byId(g.patientId)?.doctorId || db.value.doctors[0]!.id, date: today(), time: nowSlot(), planItems: [{ tooth: g.tooth, typeId: g.typeId, surfaces: [...g.surfaces], suggestionId: g.id }], hasPlan: true, planned: g.tooth ? { teeth: [g.tooth], surfaces: g.surfaces.length ? { [g.tooth]: [...g.surfaces] } : {} } : null })
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
  /** a diktálás végén azonnali feldolgozás: az előnézet azonnal elkészül, nem vár a késleltetésre; a felismerő adatai a naplóhoz és a megjelenítéshez */
  function finishDictation(info?: DictResult) {
    const x = s.value
    if (x && info) x.dict = { ...x.dict, recognizer: info.recognizer === 'whisper' ? 'Whisper' : info.recognizer === 'browser' ? 'böngésző' : 'nincs', live: info.live || '', seconds: info.seconds, differs: info.differs, fallback: info.fallback, noSpeech: info.noSpeech, whisper: info.whisper, browserFinal: info.browserFinal }
    if (timer) clearTimeout(timer); applyParse(); saveDraft()
    if (x) {
      const key = x.text.trim()
      if (key && !x.dict.noted.includes(key)) { x.dict.noted.push(key); useDictStore().noteUnknown(pipe.value.unknown, x.text) }
      void runAi()
    }
  }
  /* ---------- a szövegfeldolgozási lánc (spec v2.3) ---------- */
  const dictStore = () => { const d = useDictStore(); d.init(); return d }
  const vocab = computed(() => buildVocab({ items: db.value.items, types: db.value.types, statusDict: db.value.settings.statusDict }))
  const pipe = ref<PipeResult>({ raw: '', text: '', cleaned: '', steps: [], flags: [], filteredOut: [], unknown: [] })
  /* ---------- v2.4 15. pont: rövidítések ---------- */
  const macroHits = ref<MacroHit[]>([])
  const lineKey = (h: MacroHit, i: number) => `${h.key}#${i}`
  /** a sor ténylegesen elhagyott-e (a „nélkül” szerint, a kétértelmű elhagyás döntése, illetve a visszaállítás után) */
  function lineOmitted(h: MacroHit, i: number): boolean {
    const x = s.value; if (!x) return false
    if (x.macroRestore.includes(lineKey(h, i))) return false
    if (h.ambiguousOmit && x.macroOmit[h.key] !== undefined) return x.macroOmit[h.key] === i || h.lines[i]!.omitted
    return h.lines[i]!.omitted
  }
  /** a rövidítésekből adódó tételek (fog × művelet): a fogszámos tétel a kimondott fogra, ennek hiányában a választott fogra */
  function macroPairs(): { tooth: number | null; typeId: string; macro: string }[] {
    const x = s.value; if (!x) return []
    const out: { tooth: number | null; typeId: string; macro: string }[] = []
    macroHits.value.forEach(h => h.lines.forEach((l, i) => {
      if (l.kind !== 'type' || l.missing || lineOmitted(h, i)) return
      if (isBound(l.id)) { const teeth = h.teeth.length ? h.teeth : x.macroTooth[h.key] ? [x.macroTooth[h.key]!] : []; teeth.forEach(n => out.push({ tooth: n, typeId: l.id, macro: h.name })) }
      else out.push({ tooth: null, typeId: l.id, macro: h.name })
    }))
    return out
  }
  /** a rövidítés anyagai: alapmennyiség (a diktált szám felülírja, a „plusz N” hozzáadódik) */
  const macroMats = computed<Record<string, { qty: number; macro: string }>>(() => {
    const out: Record<string, { qty: number; macro: string }> = {}
    macroHits.value.forEach(h => h.lines.forEach((l, i) => { if (l.kind === 'mat' && !l.missing && !lineOmitted(h, i)) out[l.id] = { qty: (out[l.id]?.qty || 0) + (l.qty || 1), macro: h.name } }))
    return out
  })
  const macroOf = (tooth: number | null, typeId: string) => macroPairs().find(p => p.typeId === typeId && (p.tooth === tooth || p.tooth === null))?.macro
  function setMacroTooth(key: string, n: number) { const x = s.value; if (!x) return; x.macroTooth[key] = n; applyParse() }
  function setMacroOmit(key: string, idx: number) { const x = s.value; if (!x) return; x.macroOmit[key] = idx; applyParse() }
  function restoreMacroLine(h: MacroHit, i: number) { const x = s.value; if (!x) return; if (!x.macroRestore.includes(lineKey(h, i))) x.macroRestore.push(lineKey(h, i)); applyParse() }
  /* ---------- v2.4 6. pont: a tanult szabály első alkalmazása (fogszám / művelet / anyag) jelölést kap és visszavonható ---------- */
  /** v2.5 4. pont: a most lefutott értelmezési szabályok (applyParse tölti) */
  const interpApplied = ref<InterpRule[]>([])
  const learnedApplied = computed(() => {
    const d = dictStore(), seen = new Set<string>()
    const word = pipe.value.steps.filter(st => st.kind === 'personal').map(st => d.s.personal.find(p => p.from === st.from && p.to === st.to)).filter((p): p is NonNullable<typeof p> => !!p && !seen.has(p.id) && (seen.add(p.id), true))
      .map(p => ({ rule: p as { id: string; from: string; to: string; uses?: number; cat?: string }, first: (p.uses || 0) === 0, risky: isRiskyCat(p.cat), interp: false }))
    // az értelmezési szabály mindig fogszámot, műveletet vagy anyagot (mennyiségét) módosít: az első alkalmazáskor jelölést kap
    const ip = interpApplied.value.map(r => ({ rule: r as { id: string; from: string; to: string; uses?: number; cat?: string }, first: (r.uses || 0) === 0, risky: true, interp: true }))
    return [...word, ...ip]
  })
  function undoLearned(ruleId: string) { const x = s.value; if (!x) return; if (!x.undoRules.includes(ruleId)) x.undoRules.push(ruleId); applyParse() }
  /* ---------- v2.5 4. pont: értelmezési javítás tanulása (a javítás maga a jóváhagyás) ---------- */
  const itemOf = (id: string) => db.value.items.find(i => i.id === id)
  const kwOf = (id: string) => { const it = itemOf(id); return it ? [...(it.kw || []), norm(it.name).split(' ')[0]! + '*'] : [] }
  /** szabály a javításból; csak diktált szövegnél és új kezelésnél; ütközésnél a legutóbbi érvényes, a program jelzi */
  function learnInterp(x: Parameters<ReturnType<typeof useDictStore>['learnInterp']>[0]): InterpRule | null {
    const st = s.value; if (!st || st.recordId || !st.text.trim()) return null
    const r = dictStore().learnInterp(x); if (!r) return null
    st.learnedHere = [...new Set([...(st.learnedHere || []), r.rule.id])]
    useUiStore().toast(r.conflict ? `Ütköző javítás: „${r.rule.from}” korábban → ${r.conflict}, most → ${r.rule.to} (a legutóbbi érvényes).` : `Megjegyeztem: „${r.rule.from}” → ${r.rule.to} – a következő diktálástól magától így értelmezem.`)
    return r.rule
  }
  /** kézzel javított mennyiség (vagy a ⚠ sorban választott mennyiség / anyag): a tételt említő mondatrészből szabály */
  function learnQty(id: string, qty: number, cat: 'mennyiség' | 'anyag' = 'mennyiség') {
    const st = s.value; if (!st) return
    const it = itemOf(id); if (!it) return
    const ruleId = st.interpItem?.[id]
    if (ruleId) { const r = dictStore().s.interp.find(v => v.id === ruleId); if (r) { r.qty = qty; r.to = `${it.name} ${qty} ${it.unit}`; return } }
    const phrase = clauseWithKw(pipe.value.text, kwOf(id)); if (!phrase) return
    learnInterp({ phrase, cat, item: id, qty, from: phrase, to: `${it.name} ${qty} ${it.unit}` })
  }
  function applyParse() {
    if (!s.value) return
    const x = s.value
    const d = dictStore()
    // kitaláció-szűrő: a bővítések a kódtáblák között szerkeszthetők
    pipe.value = preprocess(x.text, { personal: d.s.personal.filter(p => !x.undoRules.includes(p.id)), filterList: d.s.extraFilter.length ? [...DEFAULT_HALLU_LIST, ...d.s.extraFilter] : undefined, vocab: vocab.value, threshold: d.s.prefs.threshold, picks: x.picks, seconds: x.dict.seconds || undefined })
    // v2.4 15. pont: a rövidítések felismerése az értelmezés előtt; a név és az elhagyó kifejezés a parsernek átadott szövegből kimarad
    const mres = findMacros(pipe.value.text, d.s.macros, { types: db.value.types, items: db.value.items })
    macroHits.value = mres.hits
    const ptext = mres.text
    parsed.value = analyze(ptext, db.value, { dentition: dentition.value })
    itemParse.value = analyzeItems(ptext, db.value)
    // a rövidítés tételei normál sorként jelennek meg („rövidítésből: …” jelöléssel)
    macroPairs().forEach(p => { if (!itemParse.value.done.some(q => q.tooth === p.tooth && q.typeId === p.typeId)) itemParse.value.done.push({ tooth: p.tooth, typeId: p.typeId }) })
    macroPairs().forEach(p => { if (p.tooth && !parsed.value.teeth.includes(p.tooth)) parsed.value.teeth.push(p.tooth); if (!parsed.value.types.includes(p.typeId)) parsed.value.types.push(p.typeId) })
    if (macroPairs().length) itemParse.value.doneTypes = [...new Set([...itemParse.value.doneTypes, ...macroPairs().map(p => p.typeId)])]
    const ip = itemParse.value
    // a csak javaslatként említett fog és művelet nem elvégzett kezelés (12. pont)
    if (ip.suggested.length) {
      parsed.value.teeth = parsed.value.teeth.filter(t => !ip.suggestOnlyTeeth.includes(t))
      parsed.value.types = parsed.value.types.filter(t => ip.doneTypes.includes(t))
    }
    // fogállapot-változás a diktálásból (4. pont): csak a kimondott fogakra
    dictStatus.value = analyzeStatus(ptext, db.value.settings.statusDict, dentition.value, { explicitOnly: true }).teeth
    // a csak állapotként említett fog (pl. „16-os hiányzik”) nem kezelt fog
    const doneTeeth = new Set(ip.done.map(d => d.tooth))
    const statusOnly = Object.keys(dictStatus.value).map(Number).filter(n => !doneTeeth.has(n))
    parsed.value.teeth = parsed.value.teeth.filter(t => !statusOnly.includes(t))
    // v2.5 4. pont: a tanult értelmezési szabályok („kifejezés → tétel / anyag / fogszám / mennyiség”) – az ebben a kezelésben
    // tanultak itt még nem futnak (a következő diktálástól érvényesek), a visszavontak sem
    const ruleSub: Record<number, number> = {}
    if (!x.recordId) {
      const hits = matchRules(pipe.value.text, d.s.interp, [...x.undoRules, ...(x.learnedHere || [])])
      hits.forEach(r => {
        if ((r.cat === 'mennyiség' || r.cat === 'anyag') && r.item && r.qty !== undefined && db.value.items.some(i => i.id === r.item)) { parsed.value.qty[r.item] = r.qty; confirmRow(r.item) }
        else if (r.cat === 'fogszám' && r.fromTooth && r.tooth && (parsed.value.teeth.includes(r.fromTooth) || itemParse.value.done.some(p => p.tooth === r.fromTooth))) ruleSub[r.fromTooth] = r.tooth
        else if (r.cat === 'művelet' && r.typeId && db.value.types.some(t => t.id === r.typeId)) {
          const t = r.tooth ?? null
          if (!itemParse.value.done.some(p => p.tooth === t && p.typeId === r.typeId)) itemParse.value.done.push({ tooth: t, typeId: r.typeId })
          if (!itemParse.value.doneTypes.includes(r.typeId)) itemParse.value.doneTypes.push(r.typeId)
          if (t && !parsed.value.teeth.includes(t)) parsed.value.teeth.push(t)
          if (!parsed.value.types.includes(r.typeId)) parsed.value.types.push(r.typeId)
        }
      })
      interpApplied.value = hits.filter(r => r.cat !== 'fogszám' || ruleSub[r.fromTooth!] !== undefined)
      x.seenRules = [...new Set([...(x.seenRules || []), ...interpApplied.value.map(r => r.id), ...pipe.value.steps.filter(st => st.kind === 'personal').map(st => d.s.personal.find(p => p.from === st.from && p.to === st.to)?.id).filter((v): v is string => !!v)])]
    } else interpApplied.value = []
    // ⚠ jóváhagyott fogcsere (15. pont): a diktált fogszám helyett a választott fog (a tanult fogszám-szabály is ide kerül, a választás az erősebb)
    const sub = { ...ruleSub, ...x.toothSub }
    if (Object.keys(sub).length) {
      const m = (n: number) => sub[n] ?? n
      parsed.value.teeth = [...new Set(parsed.value.teeth.map(m))].sort((a, b) => a - b)
      const sf: SurfaceMap = {}; Object.entries(parsed.value.surfaces).forEach(([n, v]) => { sf[m(Number(n))] = v }); parsed.value.surfaces = sf
      itemParse.value = { ...ip, done: ip.done.map(p => ({ ...p, tooth: p.tooth ? m(p.tooth) : p.tooth })), suggested: ip.suggested.map(p => ({ ...p, tooth: p.tooth ? m(p.tooth) : p.tooth })) }
    }
    parsed.value.teeth.forEach(t => { if (!x.rmTeeth.includes(t) && !x.teeth.includes(t)) x.teeth.push(t) })
    parsed.value.types.forEach(t => { if (!x.rmTypes.includes(t) && !x.types.includes(t)) x.types.push(t) })
    if (parsed.value.teeth.length) x.focusTooth = parsed.value.teeth[parsed.value.teeth.length - 1]!
    autoRules()
  }
  /** kézi felülbírálat: a levett fogat vagy kezelést újraértelmezéskor nem jelöli vissza */
  function toggleTooth(n: number) {
    const x = s.value; if (!x) return
    if (x.teeth.includes(n)) { if (parsed.value.teeth.includes(n)) logCorrection('fog', `levett fog: ${n}`, `${n}`); x.teeth = x.teeth.filter(t => t !== n); if (!x.rmTeeth.includes(n)) x.rmTeeth.push(n); if (x.focusTooth === n) x.focusTooth = x.teeth[0] ?? null }
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
      // v2.4 8. pont: a terv nem töltődik be az eredménybe, de a tervezett fogon diktált kezelés a tervezett felszíneket kapja, ha felszín nem hangzott el
      if (!set.size && x.planned?.surfaces[n]?.length && !(x.rmSurf[n] || []).length) x.planned.surfaces[n]!.forEach(sf => set.add(sf))
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
    const gone = items.value.find(i => i.key === key)
    if (gone && gone.origin !== 'planned') logCorrection('tetel', `törölt tétel: ${gone.tooth ?? '–'} ${db.value.types.find(t => t.id === gone.typeId)?.name || gone.typeId}`, key)
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
    const mm = macroMats.value
    const ids = new Set([...Object.keys(pkg), ...Object.keys(mm), ...Object.keys(parsed.value.qty), ...Object.keys(parsed.value.rel || {}), ...x.extra])
    const order = db.value.items.map(i => i.id)
    return [...ids].filter(id => db.value.items.some(i => i.id === id)).sort((a, b) => order.indexOf(a) - order.indexOf(b)).map(id => {
      // a diktált szám a teljes mennyiség; „még / plusz N” esetén a csomag + N
      const mq = mm[id]?.qty || 0
      const pk = (pkg[id] || 0) + mq, abs = parsed.value.qty[id], dRel = parsed.value.rel?.[id]
      const dq = abs !== undefined ? abs : dRel !== undefined ? pk + dRel : undefined
      let st: RowState
      // v2.4 15. pont: a rövidítés sora nem ⚠ (a diktált szám az összes mennyiség, a „plusz N” hozzáadódik)
      if (mq > 0) st = 'macro'
      else if (dq === undefined && pk > 0) st = 'pkg'
      else if (dq !== undefined && pk === 0) st = 'dict'
      else if (dq !== undefined && dq === pk) st = 'ok'
      else if (dq !== undefined) st = 'diff'
      else st = 'manual'
      const auto = dq !== undefined ? dq : pk > 0 ? pk : 1
      const qty = x.overrides[id] !== undefined ? x.overrides[id]! : auto
      return { id, pk, dq, dRel, st, auto, qty, manual: x.overrides[id] !== undefined && x.overrides[id] !== auto, checked: !x.unchecked.includes(id), macro: mm[id]?.macro }
    })
  })
  const rowsReview = computed(() => s.value?.recordId ? 0 : rows.value.filter(r => r.checked && (r.st === 'diff' || r.st === 'dict') && !s.value?.confirmedRows.includes(r.id)).length)
  const toReview = computed(() => rowsReview.value + pendingFlags.value.length)

  /* ---------- ⚠ jelzések: egyetlen ellenőrzés a mentés előtt (spec v2.3, 5., 9., 10., 13., 15., 17. pont) ---------- */
  const pl = (l: { tooth: number | null; typeId: string }[]): PairLite[] => l.map(p => ({ tooth: p.tooth, typeId: p.typeId }))
  const reviewC = computed<DictFlag[]>(() => {
    const x = s.value; if (!x || x.recordId) return []
    const d = dictStore()
    const plan = x.planItems
    return reviewFlags({
      text: pipe.value.text, done: pl(itemParse.value.done), planItems: pl(plan), finalItems: pl(doneItems.value),
      status: patients.latestStatus(x.patientId)?.teeth || {}, types: db.value.types, catalog: db.value.items, qty: parsed.value.qty,
      pkg: pkgForItems(db.value, doneItems.value), history: db.value.records.flatMap(r => r.materials.map(m => ({ item: m.item, qty: m.qty }))), compat: d.s.compat,
    })
  })
  const aiFlags = computed<DictFlag[]>(() => {
    const x = s.value; if (!x || x.ai.state !== 'done' || x.recordId) return []
    const out: DictFlag[] = []
    const k = (t: number | null, id: string) => `${t ?? 0}:${id}`
    const lab = (t: number | null, id: string) => `${t ? t + '-es fog – ' : ''}${db.value.types.find(v => v.id === id)?.name || id}`
    const ai = x.ai.items.filter(i => i.status === 'done'), rule = doneItems.value
    const aiSet = new Set(ai.map(i => k(i.tooth, i.typeId))), ruleSet = new Set(rule.map(i => k(i.tooth, i.typeId)))
    ai.forEach(i => { if (!ruleSet.has(k(i.tooth, i.typeId))) out.push({ key: 'ai:+' + k(i.tooth, i.typeId), kind: 'ai', title: `AI szerint: ${lab(i.tooth, i.typeId)}`, detail: 'A szabályalapú értelmezés ezt a tételt nem találta.', choices: [{ id: 'rule', label: 'Szabály szerint: nem szerepel' }, { id: 'ai', label: 'AI szerint: ' + lab(i.tooth, i.typeId) }], data: { tooth: i.tooth, typeId: i.typeId, add: true } }) })
    if (ai.length) rule.forEach(i => { if (!aiSet.has(k(i.tooth, i.typeId)) && i.origin !== 'planned') out.push({ key: 'ai:-' + k(i.tooth, i.typeId), kind: 'ai', title: `Szabály szerint: ${lab(i.tooth, i.typeId)}`, detail: 'Az AI ezt a tételt nem találta.', choices: [{ id: 'rule', label: 'Szabály szerint: ' + lab(i.tooth, i.typeId) }, { id: 'ai', label: 'AI szerint: nem szerepel' }], data: { key: i.key, add: false } }) })
    // v2.4 2. pont: anyagnál csak a jelentős eltérés kockázatos (a két érték aránya legalább 2-szeres, vagy az AI olyan anyagot ad, ami a szabály szerint nincs); a kisebb eltérés halvány jelzés
    x.ai.materials.forEach(m => {
      const r = rows.value.find(v => v.id === m.item); const it = db.value.items.find(v => v.id === m.item); if (!it || x.overrides[m.item] !== undefined) return
      if (!r || !r.checked) { out.push({ key: 'ai:m:' + m.item, kind: 'ai', title: `AI szerint: ${it.name} ${m.qty} ${it.unit}`, detail: 'A szabályalapú értelmezés ezt az anyagot nem találta.', choices: [{ id: 'rule', label: 'Szabály szerint: nem szerepel' }, { id: 'ai', label: `AI szerint: ${m.qty} ${it.unit}` }], data: { item: m.item, qty: m.qty, add: true } }); return }
      if (Math.abs(r.qty - m.qty) > 1e-9 && significantQty(r.qty, m.qty)) out.push({ key: 'ai:q:' + m.item, kind: 'ai', title: `${it.name.split(' ')[0]}: jelentősen eltérő mennyiség`, choices: [{ id: 'rule', label: `Szabály szerint: ${r.qty} ${it.unit}` }, { id: 'ai', label: `AI szerint: ${m.qty} ${it.unit}` }], data: { item: m.item, qty: m.qty } })
    })
    return out
  })
  /** v2.4 2. pont: „jelentős” mennyiségi eltérés – a két érték aránya legalább 2-szeres (később felülvizsgálandó) */
  const significantQty = (a: number, b: number) => { const lo = Math.min(a, b), hi = Math.max(a, b); return lo <= 0 ? hi > 0 : hi / lo >= 2 }
  /** v2.4 2. pont: a nem kockázatos AI-eltérés halvány jelzés a soron („AI szerint: 1 db”), egy koppintással átvehető; nem blokkol */
  const aiSoft = computed<Record<string, number>>(() => {
    const x = s.value; const out: Record<string, number> = {}
    if (!x || x.ai.state !== 'done' || x.recordId) return out
    x.ai.materials.forEach(m => { const r = rows.value.find(v => v.id === m.item); if (r && r.checked && x.overrides[m.item] === undefined && Math.abs(r.qty - m.qty) > 1e-9 && !significantQty(r.qty, m.qty)) out[m.item] = m.qty })
    return out
  })
  function takeAiSoft(item: string) {
    const x = s.value; const q = aiSoft.value[item]; if (!x || q === undefined) return
    const before = rows.value.find(r => r.id === item)?.qty
    x.overrides[item] = q; confirmRow(item)
    const d = dictStore(); d.s.aiStats.diffs++; d.s.aiStats.aiRight++
    d.addLog({ source: 'auto', kind: 'ai-halvany', raw: x.dict.live || x.text, interpreted: pipe.value.text, final: `${item}: ${before} → ${q} (AI halvány jelzés átvéve)`, recognizer: x.dict.recognizer, ai: { on: true, agree: false, picked: 'ai' } })
  }
  const flags = computed<DictFlag[]>(() => {
    const seen = new Set<string>()
    return [...pipe.value.flags, ...reviewC.value, ...aiFlags.value].filter(f => (seen.has(f.key) ? false : (seen.add(f.key), true)))
  })
  /** v2.4 2. pont 3.: a már kézzel javított érték nem kérdez újra (a felhasználó döntött) */
  const manuallyFixed = (f: DictFlag) => { const it = f.data?.item as string | undefined; return !!it && ['qty', 'life', 'ai'].includes(f.kind) && s.value?.overrides[it] !== undefined }
  const pendingFlags = computed(() => flags.value.filter(f => !s.value?.resolved[f.key] && !manuallyFixed(f)).concat(macroQuestions.value))
  /** v2.4 15. pont 5.: hiányzó fogszám a rövidítésnél – egyetlen kérdés a fogszám-választóval; kétértelmű elhagyás – rákérdezés */
  const macroQuestions = computed<DictFlag[]>(() => {
    const x = s.value; if (!x || x.recordId) return []
    const out: DictFlag[] = []
    macroHits.value.forEach(h => {
      if (h.needsTooth && !x.macroTooth[h.key]) out.push({ key: h.key + ':tooth', kind: 'macro', title: `„${h.name}” – melyik fog?`, detail: 'A rövidítés fogszámos tételt tartalmaz, de fogszám nem hangzott el.', choices: [], data: { hit: h.key, ask: 'tooth' } })
      if (h.ambiguousOmit && x.macroOmit[h.key] === undefined) out.push({ key: h.key + ':omit', kind: 'macro', title: `„${h.ambiguousOmit.phrase} nélkül” – melyik tétel maradjon ki?`, choices: h.ambiguousOmit.candidates.map(i => ({ id: String(i), label: lineName(h.lines[i]!) })), data: { hit: h.key, ask: 'omit' } })
    })
    return out
  })
  const lineName = (l: { kind: string; id: string }) => (l.kind === 'type' ? db.value.types.find(t => t.id === l.id)?.name : db.value.items.find(i => i.id === l.id)?.name) || l.id
  function flagLog(f: DictFlag, choice: string, auto = false) {
    const x = s.value; if (!x) return
    const d = dictStore(), c = f.choices.find(v => v.id === choice)
    const ai = f.kind === 'ai' ? { on: true, agree: false, picked: (choice === 'ai' ? 'ai' : 'szabaly') as 'ai' | 'szabaly' } : d.s.prefs.ai ? { on: true, agree: true } : undefined
    let pattern: string | undefined, outcome: string | undefined
    if (f.kind === 'similar') { pattern = 'sim:' + (f.data?.word as string); outcome = choice === '__none' ? undefined : choice }
    else if (f.kind === 'qty' && f.data?.pattern) { pattern = f.data.pattern as string; outcome = choice === String(f.data.qty) ? 'szam' : 'tizedes' }
    else if (f.kind === 'ambig') { pattern = 'amb:' + (f.data?.word as string); outcome = choice }
    d.addLog({ source: 'auto', kind: f.kind, pattern, outcome, raw: x.dict.live || x.text, interpreted: pipe.value.text, final: `${f.title} → ${c?.label || choice}${auto ? ' (szabály szerint)' : ''}`, live: x.dict.live || undefined, recognizer: x.dict.recognizer, ai })
    if (f.kind === 'ai') { d.s.aiStats.diffs++; if (choice === 'ai') d.s.aiStats.aiRight++; else d.s.aiStats.ruleRight++ }
  }
  function resolveFlag(f: DictFlag, choice: string, auto = false) {
    const x = s.value; if (!x) return
    switch (f.kind) {
      case 'similar': case 'ambig': {
        x.picks[f.key] = choice; x.resolved[f.key] = choice
        // v2.4 6. pont: a javítás maga a jóváhagyás – a választásból tanult szabály lesz (szakszó: a rendelő minden felhasználójára)
        if (f.kind === 'similar' && choice !== '__none' && f.data?.word) {
          const to = String(choice), cat = guessCat(to, { typeWords: db.value.types.map(t => norm(t.name).split(' ')[0]!), itemWords: db.value.items.map(i => norm(i.name).split(' ')[0]!) })
          dictStore().learn(String(f.data.word), to, { scope: 'rendelo', cat, source: 'javitas' })
        }
        applyParse(); break
      }
      case 'prebooked': {
        x.resolved[f.key] = choice
        if (choice !== 'none') {
          const n = Number(choice), unassigned = itemParse.value.done.filter(p => p.tooth === null && isBound(p.typeId)).map(p => p.typeId)
          const types = f.data?.typeId ? [f.data.typeId as string] : unassigned.length ? unassigned : x.planItems.filter(p => p.tooth === n).map(p => p.typeId)
          if (f.key.startsWith('pre:mat')) break
          types.forEach(t => addItem(n, t))
          if (!types.length && !x.teeth.includes(n)) toggleTooth(n)
        }
        break
      }
      case 'chart': {
        x.resolved[f.key] = choice; const n = Number(f.data?.tooth), m = Number(choice)
        if (m !== n) {
          // v2.5 4. pont: a ⚠ sorban választott fog szabály lesz (a fogszámot említő mondatrészből)
          const phrase = clauseWithTooth(pipe.value.text, n)
          if (phrase && m) learnInterp({ phrase, cat: 'fogszám', fromTooth: n, tooth: m, from: phrase, to: `${m}-es fog (nem ${n})` })
          swapTooth(n, m)
        }
        break
      }
      case 'qty': case 'life': { x.resolved[f.key] = choice; const it = f.data?.item as string; if (choice !== 'ok' && it) { x.overrides[it] = Number(choice); confirmRow(it); if (!auto) learnQty(it, Number(choice)) } else if (it) confirmRow(it); break }
      case 'ai': {
        x.resolved[f.key] = choice
        if (choice === 'ai') {
          if (f.data?.item) { if (f.data.add) addMaterial(f.data.item as string, false); x.overrides[f.data.item as string] = Number(f.data.qty); confirmRow(f.data.item as string); learnQty(f.data.item as string, Number(f.data.qty), f.data.add ? 'anyag' : 'mennyiség') }
          else if (f.data?.add) {
            addItem((f.data.tooth as number | null), f.data.typeId as string)
            // v2.5 4. pont: a ⚠ sorban választott művelet szabály lesz, ha a mondatrész a fogat is megnevezi
            const tooth = f.data.tooth as number | null, typeId = f.data.typeId as string, phrase = tooth ? clauseWithTooth(pipe.value.text, tooth) : null
            if (phrase) learnInterp({ phrase, cat: 'művelet', tooth, typeId, from: phrase, to: `${tooth}-es fog – ${db.value.types.find(t => t.id === typeId)?.name || typeId}` })
          }
          else if (f.data?.key) removeItem(f.data.key as string)
        }
        break
      }
      default: x.resolved[f.key] = choice
    }
    flagLog(f, choice, auto)
  }
  /** a megerősített mennyiségi szabály (5. pont): az adott mintára már nem kérdez rá */
  function autoRules() {
    const x = s.value; if (!x || x.recordId) return
    const rules = dictStore().s.qtyRules; if (!rules.length) return
    reviewC.value.filter(f => f.kind === 'qty' && f.data?.pattern && !x.resolved[f.key]).forEach(f => {
      const r = rules.find(v => v.pattern === f.data!.pattern); if (!r) return
      resolveFlag(f, r.outcome === 'szam' ? String(f.data!.qty) : String(f.data!.alt), true)
    })
  }
  /** a fogtérképpel ellenőrzött / ⚠ választással javított fogszám cseréje (kézi felvitelre is) */
  function swapTooth(n: number, m: number) {
    const x = s.value; if (!x || n === m) return
    x.teeth = x.teeth.filter(t => t !== n); if (!x.rmTeeth.includes(n)) x.rmTeeth.push(n)
    if (!x.teeth.includes(m)) x.teeth.push(m)
    x.rmTeeth = x.rmTeeth.filter(t => t !== m)
    if (x.assign[n]) { x.assign[m] = [...new Set([...(x.assign[m] || []), ...x.assign[n]!])]; delete x.assign[n] }
    x.planItems = x.planItems.map(p => (p.tooth === n ? { ...p, tooth: m } : p))
    if (x.manualSurf[n]) { x.manualSurf[m] = [...new Set([...(x.manualSurf[m] || []), ...x.manualSurf[n]!])]; delete x.manualSurf[n] }
    x.toothSub[n] = m; x.focusTooth = m
    applyParse()
  }
  /** kézi javítás naplózása a diktálás után (5. pont, 3.a alpont) */
  function logCorrection(kind: string, final: string, interpreted: string) {
    const x = s.value; if (!x || !x.text.trim() || x.recordId) return
    dictStore().addLog({ source: 'auto', kind, raw: x.dict.live || x.text, interpreted, final, live: x.dict.live || undefined, recognizer: x.dict.recognizer })
  }
  /** a Whisper szakszó-listája: előjegyzett tételek → kezelések és anyagok → szótár → tanult kifejezések */
  const promptText = (style?: PromptStyle) => buildPrompt({ plannedTypes: [...new Set([...(s.value?.planItems.map(p => p.typeId) || []), ...(s.value?.types || [])])], types: db.value.types, items: db.value.items, learned: dictStore().s.personal.filter(p => p.active).map(p => p.to), macros: dictStore().s.macros.filter(m => m.active).map(m => m.name), style: style || dictStore().eff.promptStyle })
  /** AI-értelmezés (17. pont, csak a demóban kapcsolóval): a szabályalapú mellett fut, az eltérés ⚠ */
  async function runAi() {
    const x = s.value, d = dictStore(); if (!x || !d.s.prefs.ai || !x.text.trim() || x.recordId || typeof navigator === 'undefined' || !navigator.onLine) return
    x.ai = { state: 'run', model: '', items: [], materials: [], error: '' }
    const ac = new AbortController(), to = setTimeout(() => ac.abort(), 10000)
    try {
      const chart = patients.latestStatus(x.patientId)?.teeth || {}
      const r = await fetch('/api/diktalas/ertelmezes', { method: 'POST', signal: ac.signal, headers: { 'content-type': 'application/json', 'x-molio-device': d.s.deviceId },
        body: JSON.stringify({ text: pipe.value.cleaned, types: db.value.types.map(t => ({ id: t.id, name: t.name })), items: db.value.items.map(i => ({ id: i.id, name: i.name, unit: i.unit })), planned: x.planItems.map(p => ({ tooth: p.tooth, typeId: p.typeId })), chart: Object.fromEntries(x.planItems.filter(p => p.tooth).map(p => [p.tooth, chart[p.tooth!] || []])) }) })
      const j = await r.json().catch(() => null) as { ok?: boolean; model?: string; result?: { items?: any[]; materials?: any[] }; exhausted?: boolean; leftPct?: number | null } | null
      if (j?.leftPct !== undefined) d.aiInfo.leftPct = j.leftPct
      // v2.4 19. pont 3.: a keret elfogyásakor magától kikapcsol és szavakkal jelez
      if (j?.exhausted) { d.aiInfo.exhausted = true; d.s.prefs.ai = false; d.aiInfo.note = 'Az AI-értelmezés most ki van kapcsolva – a keret elfogyott' }
      if (!r.ok || !j?.ok || !j.result) { x.ai = { state: 'err', model: '', items: [], materials: [], error: j?.exhausted ? 'a mai AI-keret elfogyott' : 'az AI-értelmezés nem érhető el' }; return }
      const okType = (id: string) => db.value.types.some(t => t.id === id), okItem = (id: string) => db.value.items.some(i => i.id === id)
      const items = (j.result.items || []).filter(i => i && okType(i.typeId)).map(i => ({ tooth: Number.isInteger(i.tooth) && allTeeth('permanent').concat(allTeeth('primary')).includes(i.tooth) ? i.tooth : null, typeId: String(i.typeId), status: i.status === 'suggested' ? 'suggested' : 'done' }))
      const materials = (j.result.materials || []).filter(m => m && okItem(m.item) && Number(m.qty) > 0).map(m => ({ item: String(m.item), qty: Number(m.qty) }))
      x.ai = { state: 'done', model: j.model || '', items, materials, error: '' }
      d.s.aiStats.runs++
    } catch { x.ai = { state: 'err', model: '', items: [], materials: [], error: 'az AI-értelmezés nem érhető el' } } finally { clearTimeout(to) }
  }
  const confirmRow = (id: string) => { const x = s.value; if (x && !x.confirmedRows.includes(id)) x.confirmedRows.push(id) }
  function setChecked(id: string, on: boolean) { const x = s.value; if (!x) return; x.unchecked = on ? x.unchecked.filter(v => v !== id) : [...x.unchecked, id] }
  function setQty(id: string, v: number) {
    if (!s.value) return
    const before = rows.value.find(r => r.id === id)?.qty
    s.value.overrides[id] = Math.max(0, Number(v) || 0); confirmRow(id)
    if (before !== undefined && before !== s.value.overrides[id]) { logCorrection('mennyiseg', `${db.value.items.find(i => i.id === id)?.name || id}: ${before} → ${s.value.overrides[id]}`, `${before}`); learnQty(id, s.value.overrides[id]!) }
  }
  function resetQty(id: string) { if (s.value) delete s.value.overrides[id] }
  function addMaterial(id: string, learnIt = true) {
    const x = s.value; if (!x) return; if (!x.extra.includes(id)) x.extra.push(id); setChecked(id, true); if (x.overrides[id] === undefined) x.overrides[id] = 1
    // v2.5 4. pont: ha a szövegben ismeretlen szó maradt, és az orvos kézzel adja hozzá az anyagot, a kifejezésből szabály lesz („kérek öt tampont” → Vattatampon)
    if (learnIt && pipe.value.unknown.length && !x.recordId && x.text.trim()) {
      const phrase = clauseWithWord(pipe.value.text, pipe.value.unknown), it = itemOf(id)
      if (phrase && it) { const r = learnInterp({ phrase, cat: 'anyag', item: id, qty: x.overrides[id]!, from: phrase, to: `${it.name} ${x.overrides[id]} ${it.unit}` }); if (r) x.interpItem = { ...(x.interpItem || {}), [id]: r.id } }
    }
  }

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
    if (rowsReview.value) return { error: `${rowsReview.value} ⚠ jelölésű anyagsort meg kell erősíteni (Megerősítem, vagy módosítsd a mennyiséget), mielőtt a kezelés véglegesíthető.` }
    if (pendingFlags.value.length) return { error: `${pendingFlags.value.length} ⚠ ellenőrzés vár megerősítésre a diktálás ellenőrzésében (válassz, vagy „Rendben”), mielőtt a kezelés véglegesíthető.` }
    const mats = rows.value.filter(r => r.checked && r.qty > 0).map(r => ({ item: r.id, qty: r.qty }))
    const before: Record<string, number> = {}; db.value.items.forEach(i => { before[i.id] = i.stock })
    const done = doneItems.value
    const typeIds = [...new Set(done.map(i => i.typeId))]
    const teeth = [...new Set(done.map(i => i.tooth).filter((n): n is number => !!n))].sort((a, b) => a - b)
    const surf: SurfaceMap = {}; teeth.forEach(n => { if (surfaces.value[n]?.length) surf[n] = [...surfaces.value[n]!] })
    const tn = typeNames(db.value, typeIds)
    let infoQueued = false
    // v2.4 8. pont: a „Nem történt meg” jelölés a kezelés rögzítését nem módosítja; a megjegyzés a következő alkalom „következő lépése”
    const notDone = Object.entries(x.notDone).map(([k, note]) => { const [t, typeId] = k.split(':'); return { tooth: Number(t) || null, typeId: typeId!, note } })
    const common = { notDone: notDone.length ? notDone : undefined, doctorId: x.doctorId, typeIds, teeth, surfaces: surf, items: items.value.map(i => ({ id: uid(), tooth: i.tooth, typeId: i.typeId, surfaces: i.surfaces, origin: i.origin, state: i.state as 'done' | 'postponed', fee: i.fee })) as VisitItem[], planned: x.planned, extended: extendedTeeth.value.length > 0, text: x.text.trim(), fee: fee.value, sterBatch: x.sterBatch }
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
      const full = { ...rec, patientInfo: { text: patientInfoDraft(db.value, rec), status: 'draft' as const } }
      db.value.records.push(full)
      // v2.4 10. pont: jóváhagyási feladat csak akkor keletkezik, ha a páciens e-mailes értesítést kér
      infoQueued = queueInfo(db.value, db.value.records[db.value.records.length - 1]!)
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
    // v2.4 6. pont: a tanult szabályok használata (mérhetőség); v2.4 15. pont: rövidítések használata, frissítési javaslat, ajánlás
    const d = dictStore()
    // v2.5 4. pont 4.: mérés – hányszor futott le egy tanult szabály, és hányszor kellett utána mégis javítani (visszavonás, eltérő kézi mennyiség)
    const seen = x.seenRules || []
    let ran = 0, fixedAfter = 0
    seen.forEach(id => {
      const pr = d.s.personal.find(p => p.id === id), ir = d.s.interp.find(r => r.id === id)
      const r = pr || ir; if (!r) return
      r.uses = (r.uses || 0) + 1; ran++
      const undone = x.undoRules.includes(id)
      const overridden = !!ir && !!ir.item && ir.qty !== undefined && x.overrides[ir.item] !== undefined && x.overrides[ir.item] !== ir.qty
      if (undone || overridden) { (r as { corrected?: number }).corrected = ((r as { corrected?: number }).corrected || 0) + 1; fixedAfter++ }
    })
    if (ran) d.addLog({ source: 'auto', kind: 'tanult-szabaly', raw: '', interpreted: seen.map(id => d.s.personal.find(p => p.id === id)?.from || d.s.interp.find(r => r.id === id)?.from || id).join(' | '), final: `tanult szabály lefutott: ${ran}; utólag javítva: ${fixedAfter}`, recognizer: x.dict.recognizer })
    // v2.5 4. pont 6.: a központi mentés kötegelve, a diktálás mentésekor (a napi írási korlát elfogyásakor csendben kimarad, később újrapróbálja)
    void d.syncLearn()
    const macroNotes: { kind: 'update' | 'recommend'; text: string; data: unknown }[] = []
    macroHits.value.forEach(h => {
      const m = d.s.macros.find(v => v.id === h.macroId); if (!m) return
      m.uses = (m.uses || 0) + 1; m.lastUsed = new Date().toISOString()
      // v2.4 15. pont 11.: a rövidítés használata a javítási naplóba kerül (lefutott; módosítani kellett-e)
      const changed = m.lines.filter(l => l.kind === 'mat' && x.overrides[l.id] !== undefined && x.overrides[l.id] !== (l.qty || 1)).map(l => l.id)
      d.addLog({ source: 'auto', kind: 'rovidites', raw: '', interpreted: m.name, final: `rövidítés lefutott: ${m.name}${changed.length ? ' – módosítva: ' + changed.join(', ') : ''}`, recognizer: x.dict.recognizer })
      m.lines.filter(l => l.kind === 'mat').forEach(l => {
        const o = x.overrides[l.id]; if (o === undefined || o === (l.qty || 1)) return
        const k = `${l.id}:${o}`; m.mods = { ...(m.mods || {}), [k]: (m.mods?.[k] || 0) + 1 }
        if (m.mods[k]! >= 3) macroNotes.push({ kind: 'update', text: `A(z) „${m.name}” rövidítésben a(z) ${lineName(l)} mennyiségét már ${m.mods[k]}× ugyanígy módosítottad (${o}). Frissítsem az alapértéket?`, data: { macroId: m.id, item: l.id, qty: o } })
      })
    })
    const sig = comboSig(typeIds, mats.map(m => m.item))
    if (typeIds.length + mats.length >= 2 && !macroHits.value.length) {
      d.s.combos.push({ sig, at: new Date().toISOString() }); if (d.s.combos.length > 400) d.s.combos.splice(0, d.s.combos.length - 400)
      if (shouldRecommend(d.s.combos, sig, d.s.macros, d.s.dismissedCombos)) macroNotes.push({ kind: 'recommend', text: 'Gyakran diktálod ezt a csoportot – rövidítést készítsek belőle?', data: { sig, typeIds, mats: mats.map(m => ({ item: m.item, qty: m.qty })) } })
    }
    const nSug = suggestList.value.length
    const pid = x.patientId
    s.value = null
    return { warns, statusOffer, patientId: pid, recordId: recId, hasInfo: !x.recordId && !infoQueued, infoQueued, statusChanged: chg.length, suggested: nSug, macroNotes }
  }

  /* ---------- fogazati státusz felvétele diktálással (2.2.6) ---------- */
  function setMode(m: 'treat' | 'status') { if (s.value) s.value.mode = m }
  function setStatusText(v: string, delay = 250) {
    if (!s.value) return
    s.value.statusText = v
    if (sTimer) clearTimeout(sTimer)
    sTimer = setTimeout(() => { statusParsed.value = analyzeStatus(preprocess(s.value?.statusText || '', { personal: dictStore().s.personal }).text, db.value.settings.statusDict, dentition.value) }, delay)
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
  /* ---------- v2.4 8. pont: a tervezett tételek jelölése (elvégezve / még nincs rögzítve / nem történt meg) ---------- */
  const planMarksNow = computed(() => (s.value ? planMarks(db.value, s.value.planItems, doneItems.value, s.value.notDone) : []))
  function setNotDone(key: string, note: string | null) { const x = s.value; if (!x) return; if (note === null) delete x.notDone[key]; else x.notDone[key] = note }
  /** v2.4 6. pont: a „Nem ezt mondtam” javításából automatikusan szabály (a javítás maga a jóváhagyás) */
  function learnFromCorrection(orig: string, fixed: string): { n: number; conflicts: string[] } {
    const d = dictStore(), conflicts: string[] = []
    let n = 0
    correctionPairs(orig, fixed).forEach(([a, b]) => {
      // v2.5 4. pont 4.: ha a javított szó egy most lefutott tanult szabály eredménye, a szabály „utólag javítva” számlálója nő
      const hit = d.s.personal.find(p => (s.value?.seenRules || []).includes(p.id) && norm(p.to) === norm(a))
      if (hit) hit.corrected = (hit.corrected || 0) + 1
      const cat = guessCat(b, { typeWords: db.value.types.map(t => norm(t.name).split(' ')[0]!), itemWords: db.value.items.map(i => norm(i.name).split(' ')[0]!) })
      const r = d.learn(a, b, { scope: scopeOf(cat), cat, source: 'javitas' })
      if (r) { n++; if (r.conflict) conflicts.push(`„${a}”: korábban „${r.conflict}”, most „${b}”`) }
    })
    return { n, conflicts }
  }

  return {
    s, parsed, statusParsed, patient, dentition, active,
    startFromAppointment, startFromSuggestion, startNew, editRecord, setText, applyParse, toggleTooth, focus, toggleType,
    items, doneItems, itemTotal, setItemState, removeItem, addItem, itemParse, suggestList, addSuggestion, removeSuggestion, setSuggestion, statusChanges, setStatusChange, sideConflicts, confirmConflict, dictStatus,
    surfaces, toggleSurface, needsSurface, missingSurface, extendedTeeth, offDentition,
    rows, toReview, rowsReview, flags, pendingFlags, resolveFlag, swapTooth, pipe, promptText, runAi, setChecked, setQty, resetQty, addMaterial, fee, lotPreview, cost, consents,
    attachments, upload, cancel, hasUnsaved, approve, finishDictation, confirmRow, saveDraft, restored, draftOf, dropDraft,
    setMode, setStatusText, statusDraft, setToothStatus, statusConflicts, approveStatus, discardStatus, isDoneAppt,
    // v2.4
    aiSoft, takeAiSoft, macroHits, macroOf, macroQuestions, lineOmitted, lineName, setMacroTooth, setMacroOmit, restoreMacroLine, learnedApplied, interpApplied, undoLearned, planMarksNow, setNotDone, learnFromCorrection,
  }
})
