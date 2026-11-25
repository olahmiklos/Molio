// Molio demó – kis Cloudflare Worker a statikus oldal előtt (spec v2.3, 5., 7., 17. pont; v2.4 5., 6., 12., 15., 17., 20. pont).
// Csak az /api/* kérések futnak ezen (wrangler.jsonc: assets.run_worker_first); minden más kérés változatlanul a statikus fájlokhoz kerül (env.ASSETS).
//   POST /api/diktalas/atiras        – hang → szöveg (Workers AI: Whisper large-v3-turbo, magyar, szakszó-szöveggel); a válasz a fejlesztői nézethez diagnosztikát is ad
//   POST /api/diktalas/ertelmezes    – szöveg → strukturált tételek (Workers AI nyelvi modell), csak a Molio kódkészleteiből választva
//   POST /api/diktalas/naplo         – anonimizált javítási napló központi gyűjtése (Cloudflare KV, ha be van kötve)
//   GET  /api/diktalas/keret         – a napi ingyenes AI-keret becsült állapota
//   POST /api/diktalas/tanult-javitas – v2.4 6., 15. pont: tanult javítások és rövidítések központi mentése ágak szerint (egy kötegben egy írás)
//   GET  /api/diktalas/tanult-javitas – a main ágon a main ág bejegyzései; a teszt ágon a main és a teszt ágé (export is)
//   POST /api/diktalas/proba          – v2.4 12. pont E): próbanapló (csak a teszt ágon; hang nélkül; 90 napig)
//   GET  /api/diktalas/proba          – a próbanapló olvasása (csak a teszt ágon)
//   POST /api/latogatas               – v2.4 20. pont: látogatás naplózása (mindkét ágon; látogatásonként egy írás, napi felső határ)
//   GET  /api/latogatas               – a látogatás-napló olvasása (CSAK a teszt ágon – a main gazdagépen nincs olvasó végpont)
//   DELETE /api/latogatas             – a napló törlése (csak a teszt ágon)
//   POST /api/latogatas/nev           – IP-címhez rövid név / „saját” jelölés (csak a teszt ágon)
// A hangot a Worker nem tárolja, csak továbbítja. Titkot / API-kulcsot nem használ (AI binding).
// KV-keret (ingyenes csomag: kb. 1000 írás / nap): minden KV-művelet hibatűrő (try/catch) – a keret kimerülése nem állíthatja le a diktálást.

interface KVList { keys: { name: string }[]; list_complete: boolean; cursor?: string }
interface KV {
  get(k: string): Promise<string | null>
  put(k: string, v: string, o?: { expirationTtl?: number }): Promise<void>
  list?(o: { prefix?: string; cursor?: string; limit?: number }): Promise<KVList>
  delete?(k: string): Promise<void>
}
interface Env {
  AI: { run(model: string, input: Record<string, unknown>): Promise<any> }
  ASSETS: { fetch(r: Request): Promise<Response> }
  /** opcionális: KV névtér a központi naplóhoz és a keret-becsléshez. Ha nincs bekötve, a Worker kecsesen kezeli (a kliens várakoztatja a bejegyzéseket). */
  MOLIO_LOG?: KV
  /** opcionális felülbírálat a nyelvi modellhez */
  AI_MODEL?: string
}

export const WHISPER_MODEL = '@cf/openai/whisper-large-v3-turbo'
export const DEFAULT_LLM = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
const LIMIT_PER_HOUR = 60
const MAX_AUDIO_BYTES = 2_200_000
const DAILY_NEURONS = 10_000
/** becsült fogyasztás hívásonként (neuron): whisper ~ 30 s hang; nyelvi modell ~ 500 bemeneti + 200 kimeneti token */
const COST = { whisper: 55, llm: 55 }
const DAY_S = 86400
/** v2.4 20/7: napi felső határ a látogatás-írásra ágonként (a KV ingyenes írás-keretének kímélése) */
export const VISIT_DAILY_CAP = 200
const KEEP_90 = 90 * DAY_S
const memCount = new Map<string, number>()
let memQuota = { day: '', used: 0 }

const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })
const day = () => new Date().toISOString().slice(0, 10)

