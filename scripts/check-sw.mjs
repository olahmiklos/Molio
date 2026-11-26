// Build utáni ellenőrzés (v2.5 1. pont, B-008): a generált sw.js precache-listájában
// – nem szerepelhet a /_nuxt/builds/latest.json (a Worker 404-et ad rá → a service worker nem települne),
// – minden elemnek léteznie kell a kimenetben (a tiszta URL-ek .html fájlként), különben a telepítés szintén elbukna.
// Használat: node scripts/check-sw.mjs [kimeneti mappa]  (alapértelmezés: .output/public). Hiba esetén 1-es kilépési kóddal áll le.
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

export function precacheUrls(swSource) {
  const urls = []
  const re = /\{\s*"?url"?\s*:\s*[`'"]([^`'"]+)[`'"]/g
  let m
  while ((m = re.exec(swSource))) urls.push(m[1])
  return urls
}
export function checkPrecache(dir) {
  const sw = join(dir, 'sw.js')
  if (!existsSync(sw)) return { ok: false, errors: [`nincs sw.js: ${sw}`], urls: [] }
  const urls = precacheUrls(readFileSync(sw, 'utf8'))
  const errors = []
  if (!urls.length) errors.push('a precache-lista üres vagy nem olvasható')
  for (const u of urls) {
    const p = u.replace(/^\//, '')
    if (/(^|\/)builds\/latest\.json$/.test(p)) { errors.push(`tiltott precache-elem (a Worker 404-et ad rá): ${u}`); continue }
    const f = p === '' ? 'index.html' : p
    if (!existsSync(join(dir, f)) && !existsSync(join(dir, f + '.html')) && !existsSync(join(dir, f, 'index.html'))) errors.push(`a precache-elem nem létezik a kimenetben: ${u}`)
  }
  return { ok: !errors.length, errors, urls }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = resolve(process.argv[2] || '.output/public')
  const r = checkPrecache(dir)
  if (!r.ok) { console.error('[check-sw] HIBA:\n  ' + r.errors.join('\n  ')); process.exit(1) }
  console.log(`[check-sw] rendben: ${r.urls.length} precache-elem, latest.json nincs benne, mind létezik (${dir})`)
}
