// Diktálás (spec v2.3, 7., 8., 11., 13., 14. pont; v2.4 4., 5., 12., 18. pont): hangfelvétel a böngészőben → pontos felismerés a Cloudflare Worker Whisper-modelljével
// (rövid mondatos szakszó-szöveggel); a böngésző beépített felismerője a háttérben fut (élő előnézet a teszt ágon; összevetés és tartalék mindkét ágon).
// v2.4 5. pont: ha a Whisper szövege láthatóan értelmetlen (a böngészőével vett közös szavak aránya < 30%, vagy a kitaláció-szűrők elbuktatják),
// a program magától a böngésző szövegét használja, és ezt jelzi. v2.4 18. pont: hálózat nélkül a diktálás nem indul; kapcsolatvesztésnél
// legfeljebb kb. 15 másodpercig, 3 alkalommal újrapróbálja, utána „A kapcsolat megszakadt – a diktálás nem készült el, mondja újra.”
import { defineStore } from 'pinia'
import { DICTATION_LIMIT_S, DEV_TOOLS } from '~/utils/meta'
import { levelState, prepareAudio, startCapture, toWav, type AudioStats, type Capture, type LevelState, type ResampleMode } from '~/utils/dict/audio'
import { whisperVerdict } from '~/utils/dict/quality'
import type { PromptStyle } from '~/utils/dict/prompt'
import { useDictStore } from './dict'

type Target = { get: () => string; set: (v: string) => void }
export interface DictResult {
  text: string; recognizer: 'whisper' | 'browser' | 'none'; live: string; seconds: number; noSpeech: boolean; fallback: boolean; differs: boolean
  /** v2.4 18. pont: a kapcsolat megszakadt – nincs eredmény */
  netFail?: boolean
  /** a Whisper nyers szövege (a fejlesztői nézethez és a laborhoz), a böngésző élő és végső szövege */
  whisper?: string; browserFinal?: string
}
/** a próbabeállítások (v2.4 12. pont D: a Diktálás-laborban kapcsolhatók; a main ágon rögzítettek) */
export interface DictOpts { noise: boolean; resample: ResampleMode; promptStyle: PromptStyle; vad: boolean; recognizer: 'whisper' | 'browser' }
export interface StartCtx { prompt: (style?: PromptStyle) => string; onDone?: (r: DictResult) => void; opts?: Partial<DictOpts> }
/** a fejlesztői diagnosztika (v2.4 4. és 12. pont D): hang, felismerők, döntések – a teszt ágon jelenik meg */
export interface DictDiag {
  at: string
  opts: DictOpts
  audio?: AudioStats & { inRate: number; avgRms: number; level: LevelState }
  wav?: { rate: number; channels: number; bytes: number; seconds: number }
  worker?: { ms?: number; bytes?: number; wav?: { ok: boolean; rate: number; channels: number; bits: number; dataBytes: number; seconds: number; headerMatches: boolean; note: string }; vad?: boolean; promptChars?: number; segments?: unknown[]; info?: unknown; keys?: string[] }
  prompt: string
  whisper: string
  browserLive: string
  browserFinal: string
  used: 'whisper' | 'browser' | 'none'
  model: string
  attempts: number
  fallbackReason: string
  ratio: number | null
  error: string
}