/* ---------- hibatűrő KV-műveletek ---------- */
async function kvGet(env: Env, k: string): Promise<string | null> { try { return env.MOLIO_LOG ? await env.MOLIO_LOG.get(k) : null } catch { return null } }
async function kvPut(env: Env, k: string, v: string, ttl?: number): Promise<boolean> {
  if (!env.MOLIO_LOG) return false
  try { await env.MOLIO_LOG.put(k, v, ttl ? { expirationTtl: ttl } : undefined); return true } catch { return false }
}
async function kvList(env: Env, prefix: string, max = 1000): Promise<string[]> {
  const kv = env.MOLIO_LOG; if (!kv?.list) return []
  const out: string[] = []; let cursor: string | undefined
  try {
    do { const r = await kv.list({ prefix, cursor, limit: 1000 }); r.keys.forEach(k => out.push(k.name)); cursor = r.list_complete ? undefined : r.cursor } while (cursor && out.length < max)
  } catch { /* a lista hibája üres eredményt ad */ }
  return out
}
async function kvDel(env: Env, k: string): Promise<boolean> { try { if (!env.MOLIO_LOG?.delete) return false; await env.MOLIO_LOG.delete(k); return true } catch { return false } }

/** csak a saját alkalmazásból érkező kérés (eredet-ellenőrzés): az Origin / Referer gazdája egyezik a Worker gazdájával */
export function sameOrigin(req: Request): boolean {
  const host = new URL(req.url).host
  const o = req.headers.get('origin') || req.headers.get('referer')
  if (!o) return false
  try { return new URL(o).host === host } catch { return false }
}
/** v2.4 20. pont 8., 10/a: a teszt oldal gazdagépe (teszt-molio…, előnézeti cím, helyi fejlesztés). A main és a teszt egy Worker két változata lehet,
 * ezért az olvasó végpontok a hívás gazdagépe alapján tiltódnak a main oldalon. */
export function isTestHost(host: string): boolean {
  const h = host.toLowerCase().split(':')[0]!
  return /(^|[.-])teszt([.-]|$)/.test(h) || h === 'localhost' || h === '127.0.0.1' || h.endsWith('.localhost')
}
/** a kérés ága a gazdagép szerint */
export const branchOf = (host: string): 'main' | 'teszt' => (isTestHost(host) ? 'teszt' : 'main')
/** nyilvánvaló robotok és üzenetküldők / közösségi oldalak előnézet-generálói (v2.4 20. pont 6.): ezek nem írnak a naplóba (20/7) */
export function isBot(ua: string): boolean {
  return /bot\b|crawler|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|discord|slack|skype|viber|linkedin|twitter|embedly|curl|wget|python-requests|headless|lighthouse|pingdom|uptime/i.test(ua || '')
}

async function rateLimit(env: Env, device: string): Promise<boolean> {
  const key = `rl:${device}:${new Date().toISOString().slice(0, 13)}`
  // a memóriabeli számláló az elsődleges; a KV csak akkor ír, ha be van kötve – hibája nem tiltja a diktálást
  const n = memCount.get(key) || 0
  if (n >= LIMIT_PER_HOUR) return false
  memCount.set(key, n + 1); if (memCount.size > 5000) memCount.clear()
  if (env.MOLIO_LOG) {
    const kvN = Number(await kvGet(env, key) || 0)
    if (kvN >= LIMIT_PER_HOUR) return false
    await kvPut(env, key, String(kvN + 1), 4000)
  }
  return true
}
async function quotaGet(env: Env): Promise<number | null> {
  if (!env.MOLIO_LOG) return memQuota.day === day() ? memQuota.used : null
  const v = await kvGet(env, 'quota:' + day()); return v === null ? 0 : Number(v)
}
async function quotaAdd(env: Env, n: number) {
  if (memQuota.day !== day()) memQuota = { day: day(), used: 0 }
  memQuota.used += n
  if (env.MOLIO_LOG) { const cur = Number(await kvGet(env, 'quota:' + day()) || 0); await kvPut(env, 'quota:' + day(), String(cur + n), 172800) }
}
const leftPct = (used: number | null) => (used === null ? null : Math.max(0, Math.round(100 - (used / DAILY_NEURONS) * 100)))

