// A diktálás eszközönkénti (demó) adatai: beállítások, személyes javítások, javítási napló, ismeretlen kifejezések, betanítás eredménye
// (spec v2.3, 3., 5., 7., 13., 17. pont). Böngészőben (localStorage) tárolódik, hangfelvétel nem. A végleges változatban felhasználóhoz kötött, adatbázisban.
import { defineStore } from 'pinia'
import { DEFAULT_COMPAT } from '~/utils/dict/review'
import type { PersonalRule } from '~/utils/dict/pipeline'
import type { ThresholdKey } from '~/utils/dict/similar'
import { buildInfo, APP_VERSION, SPEC, DEV_TOOLS, BRANCH_TAG } from '~/utils/meta'
import type { PromptStyle } from '~/utils/dict/prompt'
import type { ResampleMode } from '~/utils/dict/audio'
import type { Macro } from '~/utils/dict/macro'
import { looksPersonal } from '~/utils/dict/learn'

export type Recognizer = 'whisper' | 'browser'
export interface DictPrefs {
  recognizer: Recognizer; livePreview: boolean; noise: boolean; ai: boolean; threshold: ThresholdKey; sugMinCount: number; sugMinRatio: number
  /** v2.4 12. pont C): a szakszó-szöveg formája, az átalakítás módja, a beszédészlelés (a main ágon rögzített, a teszt ágon a laborban állítható) */
  promptStyle: PromptStyle; resample: ResampleMode; vad: boolean
}
/** v2.4 12. pont B): a main ágon a fogorvos semmit nem állít a felismerésen – a teszt ágon legjobbnak mért, rögzített beállítás (csak kiadással változik) */
export const FIXED_PREFS: Omit<DictPrefs, 'ai' | 'sugMinCount' | 'sugMinRatio'> = { recognizer: 'whisper', livePreview: true, noise: true, threshold: 'medium', promptStyle: 'mondat', resample: 'uj', vad: true }
export interface UnknownTerm { term: string; count: number; first: string; last: string; example: string }
export interface LogEntry {
  id: string; at: string
  /** automatikus (kézi javítás / ⚠ választás) vagy kifejezett jelzés („Nem ezt mondtam”) */
  source: 'auto' | 'jelzes'
  kind: string
  /** a mintázat azonosítója az ismétlődés-számláláshoz (5. pont, 4. alpont) */
  pattern?: string
  outcome?: string
  raw: string; interpreted: string; final: string
  live?: string
  recognizer: string; noise: boolean; ai?: { on: boolean; agree?: boolean; picked?: 'szabaly' | 'ai' }
  wrong?: 'rosszul-hallotta' | 'rosszul-ertelmezte'
  note?: string
  device: string; version: string; spec: string; branch: string
}
export interface TrainResult { id: string; at: string; recognizer: string; noise: boolean; total: number; byCat: Record<string, number>; wrong: { said: string; heard: string; cat: string }[] }
export interface QtyRule { pattern: string; outcome: string; label: string }

