// @ts-nocheck – Node-szkript (vite-node), a típusellenőrzés a felületi kódra vonatkozik
// Kiadás előtti tesztfelvétel (spec v2.4 5. pont, B-009): a repóban verziózott, ismert felvételeket (tests/fixtures/hang/) elküldi a Worker
// átirat-végpontjára, és a Whisper szövegét a várt átirattal veti össze (szó-szintű egyezés). Megfelelő: legalább kb. 80%.
// Ennél nagyobb eltérésnél 2-es kilépési kóddal megáll – a kitelepítés a v2.3 16. pont szerinti megállási szabály szerint nem folytatódik automatikusan, a felhasználó dönt.
// Futtatás: npm run hangproba -- --url https://teszt-molio.<fiók>.workers.dev   (a Worker eredet-ellenőrzése miatt az Origin fejléc az URL gazdája)
//           opcionálisan: --prompt mondat|lista|nincs   --vad 0|1   --json eredmeny.json
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { wordAccuracy, RELEASE_THRESHOLD } from '../app/utils/dict/quality'
import { buildPrompt, type PromptStyle } from '../app/utils/dict/prompt'
import { defaultItems, defaultTypes } from '../app/utils/defaults'
import { wavInfo } from '../worker/index'

const arg = (k: string) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : undefined }
const url = (arg('url') || process.env.MOLIO_URL || '').replace(/\/$/, '')
if (!url) { console.error('Add meg a Worker címét: --url https://teszt-molio.<fiók>.workers.dev'); process.exit(1) }
const dir = join(process.cwd(), 'tests/fixtures/hang')
const spec = JSON.parse(readFileSync(join(dir, 'varhato.json'), 'utf8')) as { kuszob: number; felvetelek: { fajl: string; szoveg: string }[] }
const style = (arg('prompt') || 'mondat') as PromptStyle
const prompt = buildPrompt({ plannedTypes: [], types: defaultTypes(), items: defaultItems(), learned: [], style })
const th = spec.kuszob || RELEASE_THRESHOLD
const out: { fajl: string; varhato: string; kapott: string; egyezes: number; wav: ReturnType<typeof wavInfo>; ms: number; hiba?: string }[] = []
for (const f of spec.felvetelek) {
  const buf = readFileSync(join(dir, f.fajl))
  const wav = wavInfo(new Uint8Array(buf))
  const t0 = Date.now()
  try {
    const r = await fetch(url + '/api/diktalas/atiras', { method: 'POST', body: buf, headers: { 'content-type': 'audio/wav', origin: url, 'x-molio-prompt': encodeURIComponent(prompt), 'x-molio-device': 'hangproba', 'x-molio-vad': arg('vad') === '0' ? '0' : '1' } })
    const j = await r.json() as { ok?: boolean; text?: string; error?: string }
    const text = j.ok ? String(j.text || '') : ''
    out.push({ fajl: f.fajl, varhato: f.szoveg, kapott: text, egyezes: wordAccuracy(f.szoveg, text).ratio, wav, ms: Date.now() - t0, hiba: j.ok ? undefined : j.error || String(r.status) })
  } catch (e) { out.push({ fajl: f.fajl, varhato: f.szoveg, kapott: '', egyezes: 0, wav, ms: Date.now() - t0, hiba: String((e as Error).message || e) }) }
}
for (const o of out) console.log(`${o.egyezes >= th ? '✓' : '✗'} ${o.fajl}: ${Math.round(o.egyezes * 100)}% (${o.ms} ms)\n   várt:   ${o.varhato}\n   kapott: ${o.kapott || '–'}${o.hiba ? '\n   hiba: ' + o.hiba : ''}`)
const json = arg('json'); if (json) writeFileSync(json, JSON.stringify({ url, prompt: style, kuszob: th, eredmeny: out }, null, 1))
const bad = out.filter(o => o.egyezes < th)
if (bad.length) { console.error(`\nA tesztfelvétel ${bad.length} esetben a ${Math.round(th * 100)}%-os küszöb alatt maradt – a kitelepítés nem folytatódik automatikusan, a felhasználó dönt.`); process.exit(2) }
console.log('\nA tesztfelvétel megfelelt.')
