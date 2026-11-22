// Molio demó – kis Cloudflare Worker a statikus oldal előtt (spec v2.3, 5., 7., 17. pont).
// Csak az /api/* kérések futnak ezen (wrangler.jsonc: assets.run_worker_first); minden más kérés változatlanul a statikus fájlokhoz kerül (env.ASSETS).
//   POST /api/diktalas/atiras      – hang → szöveg (Workers AI: Whisper large-v3-turbo, magyar, szakszó-listával)
//   POST /api/diktalas/ertelmezes  – szöveg → strukturált tételek (Workers AI nyelvi modell), csak a Molio kódkészleteiből választva
//   POST /api/diktalas/naplo       – anonimizált javítási napló központi gyűjtése (Cloudflare KV, ha be van kötve)
//   GET  /api/diktalas/keret       – a napi ingyenes AI-keret becsült állapota
// A hangot és a szöveget a Worker nem tárolja, csak továbbítja. Titkot / API-kulcsot nem használ (AI binding).

interface KV { get(k: string): Promise<string | null>; put(k: string, v: string, o?: { expirationTtl?: number }): Promise<void> }
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
const memCount = new Map<string, number>()
let memQuota = { day: '', used: 0 }

const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })
const day = () => new Date().toISOString().slice(0, 10)

/** csak a saját alkalmazásból érkező kérés (eredet-ellenőrzés): az Origin / Referer gazdája egyezik a Worker gazdájával */
export function sameOrigin(req: Request): boolean {
  const host = new URL(req.url).host
  const o = req.headers.get('origin') || req.headers.get('referer')
  if (!o) return false
  try { return new URL(o).host === host } catch { return false }
}
async function rateLimit(env: Env, device: string): Promise<boolean> {
  const key = `rl:${device}:${new Date().toISOString().slice(0, 13)}`
  let n: number
  if (env.MOLIO_LOG) { n = Number(await env.MOLIO_LOG.get(key) || 0); if (n >= LIMIT_PER_HOUR) return false; await env.MOLIO_LOG.put(key, String(n + 1), { expirationTtl: 4000 }) }
  else { n = memCount.get(key) || 0; if (n >= LIMIT_PER_HOUR) return false; memCount.set(key, n + 1); if (memCount.size > 5000) memCount.clear() }
  return true
}
async function quotaGet(env: Env): Promise<number | null> {
  if (!env.MOLIO_LOG) return memQuota.day === day() ? memQuota.used : null
  const v = await env.MOLIO_LOG.get('quota:' + day()); return v === null ? 0 : Number(v)
}
async function quotaAdd(env: Env, n: number) {
  if (env.MOLIO_LOG) { const cur = Number(await env.MOLIO_LOG.get('quota:' + day()) || 0); await env.MOLIO_LOG.put('quota:' + day(), String(cur + n), { expirationTtl: 172800 }) }
  else { if (memQuota.day !== day()) memQuota = { day: day(), used: 0 }; memQuota.used += n }
}
const leftPct = (used: number | null) => (used === null ? null : Math.max(0, Math.round(100 - (used / DAILY_NEURONS) * 100)))

const bytesToB64 = (b: Uint8Array) => { let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s) }
const withTimeout = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))])

async function transcribe(req: Request, env: Env): Promise<Response> {
  const buf = new Uint8Array(await req.arrayBuffer())
  if (!buf.length) return json({ ok: false, error: 'üres felvétel' }, 400)
  if (buf.length > MAX_AUDIO_BYTES) return json({ ok: false, error: 'a felvétel túl hosszú (legfeljebb ~30 másodperc)' }, 413)
  const prompt = decodeURIComponent(req.headers.get('x-molio-prompt') || '').slice(0, 900)
  try {
    const out = await withTimeout(env.AI.run(WHISPER_MODEL, { audio: bytesToB64(buf), task: 'transcribe', language: 'hu', vad_filter: true, initial_prompt: prompt || undefined }), 15_000)
    await quotaAdd(env, COST.whisper)
    return json({ ok: true, text: String(out?.text || '').trim(), model: 'Whisper large-v3-turbo', leftPct: leftPct(await quotaGet(env)) })
  } catch (e) { return json({ ok: false, error: String((e as Error).message || e) }, 502) }
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
  try {
    const out = await withTimeout(env.AI.run(model, { messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }], max_tokens: 700, temperature: 0, response_format: { type: 'json_object' } }), 10_000)
    await quotaAdd(env, COST.llm)
    const raw = typeof out?.response === 'string' ? out.response : JSON.stringify(out?.response ?? out)
    const m = raw.match(/\{[\s\S]*\}/)
    const parsed = m ? JSON.parse(m[0]) : null
    if (!parsed) return json({ ok: false, error: 'a modell válasza nem értelmezhető' }, 502)
    return json({ ok: true, model, result: parsed, leftPct: leftPct(await quotaGet(env)) })
  } catch (e) { return json({ ok: false, error: String((e as Error).message || e) }, 502) }
}

async function logEntries(req: Request, env: Env): Promise<Response> {
  let body: { device?: string; entries?: unknown[] }
  try { body = await req.json() } catch { return json({ ok: false }, 400) }
  const entries = Array.isArray(body.entries) ? body.entries.slice(0, 50) : []
  if (!env.MOLIO_LOG) return json({ ok: true, stored: false, note: 'a központi tároló (MOLIO_LOG) nincs bekötve – a bejegyzések az eszközön várakoznak' }, 202)
  const dev = String(body.device || '').slice(0, 24)
  for (const e of entries) {
    const id = String((e as { id?: string }).id || crypto.randomUUID())
    await env.MOLIO_LOG.put(`log:${new Date().toISOString()}:${id}`, JSON.stringify({ ...(e as object), device_id: dev }))
  }
  return json({ ok: true, stored: true, n: entries.length })
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req)
    if (!sameOrigin(req)) return json({ ok: false, error: 'tiltott eredet' }, 403)
    const device = (req.headers.get('x-molio-device') || 'ismeretlen').slice(0, 40)
    if (url.pathname === '/api/diktalas/keret' && req.method === 'GET') return json({ ok: true, leftPct: leftPct(await quotaGet(env)), model: env.AI_MODEL || DEFAULT_LLM })
    if (req.method !== 'POST') return json({ ok: false, error: 'csak POST' }, 405)
    if (url.pathname === '/api/diktalas/naplo') return logEntries(req, env)
    if (url.pathname === '/api/diktalas/atiras' || url.pathname === '/api/diktalas/ertelmezes') {
      if (!(await rateLimit(env, device))) return json({ ok: false, error: 'eszközönként legfeljebb 60 kérés / óra', limited: true }, 429)
      return url.pathname.endsWith('atiras') ? transcribe(req, env) : interpret(req, env)
    }
    return json({ ok: false, error: 'ismeretlen végpont' }, 404)
  },
}