const bytesToB64 = (b: Uint8Array) => { let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s) }
const withTimeout = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))])

/** v2.4 5. pont (B-009): a beérkezett WAV fejlécének ellenőrzése – a fejléc adatai és a tényleges adatmennyiség (mintavétel, csatornaszám, hossz, méret) */
export function wavInfo(b: Uint8Array): { ok: boolean; rate: number; channels: number; bits: number; dataBytes: number; seconds: number; headerMatches: boolean; note: string } {
  const bad = (note: string) => ({ ok: false, rate: 0, channels: 0, bits: 0, dataBytes: 0, seconds: 0, headerMatches: false, note })
  if (b.length < 44) return bad('túl rövid a fájl')
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength)
  const tag = (o: number) => String.fromCharCode(b[o]!, b[o + 1]!, b[o + 2]!, b[o + 3]!)
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return bad('nem RIFF/WAVE fájl')
  let o = 12, rate = 0, channels = 0, bits = 0, fmt = 0, dataBytes = -1
  while (o + 8 <= b.length) {
    const id = tag(o), size = v.getUint32(o + 4, true)
    if (id === 'fmt ') { fmt = v.getUint16(o + 8, true); channels = v.getUint16(o + 10, true); rate = v.getUint32(o + 12, true); bits = v.getUint16(o + 22, true) }
    if (id === 'data') { dataBytes = size; break }
    o += 8 + size + (size % 2)
  }
  if (dataBytes < 0) return bad('nincs data blokk')
  const actual = b.length - (o + 8)
  const frame = Math.max(1, channels * bits / 8)
  return { ok: fmt === 1 && rate > 0, rate, channels, bits, dataBytes, seconds: dataBytes / frame / Math.max(1, rate), headerMatches: actual === dataBytes, note: fmt === 1 ? '' : 'nem PCM kódolás' }
}

async function transcribe(req: Request, env: Env): Promise<Response> {
  const buf = new Uint8Array(await req.arrayBuffer())
  if (!buf.length) return json({ ok: false, error: 'üres felvétel' }, 400)
  if (buf.length > MAX_AUDIO_BYTES) return json({ ok: false, error: 'a felvétel túl hosszú (legfeljebb ~30 másodperc)' }, 413)
  const prompt = decodeURIComponent(req.headers.get('x-molio-prompt') || '').slice(0, 900)
  // v2.4 12. pont C3: a beszédészlelés (vad_filter) a teszt ági laborban kapcsolható; alapból bekapcsolva
  const vad = req.headers.get('x-molio-vad') !== '0'
  const wav = wavInfo(buf)
  const t0 = Date.now()
  try {
    const out = await withTimeout(env.AI.run(WHISPER_MODEL, { audio: bytesToB64(buf), task: 'transcribe', language: 'hu', vad_filter: vad, initial_prompt: prompt || undefined }), 15_000)
    await quotaAdd(env, COST.whisper)
    // v2.4 17. pont: ha a modell megbízhatósági adatot ad (szakaszonként / szavanként), a teszt ági labor megmutatja
    const segs = Array.isArray(out?.segments) ? out.segments.slice(0, 60).map((s: any) => ({ start: s.start, end: s.end, text: s.text, avg_logprob: s.avg_logprob, no_speech_prob: s.no_speech_prob, compression_ratio: s.compression_ratio, words: Array.isArray(s.words) ? s.words.slice(0, 80).map((w: any) => ({ word: w.word, probability: w.probability, start: w.start, end: w.end })) : undefined })) : undefined
    const info = out?.transcription_info ? { language: out.transcription_info.language, language_probability: out.transcription_info.language_probability, duration: out.transcription_info.duration, duration_after_vad: out.transcription_info.duration_after_vad } : undefined
    return json({ ok: true, text: String(out?.text || '').trim(), model: 'Whisper large-v3-turbo', leftPct: leftPct(await quotaGet(env)),
      diag: { ms: Date.now() - t0, bytes: buf.length, wav, vad, promptChars: prompt.length, segments: segs, info, keys: out && typeof out === 'object' ? Object.keys(out) : [] } })
  } catch (e) { return json({ ok: false, error: String((e as Error).message || e), diag: { ms: Date.now() - t0, bytes: buf.length, wav, vad, promptChars: prompt.length } }, 502) }
}