const KEY = 'molio-dict-v23'
const defaults = () => ({
  deviceId: Math.random().toString(36).slice(2) + Date.now().toString(36),
  // v2.4 19/2: az AI-értelmezés a demóban is alapból bekapcsolt (a keret elfogyásakor magától kikapcsol)
  prefs: { recognizer: 'whisper', livePreview: true, noise: true, ai: true, threshold: 'medium', sugMinCount: 5, sugMinRatio: 0.8, promptStyle: 'mondat', resample: 'uj', vad: true } as DictPrefs,
  /** v2.4: egyszeri átállás (az AI alapból bekapcsolva) megtörtént-e */
  v24: false,
  /** v2.4 15. pont: személyes rövidítések (makrók) */
  macros: [] as Macro[],
  /** v2.4 15. pont: a mentett tételkombinációk (az ajánláshoz), az elvetett ajánlások */
  combos: [] as { sig: string; at: string }[],
  dismissedCombos: [] as string[],
  /** v2.4 6. pont: a központi mentésre váró tanult javítások / rövidítések, és a központból utoljára letöltött állapot ideje */
  learnQueue: [] as { kind: 'rule' | 'macro'; data: unknown }[],
  learnSyncedAt: '',
  personal: [] as PersonalRule[],
  qtyRules: [] as QtyRule[],
  extraFilter: [] as string[],
  unknown: [] as UnknownTerm[],
  log: [] as LogEntry[],
  queue: [] as LogEntry[],
  training: [] as TrainResult[],
  compat: JSON.parse(JSON.stringify(DEFAULT_COMPAT)) as Record<string, string[]>,
  skipped: false,
  remindN: 0,
  aiStats: { runs: 0, diffs: 0, aiRight: 0, ruleRight: 0 },
  dismissedSug: [] as string[],
})
export type DictState = ReturnType<typeof defaults>
const load = (): DictState => {
  try {
    const j = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (j) {
      const d = defaults(); const out = { ...d, ...j, prefs: { ...d.prefs, ...j.prefs }, aiStats: { ...d.aiStats, ...j.aiStats } } as DictState
      // v2.4 19/2: az AI-értelmezés egyszer bekapcsolódik (a korábbi „alapból kikapcsolt” állapot helyett); utána a felhasználó döntése marad
      if (!j.v24) { out.prefs.ai = true; out.v24 = true }
      return out
    }
  } catch { /* alapértékek */ }
  return defaults()
}
/** az anonimizált tárolóba csak szakmai tartalom megy: hosszú számsorok (TAJ, telefon) kimaradnak */
export const scrub = (s: string) => (s || '').replace(/\d[\d\s-]{6,}\d/g, '#').slice(0, 800)

