// A diktálás eszközönkénti (demó) adatai: beállítások, személyes javítások, javítási napló, ismeretlen kifejezések, betanítás eredménye
// (spec v2.3, 3., 5., 7., 13., 17. pont). Böngészőben (localStorage) tárolódik, hangfelvétel nem. A végleges változatban felhasználóhoz kötött, adatbázisban.
import { defineStore } from 'pinia'
import { DEFAULT_COMPAT } from '~/utils/dict/review'
import type { PersonalRule } from '~/utils/dict/pipeline'
import type { ThresholdKey } from '~/utils/dict/similar'
import { buildInfo, APP_VERSION, SPEC } from '~/utils/meta'

export type Recognizer = 'whisper' | 'browser'
export interface DictPrefs { recognizer: Recognizer; livePreview: boolean; noise: boolean; ai: boolean; threshold: ThresholdKey; sugMinCount: number; sugMinRatio: number }
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
  prefs: { recognizer: 'whisper', livePreview: true, noise: true, ai: false, threshold: 'medium', sugMinCount: 5, sugMinRatio: 0.8 } as DictPrefs,
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
  try { const j = JSON.parse(localStorage.getItem(KEY) || 'null'); if (j) { const d = defaults(); return { ...d, ...j, prefs: { ...d.prefs, ...j.prefs }, aiStats: { ...d.aiStats, ...j.aiStats } } } } catch { /* alapértékek */ }
  return defaults()
}
/** az anonimizált tárolóba csak szakmai tartalom megy: hosszú számsorok (TAJ, telefon) kimaradnak */
export const scrub = (s: string) => (s || '').replace(/\d[\d\s-]{6,}\d/g, '#').slice(0, 800)

export const useDictStore = defineStore('dict', () => {
  const s = reactive<DictState>(defaults())
  const ready = ref(false)
  /** az AI-értelmezés keretének becslése (a Workerből; a hívás után frissül) */
  const aiInfo = reactive<{ leftPct: number | null; model: string; exhausted: boolean }>({ leftPct: null, model: '', exhausted: false })
  let timer: ReturnType<typeof setTimeout> | null = null
  function init() {
    if (ready.value || typeof localStorage === 'undefined') return
    Object.assign(s, load()); ready.value = true
    watch(s, () => { if (timer) clearTimeout(timer); timer = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* tele a tároló */ } }, 300) }, { deep: true })
    window.addEventListener('online', () => { void flush() })
    void flush()
  }
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
  return { s, ready, aiInfo, init, trained, lastTrain, activePersonal, filterList, addPersonal, removePersonal, noteUnknown, dropUnknown, addLog, flush, suggestions, acceptSuggestion, dismissSuggestion, rates, addTraining, shouldOffer }
})