const SYSTEM = `Te egy fogorvosi diktálás értelmező vagy. A bemenet egy magyar nyelvű, kimondott kezelési jegyzet átirata. A feladatod: strukturált tételeket adni, KIZÁRÓLAG a megadott kódkészletekből választva.
Szabályok: fogszám csak FDI (11–48, tejfog 51–85); felszín csak M, O, D, V, L; a művelet (typeId) és az anyag (item) kizárólag a kapott listák azonosítói lehetnek; nem létezőt ne találj ki. Ha valami nem dönthető el, hagyd ki. A „szükséges / javasolt / kell” jelzésű tétel status értéke "suggested", a már elvégzetté "done". Betegazonosító adatot ne adj vissza.
Válaszod KIZÁRÓLAG egy JSON objektum: {"items":[{"tooth":36|null,"typeId":"...","surfaces":["M","O"],"status":"done|suggested","urgency":"urgent|recommended|later|null"}],"materials":[{"item":"...","qty":2}]}`

async function interpret(req: Request, env: Env): Promise<Response> {
  let body: { text?: string; types?: { id: string; name: string }[]; items?: { id: string; name: string; unit: string }[]; planned?: { tooth: number | null; typeId: string }[]; chart?: Record<string, string[]> }
  try { body = await req.json() } catch { return json({ ok: false, error: 'hibás kérés' }, 400) }
  const text = String(body.text || '').slice(0, 1500)
  if (!text.trim()) return json({ ok: false, error: 'nincs szöveg' }, 400)
  const used = await quotaGet(env)
  if (used !== null && used >= DAILY_NEURONS) return json({ ok: false, error: 'a mai AI-keret elfogyott', exhausted: true, leftPct: 0 }, 429)
  const model = env.AI_MODEL || DEFAULT_LLM
  const user = `Kezelési típusok (typeId – név): ${(body.types || []).map(t => `${t.id} – ${t.name}`).join('; ')}\nAnyagok (item – név, egység): ${(body.items || []).map(i => `${i.id} – ${i.name} (${i.unit})`).join('; ')}\nElőjegyzett tételek: ${JSON.stringify(body.planned || [])}\nA páciens fogtérképének releváns állapota: ${JSON.stringify(body.chart || {})}\n\nDiktált szöveg:\n"""${text}"""`
  const t0 = Date.now()
  try {
    const out = await withTimeout(env.AI.run(model, { messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }], max_tokens: 700, temperature: 0, response_format: { type: 'json_object' } }), 10_000)
    await quotaAdd(env, COST.llm)
    const raw = typeof out?.response === 'string' ? out.response : JSON.stringify(out?.response ?? out)
    const m = raw.match(/\{[\s\S]*\}/)
    const parsed = m ? JSON.parse(m[0]) : null
    if (!parsed) return json({ ok: false, error: 'a modell válasza nem értelmezhető' }, 502)
    return json({ ok: true, model, result: parsed, leftPct: leftPct(await quotaGet(env)), ms: Date.now() - t0 })
  } catch (e) { return json({ ok: false, error: String((e as Error).message || e) }, 502) }
}

async function logEntries(req: Request, env: Env): Promise<Response> {
  let body: { device?: string; entries?: unknown[] }
  try { body = await req.json() } catch { return json({ ok: false }, 400) }
  const entries = Array.isArray(body.entries) ? body.entries.slice(0, 50) : []
  if (!env.MOLIO_LOG) return json({ ok: true, stored: false, note: 'a központi tároló (MOLIO_LOG) nincs bekötve – a bejegyzések az eszközön várakoznak' }, 202)
  const dev = String(body.device || '').slice(0, 24)
  // írás-takarékosság: a köteg egyetlen KV-bejegyzésbe kerül
  const ok = await kvPut(env, `log:${new Date().toISOString()}:${crypto.randomUUID().slice(0, 8)}`, JSON.stringify(entries.map(e => ({ ...(e as object), device_id: dev }))))
  return json({ ok: true, stored: ok, n: entries.length }, ok ? 200 : 202)
}