const isIOS = () => typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent)
const WORKER_TIMEOUT = 15000
/** v2.4 18. pont: kapcsolatvesztésnél legfeljebb ennyi próbálkozás, összesen kb. ennyi ideig */
export const NET_RETRIES = 3
export const NET_RETRY_MS = 15000
export const NET_FAIL_MSG = 'A kapcsolat megszakadt – a diktálás nem készült el, mondja újra.'
export const OFFLINE_MSG = 'Nincs hálózati kapcsolat – a diktálás most nem érhető el. A kezelést kézzel is rögzítheti.'
export const SWITCH_NOTE = 'Alap felismerés – a pontos felismerés most nem adott használható szöveget.'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

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
  /** v2.4: a legutóbbi felvétel diagnosztikája; a felvétel a munkamenet alatt visszahallgatható / letölthető (csak a teszt ágon, a memóriában) */
  const diag = ref<DictDiag | null>(null)
  const lastWavUrl = ref('')
  let limitTimer: ReturnType<typeof setInterval> | null = null
  let rec: any = null
  let wanted = false
  let finalText = ''
  let base = ''
  let target: Target | null = null
  let cap: Capture | null = null
  let ctx: StartCtx | null = null
  let hist: { t: number; rms: number; peak: number }[] = []
  let worstLvl: LevelState = 'ok'
  let rmsSum = 0, rmsN = 0
  let lastWav: Uint8Array | null = null
  let lastRaw: { samples: Float32Array; rate: number } | null = null
  let lastSeconds = 0
  let micOnly = false
  let opts: DictOpts = { noise: true, resample: 'uj', promptStyle: 'mondat', vad: true, recognizer: 'whisper' }

  const SR = () => (typeof window === 'undefined' ? null : (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
  const hasMic = () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
  const online = () => typeof navigator === 'undefined' || navigator.onLine
  function detect() {
    supported.value = !!SR() || hasMic()
    return supported.value
  }
  const RANK: Record<LevelState, number> = { ok: 0, quiet: 1, loud: 1, none: 2 }

  async function start(t: Target, c: StartCtx) {
    const dict = useDictStore(); dict.init()
    stop(); target = t; ctx = c
    // v2.4 18. pont: hálózat nélkül a diktálás nem indul (az eszköz saját felismerésére sem váltunk)
    if (!online()) { message.value = OFFLINE_MSG; return }
    wanted = true
    const p = dict.eff
    opts = { noise: p.noise, resample: p.resample, promptStyle: p.promptStyle, vad: p.vad, recognizer: p.recognizer, ...(c.opts || {}) }
    base = t.get(); if (base && !/\s$/.test(base)) base += ' '
    finalText = ''; live.value = ''; previewNote.value = ''; fallbackNote.value = ''; canRetry.value = false; used.value = 'none'; hist = []; lvl.value = 'ok'; level.value = 0; message.value = ''; worstLvl = 'ok'; rmsSum = 0; rmsN = 0
    const wantWhisper = opts.recognizer === 'whisper' && hasMic()
    if (opts.recognizer === 'whisper' && !wantWhisper) fallbackNote.value = 'Alap felismerés – a pontos felismerés most nem elérhető (nincs mikrofon-hozzáférés).'
    micOnly = wantWhisper
    // 1) hangfelvétel (Whisperhez és a hangerőjelzőhöz); böngészős felismerőnél iPhone-on a mikrofon megosztása nem biztos, ott a jelző kimarad
    if (hasMic() && (wantWhisper || !isIOS())) {
      try {
        cap = await startCapture({ noise: opts.noise, onLevel: (rms, peak) => {
          level.value = Math.min(1, rms * 9); hist.push({ t: performance.now(), rms, peak }); if (hist.length > 80) hist.shift(); lvl.value = levelState(hist, performance.now())
          rmsSum += rms; rmsN++; if (RANK[lvl.value] > RANK[worstLvl]) worstLvl = lvl.value
        } })
      } catch (e) {
        cap = null
        const m = (e as Error).name === 'NotAllowedError' ? 'A mikrofon használata nincs engedélyezve. Engedélyezd a böngésző címsoránál.' : 'Nem található mikrofon.'
        if (wantWhisper) { micOnly = false; fallbackNote.value = 'Alap felismerés – a pontos felismerés most nem elérhető.'; message.value = m } else { message.value = m }
      }
    }
    // 2) a böngésző felismerője: a háttérben mindig fut, ha elérhető (összevetés és tartalék, v2.4 5. és 12. pont B); élő előnézetként csak a teszt ágon látszik
    const S = SR()
    if (S) startBrowserRec(S, !micOnly)
    else if (micOnly) previewNote.value = 'Élő előnézet ezen az eszközön nem érhető el'
    if (!cap && !S) { message.value = 'Ez a böngésző nem támogatja a diktálást – gépeld be a szöveget.'; wanted = false; return }
    recording.value = true
    previewOn.value = !!S && DEV_TOOLS && p.livePreview
    message.value = DEV_TOOLS ? `Ez a demó egyszerre csak ${DICTATION_LIMIT_S} másodperc rögzítését engedi. Hallgatlak…` : 'Hallgatlak…'
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

  function newDiag(): DictDiag {
    return { at: new Date().toISOString(), opts: { ...opts }, prompt: '', whisper: '', browserLive: live.value, browserFinal: finalText.trim(), used: 'none', model: '', attempts: 0, fallbackReason: '', ratio: null, error: '' }
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
    message.value = msg || (text ? 'Diktálás sikeres – feldolgozom az eredményt…' : 'Nem sikerült megérteni – kérjük, mondja újra.')
    used.value = 'browser'
    const d = newDiag(); d.used = 'browser'; d.fallbackReason = 'a böngésző felismerője volt kiválasztva / a mikrofon nem volt elérhető'; diag.value = d
    done?.onDone?.({ text, recognizer: 'browser', live: live.value, seconds: elapsed.value, noSpeech: !text, fallback: false, differs: false, browserFinal: finalText.trim() })
  }

  async function finish(c: Capture, msg: string | undefined, done: StartCtx | null, t: Target | null) {
    processing.value = true
    message.value = DEV_TOOLS ? 'Szöveg felismerése…' : 'Diktálás sikeres – feldolgozom az eredményt…'
    // a böngésző felismerőjének utolsó szavai a leállítás után érkeznek: rövid várakozás az összevetéshez
    await sleep(350)
    let res: DictResult
    const d = newDiag()
    try {
      const raw = await c.stop()
      lastRaw = raw
      res = await processRaw(raw, done, d)
    } catch (e) {
      d.error = String((e as Error)?.message || e)
      res = fallbackResult(lastSeconds, d, 'a felvétel feldolgozása nem sikerült')
    }
    diag.value = d
    processing.value = false
    if (res.netFail) { message.value = NET_FAIL_MSG; done?.onDone?.(res); return }
    if (t && !res.noSpeech) t.set(base + res.text)
    if (res.noSpeech) message.value = worstLvl === 'quiet' ? 'Nem sikerült megérteni – halk volt a hang, beszéljen közelebb a mikrofonhoz.' : 'Nem sikerült megérteni – kérjük, mondja újra.'
    else if (res.recognizer === 'whisper') { message.value = msg || 'Diktálás sikeres – feldolgozom az eredményt…'; swapFlash.value++ }
    done?.onDone?.(res)
  }
  /** a nyers felvétel előkészítése és felismertetése a beállítások szerint (a labor újrafuttatása is ezt használja) */
  async function processRaw(raw: { samples: Float32Array; rate: number }, done: StartCtx | null, d: DictDiag): Promise<DictResult> {
    const { pcm, stats } = prepareAudio(raw.samples, raw.rate, { highpassHz: opts.noise ? 90 : 0, normalize: true, resample: opts.resample })
    lastSeconds = stats.seconds
    d.audio = { ...stats, inRate: raw.rate, avgRms: rmsN ? rmsSum / rmsN : stats.rms, level: worstLvl }
    if (stats.speechRatio < 0.03 || stats.peak < 0.01) {
      d.fallbackReason = 'nem érkezett értelmezhető beszéd (csend vagy túl halk)'
      return { text: '', recognizer: 'none', live: live.value, seconds: stats.seconds, noSpeech: true, fallback: false, differs: false }
    }
    lastWav = toWav(pcm)
    if (DEV_TOOLS) { try { if (lastWavUrl.value) URL.revokeObjectURL(lastWavUrl.value); lastWavUrl.value = URL.createObjectURL(new Blob([lastWav as unknown as BlobPart], { type: 'audio/wav' })) } catch { /* nincs URL API */ } }
    d.wav = { rate: 16000, channels: 1, bytes: lastWav.length, seconds: stats.seconds }
    const prompt = done?.prompt(opts.promptStyle) ?? ''
    d.prompt = prompt
    return transcribe(lastWav, prompt, stats.seconds, d)
  }
  function fallbackResult(seconds: number, d: DictDiag | null, reason: string, note = 'Alap felismerés – a pontos felismerés most nem elérhető.'): DictResult {
    const txt = (finalText.trim() || live.value).trim()
    fallbackNote.value = note
    whisperOk.value = false; canRetry.value = !!lastWav
    used.value = 'browser'
    if (d) { d.used = txt ? 'browser' : 'none'; d.fallbackReason = reason; d.browserFinal = finalText.trim(); d.browserLive = live.value }
    if (!txt) return { text: '', recognizer: 'none', live: live.value, seconds, noSpeech: true, fallback: true, differs: false, browserFinal: finalText.trim() }
    return { text: txt, recognizer: 'browser', live: live.value, seconds, noSpeech: false, fallback: true, differs: false, browserFinal: finalText.trim() }
  }
  async function transcribe(wav: Uint8Array, prompt: string, seconds: number, d: DictDiag): Promise<DictResult> {
    const dict = useDictStore()
    const t0 = Date.now()
    for (let attempt = 1; attempt <= NET_RETRIES; attempt++) {
      d.attempts = attempt
      const ac = new AbortController(), to = setTimeout(() => ac.abort(), WORKER_TIMEOUT)
      try {
        const r = await fetch('/api/diktalas/atiras', { method: 'POST', body: wav as unknown as BodyInit, signal: ac.signal, headers: { 'content-type': 'audio/wav', 'x-molio-prompt': encodeURIComponent(prompt), 'x-molio-device': dict.s.deviceId, 'x-molio-vad': opts.vad ? '1' : '0' } })
        const j = await r.json().catch(() => null) as { ok?: boolean; text?: string; limited?: boolean; model?: string; error?: string; diag?: DictDiag['worker'] } | null
        d.worker = j?.diag
        if (!r.ok || !j?.ok) return fallbackResult(seconds, d, `a Worker hibát adott: ${j?.error || r.status}${j?.limited ? ' (kéréskorlát)' : ''}`)
        whisperOk.value = true; canRetry.value = false
        const text = (j.text || '').trim(), lv = live.value
        d.whisper = text; d.model = j.model || ''; d.browserLive = lv; d.browserFinal = finalText.trim()
        // v2.4 5. pont: értelmetlen Whisper-szöveg → automatikus váltás a böngésző szövegére (a végleges szöveg mindig egy felismerő szövege)
        const browserText = (finalText.trim() || lv).trim()
        const v = whisperVerdict(text, browserText, seconds)
        d.ratio = v.ratio
        if (!v.usable && browserText) {
          d.used = 'browser'; d.fallbackReason = v.reason
          used.value = 'browser'; fallbackNote.value = SWITCH_NOTE; canRetry.value = false
          return { text: browserText, recognizer: 'browser', live: lv, seconds, noSpeech: false, fallback: true, differs: false, whisper: text, browserFinal: finalText.trim() }
        }
        if (!v.usable && !text) { d.fallbackReason = v.reason; return { text: '', recognizer: 'none', live: lv, seconds, noSpeech: true, fallback: false, differs: false, whisper: text } }
        used.value = 'whisper'; fallbackNote.value = ''; d.used = 'whisper'; d.fallbackReason = v.reason
        const differs = v.ratio !== null && v.ratio < 0.75
        return { text, recognizer: 'whisper', live: lv, seconds, noSpeech: false, fallback: false, differs, whisper: text, browserFinal: finalText.trim() }
      } catch (e) {
        const aborted = (e as Error)?.name === 'AbortError'
        // v2.4 18. pont: kapcsolatvesztés → legfeljebb kb. 15 másodpercig újrapróbálja; időtúllépés → tartalék (böngésző)
        if (!aborted && attempt < NET_RETRIES && Date.now() - t0 < NET_RETRY_MS) { await sleep(Math.min(4000, 1500 * attempt)); continue }
        if (!online() || (!aborted && attempt >= NET_RETRIES)) { d.error = 'kapcsolatvesztés'; d.fallbackReason = NET_FAIL_MSG; return { text: '', recognizer: 'none', live: live.value, seconds, noSpeech: false, fallback: false, differs: false, netFail: true } }
        return fallbackResult(seconds, d, aborted ? 'időtúllépés (15 mp)' : 'hálózati hiba')
      } finally { clearTimeout(to) }
    }
    return fallbackResult(seconds, d, 'ismeretlen hiba')
  }
  /** „Újrapróbálás pontos felismeréssel” (teszt ág): a már rögzített hang újra a Workerre */
  async function retry() {
    if (!lastWav || !ctx) return
    processing.value = true; message.value = 'Szöveg felismerése…'
    const d = newDiag(); d.prompt = ctx.prompt(opts.promptStyle)
    const res = await transcribe(lastWav, d.prompt, lastSeconds, d)
    diag.value = d
    processing.value = false
    if (res.recognizer === 'whisper') { message.value = 'A pontos felismerés sikerült.'; target?.set(base + res.text); swapFlash.value++ }
    ctx.onDone?.(res)
  }
  /** v2.4 12. pont D: Diktálás-labor – újrafuttatás ugyanazzal a felvétellel, más beállítással (újra felolvasás nélkül) */
  async function rerun(o: Partial<DictOpts>, prompt: (style?: PromptStyle) => string): Promise<{ res: DictResult; diag: DictDiag } | null> {
    if (!lastRaw) return null
    const keep = opts
    opts = { ...opts, ...o }
    processing.value = true
    const d = newDiag()
    try {
      const res = await processRaw(lastRaw, { prompt }, d)
      return { res, diag: d }
    } finally { opts = keep; processing.value = false; diag.value = d }
  }
  const hasRecording = () => !!lastRaw
  async function probe() {
    try { const r = await fetch('/api/diktalas/keret', { headers: { 'x-molio-device': useDictStore().s.deviceId } }); const j = await r.json() as { ok: boolean; leftPct: number | null; model: string }; whisperOk.value = !!j?.ok; const d = useDictStore(); if (j?.ok) { d.aiInfo.leftPct = j.leftPct; d.aiInfo.model = j.model }; return j } catch { whisperOk.value = false; return null }
  }

  return { recording, processing, message, supported, remaining, elapsed, level, lvl, live, previewOn, previewNote, used, fallbackNote, canRetry, swapFlash, whisperOk, diag, lastWavUrl, detect, start, stop, retry, rerun, hasRecording, probe }
})