export const useDictStore = defineStore('dict', () => {
  const s = reactive<DictState>(defaults())
  const ready = ref(false)
  /** az AI-értelmezés keretének becslése (a Workerből; a hívás után frissül) */
  const aiInfo = reactive<{ leftPct: number | null; model: string; exhausted: boolean; note: string }>({ leftPct: null, model: '', exhausted: false, note: '' })
  let timer: ReturnType<typeof setTimeout> | null = null
  function init() {
    if (ready.value || typeof localStorage === 'undefined') return
    Object.assign(s, load()); ready.value = true
    watch(s, () => { if (timer) clearTimeout(timer); timer = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* tele a tároló */ } }, 300) }, { deep: true })
    window.addEventListener('online', () => { void flush(); void syncLearn() })
    void flush(); void syncLearn(); void pullLearn()
  }
  /** a ténylegesen használt beállítás: a main ágon a rögzített (FIXED_PREFS), a teszt ágon a felhasználói / labor beállítás */
  const eff = computed<DictPrefs>(() => (DEV_TOOLS ? s.prefs : { ...s.prefs, ...FIXED_PREFS }))
  const trained = computed(() => s.training.length > 0)
  const lastTrain = computed(() => s.training[s.training.length - 1] || null)
  const activePersonal = computed(() => s.personal.filter(p => p.active))
  const filterList = computed(() => s.extraFilter)

  /* ---------- személyes javítások ---------- */
  function addPersonal(from: string, to: string, source: PersonalRule['source'] = 'kezi', recognizer?: string) {
    const f = from.trim(), t = to.trim(); if (!f || !t) return null
    const ex = s.personal.find(p => p.from.toLowerCase() === f.toLowerCase()); if (ex) { ex.to = t; ex.active = true; return ex }
    const r: PersonalRule = { id: 'p' + Math.random().toString(36).slice(2, 9), from: f, to: t, active: true, source, recognizer, created: new Date().toISOString() }
    s.personal.push(r); return r
  }
  const removePersonal = (id: string) => { s.personal = s.personal.filter(p => p.id !== id) }

  /* ---------- v2.4 6. pont: öntanulás – a javítás maga a jóváhagyás; központi mentés ágak szerint ---------- */
  /** tanult szabály a kézi javításból: kiejtési (a beszélőre) vagy szakmai (a rendelő minden felhasználójára); azonnal érvényes */
  function learn(from: string, to: string, o: { scope: 'szemely' | 'rendelo'; cat: string; source?: PersonalRule['source'] }) {
    const f = from.trim(), t = to.trim()
    if (!f || !t || f.toLowerCase() === t.toLowerCase() || looksPersonal(f) || looksPersonal(t)) return null
    const ex = s.personal.find(p => p.from.toLowerCase() === f.toLowerCase())
    // ellentmondó javításnál a legutóbbi érvényes, és a program jelzi az ütközést
    const conflict = !!ex && ex.to.toLowerCase() !== t.toLowerCase() ? ex.to : null
    const r = addPersonal(f, t, o.source || 'javitas', s.prefs.recognizer)
    if (!r) return null
    Object.assign(r, { scope: o.scope, cat: o.cat, branch: BRANCH_TAG(), uses: r.uses || 0, applied: r.applied || 0 })
    s.learnQueue.push({ kind: 'rule', data: { from: r.from, to: r.to, scope: o.scope, cat: o.cat, at: new Date().toISOString() } })
    void syncLearn()
    return { rule: r, conflict }
  }
  let syncing = false
  /** a központi mentés kötegben (egy írás); hálózati hiba esetén az eszközön várakozik */
  async function syncLearn() {
    if (syncing || !s.learnQueue.length || typeof navigator === 'undefined' || !navigator.onLine) return
    syncing = true
    const batch = s.learnQueue.slice(0, 60)
    try {
      const r = await fetch('/api/diktalas/tanult-javitas', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ device: s.deviceId, speaker: 'demo', rules: batch.filter(b => b.kind === 'rule').map(b => b.data), macros: batch.filter(b => b.kind === 'macro').map(b => b.data) }) })
      if (r.ok) { const j = await r.json().catch(() => ({})) as { stored?: boolean }; if (j.stored !== false) s.learnQueue.splice(0, batch.length) }
    } catch { /* később újra */ } finally { syncing = false }
  }
  /** a központilag mentett javítások letöltése (eszközcsere, böngészőtörlés után is megmaradnak); naponta legfeljebb egyszer */
  async function pullLearn(force = false) {
    if (typeof navigator === 'undefined' || !navigator.onLine) return null
    if (!force && s.learnSyncedAt && Date.now() - Date.parse(s.learnSyncedAt) < 6 * 3600000) return null
    try {
      const r = await fetch('/api/diktalas/tanult-javitas'); if (!r.ok) return null
      const j = await r.json() as { batches?: { branch: string; rules?: { from: string; to: string; scope?: string; cat?: string }[]; macros?: Macro[] }[] }
      let n = 0
      ;(j.batches || []).forEach(b => {
        ;(b.rules || []).forEach(x => { if (x?.from && x?.to && !s.personal.some(p => p.from.toLowerCase() === x.from.toLowerCase())) { const p = addPersonal(x.from, x.to, 'kozponti'); if (p) { Object.assign(p, { scope: x.scope || 'rendelo', cat: x.cat || 'egyéb', branch: b.branch }); n++ } } })
        ;(b.macros || []).forEach(m => { if (m?.id && m.name && !s.macros.some(x => x.id === m.id)) { s.macros.push({ ...m, branch: b.branch }); n++ } })
      })
      s.learnSyncedAt = new Date().toISOString()
      return { n, raw: j }
    } catch { return null }
  }

  /* ---------- ismeretlen kifejezések (4. pont) ---------- */
  function noteUnknown(terms: string[], example: string) {
    const now = new Date().toISOString()
    terms.forEach(t => {
      const u = s.unknown.find(x => x.term === t)
      if (u) { u.count++; u.last = now } else s.unknown.push({ term: t, count: 1, first: now, last: now, example: scrub(example).slice(0, 160) })
    })
  }
  const dropUnknown = (term: string) => { s.unknown = s.unknown.filter(u => u.term !== term) }

  /* ---------- javítási napló (5. pont) ---------- */
  function meta() {
    const b = buildInfo()
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
    const dev = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : 'egyéb'
    const br = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /Firefox\//.test(ua) ? 'Firefox' : 'egyéb'
    return { device: `${dev} – ${br}`, version: 'v' + APP_VERSION.replace(/\.0$/, ''), spec: SPEC.version, branch: b.branch || 'fejlesztői' }
  }
  function addLog(e: Omit<LogEntry, 'id' | 'at' | 'device' | 'version' | 'spec' | 'branch' | 'recognizer' | 'noise'> & Partial<Pick<LogEntry, 'recognizer' | 'noise'>>) {
    const full: LogEntry = { id: 'l' + Math.random().toString(36).slice(2, 10), at: new Date().toISOString(), recognizer: s.prefs.recognizer, noise: s.prefs.noise, ...meta(), ...e, raw: scrub(e.raw), interpreted: scrub(e.interpreted), final: scrub(e.final), live: e.live ? scrub(e.live) : undefined, note: e.note ? scrub(e.note) : undefined }
    s.log.push(full); if (s.log.length > 800) s.log.splice(0, s.log.length - 800)
    s.queue.push(full); if (s.queue.length > 300) s.queue.splice(0, s.queue.length - 300)
    void flush()
    return full
  }
  let flushing = false
  /** a központi gyűjtés (Worker → Cloudflare-tároló); hálózati hiba esetén a bejegyzések az eszközön várakoznak */
  async function flush() {
    if (flushing || !s.queue.length || typeof navigator === 'undefined' || !navigator.onLine) return
    flushing = true
    const batch = s.queue.slice(0, 20)
    try {
      const r = await fetch('/api/diktalas/naplo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ device: s.deviceId, entries: batch.map(e => ({ ...e })) }) })
      if (r.ok) { const j = await r.json().catch(() => ({})) as { stored?: boolean }; if (j.stored !== false) s.queue.splice(0, batch.length) }
    } catch { /* később újra */ } finally { flushing = false }
  }

  /** ismétlődés → szabályjavaslat: legalább N eset, ebből legalább R arányban azonos kimenet (alapértelmezés 5 és 80%) */
  const suggestions = computed(() => {
    const g = new Map<string, Map<string, number>>()
    s.log.filter(l => l.pattern && l.outcome).forEach(l => { const m = g.get(l.pattern!) || new Map<string, number>(); m.set(l.outcome!, (m.get(l.outcome!) || 0) + 1); g.set(l.pattern!, m) })
    const out: { pattern: string; outcome: string; n: number; total: number; ratio: number; kind: string; label: string }[] = []
    g.forEach((m, pattern) => {
      const total = [...m.values()].reduce((a, b) => a + b, 0)
      const [outcome, n] = [...m.entries()].sort((a, b) => b[1] - a[1])[0]!
      const ratio = n / total
      if (total >= s.prefs.sugMinCount && ratio >= s.prefs.sugMinRatio && !s.dismissedSug.includes(pattern + '→' + outcome)) {
        const kind = pattern.split(':')[0]!
        const label = kind === 'sim' || kind === 'txt' ? `„${pattern.split(':').slice(1).join(':')}” → „${outcome}”` : kind === 'qty' ? `„${pattern.split(':')[3] || pattern}” → ${outcome}` : `${pattern} → ${outcome}`
        out.push({ pattern, outcome, n, total, ratio, kind, label })
      }
    })
    return out
  })
  function acceptSuggestion(x: { pattern: string; outcome: string; kind: string; label: string }) {
    const [kind, ...rest] = x.pattern.split(':')
    if (kind === 'sim' || kind === 'txt') addPersonal(rest.join(':'), x.outcome, 'tanult', s.prefs.recognizer)
    else if (kind === 'qty') s.qtyRules.push({ pattern: x.pattern, outcome: x.outcome, label: x.label })
    dismissSuggestion(x)
  }
  const dismissSuggestion = (x: { pattern: string; outcome: string }) => { s.dismissedSug.push(x.pattern + '→' + x.outcome) }
  /** a javítási arány kategóriánként (9. alpont) */
  const rates = computed(() => {
    const m: Record<string, number> = {}
    s.log.forEach(l => { m[l.kind] = (m[l.kind] || 0) + 1 })
    return m
  })

  /* ---------- betanítás ---------- */
  const addTraining = (r: Omit<TrainResult, 'id' | 'at'>) => { s.training.push({ id: 't' + Date.now().toString(36), at: new Date().toISOString(), ...r }); s.skipped = false }
  /** első diktáláskor ajánlás; amíg nincs betanítás, időnként (nem minden diktálásnál) emlékeztet */
  function shouldOffer(): boolean {
    if (trained.value) return false
    s.remindN++
    return s.remindN === 1 || s.remindN % 5 === 0
  }
  return { s, ready, aiInfo, init, eff, learn, syncLearn, pullLearn, trained, lastTrain, activePersonal, filterList, addPersonal, removePersonal, noteUnknown, dropUnknown, addLog, flush, suggestions, acceptSuggestion, dismissSuggestion, rates, addTraining, shouldOffer }
})