/* ---------- v2.4 6., 15. pont: tanult javítások és rövidítések (ágak szerint) ---------- */
async function learnSave(req: Request, env: Env, host: string): Promise<Response> {
  let body: { device?: string; speaker?: string; rules?: unknown[]; macros?: unknown[] }
  try { body = await req.json() } catch { return json({ ok: false }, 400) }
  if (!env.MOLIO_LOG) return json({ ok: true, stored: false }, 202)
  const br = branchOf(host)
  const rules = Array.isArray(body.rules) ? body.rules.slice(0, 100) : [], macros = Array.isArray(body.macros) ? body.macros.slice(0, 50) : []
  if (!rules.length && !macros.length) return json({ ok: true, stored: false, n: 0 })
  const ok = await kvPut(env, `learn:${br}:${new Date().toISOString()}:${crypto.randomUUID().slice(0, 8)}`, JSON.stringify({ branch: br, device: String(body.device || '').slice(0, 24), speaker: String(body.speaker || 'demo').slice(0, 40), at: new Date().toISOString(), rules, macros }))
  return json({ ok: true, stored: ok, branch: br }, ok ? 200 : 202)
}
async function learnGet(env: Env, host: string): Promise<Response> {
  const br = branchOf(host)
  // a main ágon tanultak a teszt ágon is érvényesek, fordítva nem
  const prefixes = br === 'teszt' ? ['learn:main:', 'learn:teszt:'] : ['learn:main:']
  const out: unknown[] = []
  for (const p of prefixes) for (const k of (await kvList(env, p, 400)).slice(-300)) { const v = await kvGet(env, k); if (v) { try { out.push(JSON.parse(v)) } catch { /* hibás bejegyzés */ } } }
  return json({ ok: true, branch: br, batches: out })
}

/* ---------- v2.4 12. pont E): próbanapló (csak teszt) ---------- */
async function trialSave(req: Request, env: Env): Promise<Response> {
  let body: unknown
  try { body = await req.json() } catch { return json({ ok: false }, 400) }
  const s = JSON.stringify(body).slice(0, 20000)
  const ok = await kvPut(env, `trial:${new Date().toISOString()}:${crypto.randomUUID().slice(0, 8)}`, s, KEEP_90)
  return json({ ok: true, stored: ok }, ok ? 200 : 202)
}
async function trialGet(env: Env): Promise<Response> {
  const keys = (await kvList(env, 'trial:', 600)).slice(-400)
  const out: unknown[] = []
  for (const k of keys) { const v = await kvGet(env, k); if (v) { try { out.push({ key: k, ...JSON.parse(v) }) } catch { /* hibás */ } } }
  return json({ ok: true, trials: out })
}

