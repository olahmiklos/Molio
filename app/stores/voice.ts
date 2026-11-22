// Diktálás (spec v2.3, 7., 8., 11., 13., 14. pont): hangfelvétel a böngészőben → pontos felismerés a Cloudflare Worker Whisper-modelljével (szakszó-listával);
// beszéd közben a böngésző beépített felismerője élő előnézetet ad; ha a Whisper nem érhető el, a böngésző felismerője a tartalék.
import { defineStore } from 'pinia'
import { DICTATION_LIMIT_S } from '~/utils/meta'
import { levelState, prepareAudio, startCapture, toWav, type Capture, type LevelState } from '~/utils/dict/audio'
import { useDictStore } from './dict'
import { useUiStore } from './ui'

type Target = { get: () => string; set: (v: string) => void }
export interface DictResult { text: string; recognizer: 'whisper' | 'browser' | 'none'; live: string; seconds: number; noSpeech: boolean; fallback: boolean; differs: boolean }
export interface StartCtx { prompt: () => string; onDone?: (r: DictResult) => void }

const isIOS = () => typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent)
const WORKER_TIMEOUT = 15000

export const useVoiceStore = defineStore('voice', () => {
  const recording = ref(false)
  const processing = ref(false)
  const message = ref('')
  const supported = ref(false)
  const remaining = ref(0)
  const elapsed = ref(0)
  const level = ref(0)
  const lvl = ref<LevelState>('ok')
  /** az élő előnézet szövege (a végleges szöveg a Whisperből jön) */
  const live = ref('')
  const previewOn = ref(false)
  const previewNote = ref('')
  const used = ref<'whisper' | 'browser' | 'none'>('none')
  const fallbackNote = ref('')
  const canRetry = ref(false)
  const swapFlash = ref(0)
  const whisperOk = ref<boolean | null>(null)
  let limitTimer: ReturnType<typeof setInterval> | null = null
  let rec: any = null
  let wanted = false
  let finalText = ''
  let base = ''
  let target: Target | null = null
  let cap: Capture | null = null
  let ctx: StartCtx | null = null
  let hist: { t: number; rms: number; peak: number }[] = []
  let lastWav: Uint8Array | null = null
  let lastSeconds = 0
  let micOnly = false

  const SR = () => (typeof window === 'undefined' ? null : (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
  const hasMic = () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
  function detect() {
    supported.value = !!SR() || hasMic()
    return supported.value
  }

  async function start(t: Target, c: StartCtx) {
    const dict = useDictStore(); dict.init()
    stop(); target = t; ctx = c; wanted = true
    base = t.get(); if (base && !/\s$/.test(base)) base += ' '
    finalText = ''; live.value = ''; previewNote.value = ''; fallbackNote.value = ''; canRetry.value = false; used.value = 'none'; hist = []; lvl.value = 'ok'; level.value = 0; message.value = ''
    const wantWhisper = dict.s.prefs.recognizer === 'whisper' && hasMic() && (typeof navigator === 'undefined' || navigator.onLine)
    if (dict.s.prefs.recognizer === 'whisper' && !wantWhisper) fallbackNote.value = 'Alap felismerés – a pontos felismerés most nem elérhető (nincs internet vagy mikrofon-hozzáférés).'
    micOnly = wantWhisper
    // 1) hangfelvétel (Whisperhez és a hangerőjelzőhöz); böngészős felismerőnél iPhone-on a mikrofon megosztása nem biztos, ott a jelző kimarad
    if (hasMic() && (wantWhisper || !isIOS())) {
      try {
        cap = await startCapture({ noise: dict.s.prefs.noise, onLevel: (rms, peak) => {
          level.value = Math.min(1, rms * 9); hist.push({ t: performance.now(), rms, peak }); if (hist.length > 80) hist.shift(); lvl.value = levelState(hist, performance.now())
        } })
      } catch (e) {
        cap = null
        const m = (e as Error).name === 'NotAllowedError' ? 'A mikrofon használata nincs engedélyezve. Engedélyezd a böngésző címsoránál.' : 'Nem található mikrofon.'
        if (wantWhisper) { micOnly = false; fallbackNote.value = 'Alap felismerés – a pontos felismerés most nem elérhető.'; message.value = m } else { message.value = m }
      }
    }
    // 2) a böngésző felismerője: élő előnézet (8. pont) vagy tartalék
    const needBrowser = !micOnly || dict.s.prefs.livePreview
    const S = SR()
    if (needBrowser && S) startBrowserRec(S, !micOnly)
    else if (micOnly && dict.s.prefs.livePreview && !S) previewNote.value = 'Élő előnézet ezen az eszközön nem érhető el'
    if (!cap && !S) { message.value = 'Ez a böngésző nem támogatja a diktálást – gépeld be a szöveget.'; wanted = false; return }
    recording.value = true
    previewOn.value = !!S && needBrowser
    message.value = `Ez a demó egyszerre csak ${DICTATION_LIMIT_S} másodperc rögzítését engedi. Hallgatlak…`
    useUiStore().toast(`Ez a demó egyszerre csak ${DICTATION_LIMIT_S} másodperc rögzítését engedi.`)
    remaining.value = DICTATION_LIMIT_S; elapsed.value = 0
    limitTimer = setInterval(() => {
      remaining.value--; elapsed.value++
      if (remaining.value <= 0) stop(`A ${DICTATION_LIMIT_S} másodperces demó-korlát lejárt, a rögzítés automatikusan leállt. A szöveg javítható; új diktáláshoz nyomd meg újra a gombot.`)
    }, 1000)
  }

  function startBrowserRec(S: any, writeTarget: boolean) {
    const r = new S(); rec = r
    r.lang = 'hu-HU'; r.continuous = true; r.interimResults = true
    let gotAny = false, started = performance.now()
    r.onresult = (e: any) => {
      let interim = ''; gotAny = true
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const tx = e.results[i][0].transcript
        if (e.results[i].isFinal) finalText += tx.trim() + '. '; else interim += tx
      }
      live.value = (finalText + interim).trim()
      if (writeTarget) target?.set(base + finalText + interim)
    }
    r.onerror = (e: any) => {
      const m: Record<string, string> = { 'not-allowed': 'A mikrofon használata nincs engedélyezve. Engedélyezd a böngésző címsoránál.', 'service-not-allowed': 'A böngésző nem engedi a beszédfelismerést. Gépeld be a szöveget.', network: 'A diktáláshoz internetkapcsolat kell.', 'no-speech': 'Nem hallottam beszédet.', 'audio-capture': 'Nem található mikrofon.' }
      if (micOnly && ['audio-capture', 'not-allowed', 'service-not-allowed', 'network'].includes(e.error)) { previewNote.value = 'Élő előnézet ezen az eszközön nem érhető el'; previewOn.value = false; try { r.abort() } catch { /* leállt */ }; rec = null; return }
      message.value = m[e.error] || 'Hiba: ' + e.error
      if (['not-allowed', 'audio-capture', 'network', 'service-not-allowed'].includes(e.error)) wanted = false
    }
    r.onend = () => {
      if (wanted && rec === r) {
        // ha a felvétellel egyidejű indítás után azonnal leáll és semmit nem hozott, az eszköz nem tudja megosztani a mikrofont
        if (micOnly && !gotAny && performance.now() - started < 1500) { previewNote.value = 'Élő előnézet ezen az eszközön nem érhető el'; previewOn.value = false; rec = null; return }
        if (writeTarget && target) { base = target.get(); if (base && !/\s$/.test(base)) base += ' '; finalText = '' }
        started = performance.now()
        try { r.start() } catch { if (!micOnly) wanted = false }
      }
      if (!micOnly) recording.value = wanted
    }
    try { r.start() } catch { if (!micOnly) wanted = false }
  }

  /** leállítás: a felvétel a Workerre kerül, az eredmény a szövegmezőbe; hiba esetén a böngésző felismerője a tartalék */
  function stop(msg?: string) {
    const was = recording.value
    if (limitTimer) { clearInterval(limitTimer); limitTimer = null }
    remaining.value = 0
    wanted = false
    const r = rec; rec = null
    if (r) { try { r.stop() } catch { /* már leállt */ } }
    recording.value = false; level.value = 0
    if (!was) { if (msg) message.value = msg; return }
    const c = cap; cap = null
    const done = ctx; const t = target
    if (c && micOnly) { void finish(c, msg, done, t); return }
    if (c) void c.stop().catch(() => {})
    const text = (finalText).trim() || live.value
    message.value = msg || 'Diktálás leállítva. A szöveg javítható.'
    used.value = 'browser'
    done?.onDone?.({ text, recognizer: 'browser', live: live.value, seconds: elapsed.value, noSpeech: false, fallback: false, differs: false })
  }

  async function finish(c: Capture, msg: string | undefined, done: StartCtx | null, t: Target | null) {
    processing.value = true
    message.value = 'Szöveg felismerése…'
    const dict = useDictStore()
    let res: DictResult
    try {
      const raw = await c.stop()
      const { pcm, stats } = prepareAudio(raw.samples, raw.rate, { highpassHz: dict.s.prefs.noise ? 90 : 0, normalize: dict.s.prefs.noise })
      lastSeconds = stats.seconds
      if (stats.speechRatio < 0.03 || stats.peak < 0.01) {
        message.value = 'Nem érkezett értelmezhető beszéd – kérjük, ismételje meg.'
        res = { text: '', recognizer: 'none', live: live.value, seconds: stats.seconds, noSpeech: true, fallback: false, differs: false }
        processing.value = false; done?.onDone?.(res); return
      }
      lastWav = toWav(pcm)
      res = await transcribe(lastWav, done?.prompt() || '', stats.seconds)
    } catch {
      res = fallbackResult(lastSeconds)
    }
    processing.value = false
    if (t && !res.noSpeech) t.set(base + res.text)
    if (res.recognizer === 'whisper') { message.value = msg || 'Diktálás leállítva. A szöveg javítható.'; swapFlash.value++ }
    done?.onDone?.(res)
  }
  function fallbackResult(seconds: number): DictResult {
    const txt = (finalText.trim() || live.value).trim()
    fallbackNote.value = 'Alap felismerés – a pontos felismerés most nem elérhető.'
    whisperOk.value = false; canRetry.value = !!lastWav
    used.value = 'browser'
    message.value = fallbackNote.value
    return { text: txt, recognizer: 'browser', live: live.value, seconds, noSpeech: false, fallback: true, differs: false }
  }
  async function transcribe(wav: Uint8Array, prompt: string, seconds: number): Promise<DictResult> {
    const dict = useDictStore()
    const ac = new AbortController(), to = setTimeout(() => ac.abort(), WORKER_TIMEOUT)
    try {
      const r = await fetch('/api/diktalas/atiras', { method: 'POST', body: wav as unknown as BodyInit, signal: ac.signal, headers: { 'content-type': 'audio/wav', 'x-molio-prompt': encodeURIComponent(prompt), 'x-molio-device': dict.s.deviceId } })
      const j = await r.json().catch(() => null) as { ok?: boolean; text?: string; limited?: boolean } | null
      if (!r.ok || !j?.ok) return fallbackResult(seconds)
      whisperOk.value = true; used.value = 'whisper'; canRetry.value = false; fallbackNote.value = ''
      const text = (j.text || '').trim(), lv = live.value
      const w = (s: string) => s.toLowerCase().replace(/[^\p{L}\d ]+/gu, '').split(/\s+/).filter(Boolean)
      const a = new Set(w(text)), b = w(lv)
      const differs = !!lv && b.length > 0 && b.filter(x => !a.has(x)).length / b.length > 0.25
      return { text, recognizer: 'whisper', live: lv, seconds, noSpeech: false, fallback: false, differs }
    } catch { return fallbackResult(seconds) } finally { clearTimeout(to) }
  }
  /** „Újrapróbálás pontos felismeréssel”: a már rögzített hang újra a Workerre */
  async function retry() {
    if (!lastWav || !ctx) return
    processing.value = true; message.value = 'Szöveg felismerése…'
    const res = await transcribe(lastWav, ctx.prompt(), lastSeconds)
    processing.value = false
    if (res.recognizer === 'whisper') { message.value = 'A pontos felismerés sikerült.'; target?.set(base + res.text); swapFlash.value++ }
    ctx.onDone?.(res)
  }
  async function probe() {
    try { const r = await fetch('/api/diktalas/keret', { headers: { 'x-molio-device': useDictStore().s.deviceId } }); const j = await r.json() as { ok: boolean; leftPct: number | null; model: string }; whisperOk.value = !!j?.ok; const d = useDictStore(); if (j?.ok) { d.aiInfo.leftPct = j.leftPct; d.aiInfo.model = j.model }; return j } catch { whisperOk.value = false; return null }
  }

  return { recording, processing, message, supported, remaining, elapsed, level, lvl, live, previewOn, previewNote, used, fallbackNote, canRetry, swapFlash, whisperOk, detect, start, stop, retry, probe }
})