/* ---------- v2.4 20. pont: látogatás-napló ---------- */
interface VisitEntry { t: string; ip: string; country?: string; city?: string; ver: string; commit: string; ua: string; branch: string; bot?: boolean }
async function visitLog(req: Request, env: Env, host: string): Promise<Response> {
  try {
    const uaRaw = req.headers.get('user-agent') || ''
    if (isBot(uaRaw)) return json({ ok: true, stored: false, bot: true })
    if (!env.MOLIO_LOG) return json({ ok: true, stored: false })
    let body: { branch?: string; version?: string; commit?: string; ua?: string } = {}
    try { body = await req.json() } catch { /* üres törzs */ }
    const br = branchOf(host)
    const cf = (req as Request & { cf?: { country?: string; city?: string } }).cf || {}
    const e: VisitEntry = { t: new Date().toISOString(), ip: (req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || '').split(',')[0]!.trim().slice(0, 64), country: cf.country, city: cf.city, ver: String(body.version || '').slice(0, 12), commit: String(body.commit || '').slice(0, 12), ua: String(body.ua || '').slice(0, 40), branch: br }
    // egy látogatás = egy írás: az ág napi „vödrébe” kerül (olvasás + írás ugyanarra a kulcsra); napi felső határ
    const key = `visit:${day()}:${br}`
    const cur = JSON.parse(await kvGet(env, key) || '{"list":[]}') as { list: VisitEntry[]; full?: boolean }
    if (cur.full || cur.list.length >= VISIT_DAILY_CAP) return json({ ok: true, stored: false, full: true })
    cur.list.push(e)
    if (cur.list.length >= VISIT_DAILY_CAP) cur.full = true
    const ok = await kvPut(env, key, JSON.stringify(cur), KEEP_90)
    return json({ ok: true, stored: ok })
  } catch { return json({ ok: true, stored: false }) }
}
async function visitRead(env: Env): Promise<Response> {
  const keys = await kvList(env, 'visit:', 400)
  const days: { day: string; branch: string; list: VisitEntry[]; full: boolean }[] = []
  for (const k of keys) { const v = await kvGet(env, k); if (!v) continue; try { const j = JSON.parse(v); const [, d, b] = k.split(':'); days.push({ day: d!, branch: b!, list: j.list || [], full: !!j.full }) } catch { /* hibás */ } }
  const names = JSON.parse(await kvGet(env, 'visitnames') || '{}')
  return json({ ok: true, days, names, cap: VISIT_DAILY_CAP, kv: !!env.MOLIO_LOG })
}
async function visitClear(env: Env): Promise<Response> {
  const keys = await kvList(env, 'visit:', 400)
  let n = 0; for (const k of keys) if (await kvDel(env, k)) n++
  return json({ ok: true, deleted: n })
}
async function visitName(req: Request, env: Env): Promise<Response> {
  let body: { ip?: string; name?: string; own?: boolean }
  try { body = await req.json() } catch { return json({ ok: false }, 400) }
  const names = JSON.parse(await kvGet(env, 'visitnames') || '{}') as Record<string, { name: string; own: boolean }>
  const ip = String(body.ip || '').slice(0, 64); if (!ip) return json({ ok: false }, 400)
  if (!body.name && !body.own) delete names[ip]; else names[ip] = { name: String(body.name || '').slice(0, 40), own: !!body.own }
  const ok = await kvPut(env, 'visitnames', JSON.stringify(names))
  return json({ ok, names })
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req)
    if (!sameOrigin(req)) return json({ ok: false, error: 'tiltott eredet' }, 403)
    const host = url.host, test = isTestHost(host)
    const device = (req.headers.get('x-molio-device') || 'ismeretlen').slice(0, 40)
    const p = url.pathname
    if (p === '/api/diktalas/keret' && req.method === 'GET') return json({ ok: true, leftPct: leftPct(await quotaGet(env)), model: env.AI_MODEL || DEFAULT_LLM })
    if (p === '/api/diktalas/tanult-javitas' && req.method === 'GET') return learnGet(env, host)
    // a teszt ági olvasó végpontok a main gazdagépen nem léteznek
    if (p === '/api/latogatas' && req.method === 'GET') return test ? visitRead(env) : json({ ok: false, error: 'ismeretlen végpont' }, 404)
    if (p === '/api/latogatas' && req.method === 'DELETE') return test ? visitClear(env) : json({ ok: false, error: 'ismeretlen végpont' }, 404)
    if (p === '/api/diktalas/proba' && req.method === 'GET') return test ? trialGet(env) : json({ ok: false, error: 'ismeretlen végpont' }, 404)
    if (req.method !== 'POST') return json({ ok: false, error: 'csak POST' }, 405)
    if (p === '/api/latogatas') return visitLog(req, env, host)
    if (p === '/api/latogatas/nev') return test ? visitName(req, env) : json({ ok: false, error: 'ismeretlen végpont' }, 404)
    if (p === '/api/diktalas/naplo') return logEntries(req, env)
    if (p === '/api/diktalas/tanult-javitas') return learnSave(req, env, host)
    if (p === '/api/diktalas/proba') return test ? trialSave(req, env) : json({ ok: false, error: 'ismeretlen végpont' }, 404)
    if (p === '/api/diktalas/atiras' || p === '/api/diktalas/ertelmezes') {
      if (!(await rateLimit(env, device))) return json({ ok: false, error: 'eszközönként legfeljebb 60 kérés / óra', limited: true }, 429)
      return p.endsWith('atiras') ? transcribe(req, env) : interpret(req, env)
    }
    return json({ ok: false, error: 'ismeretlen végpont' }, 404)
  },
}
