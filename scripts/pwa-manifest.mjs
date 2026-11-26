// v2.5 1. pont (B-008) kiegészítés: a service worker precache-listájának átalakítása.
// Az @vite-pwa/nuxt alapértelmezett átalakítását (HTML → „tiszta” URL, a builds/meta fájlok revision nélkül) váltja ki úgy,
// hogy a /_nuxt/builds/latest.json NEM kerül a precache-be: a Worker erre szándékosan 404-et ad (régi nyitott oldalak Nuxt-figyelője
// ne töltsön újra csendben), a 404-es precache-elem pedig a Workboxban „bad-precaching-response” hibát okozna, és a service worker
// nem települne. A builds/meta/<id>.json megmarad (a statikus tárhely kiszolgálja).
export const LATEST = '_nuxt/builds/latest.json'
const UUID_JSON = /(\/)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.json$/i

/** a precache-bejegyzések átalakítása (tiszta függvény, tesztelhető) */
export function transformEntries(entries, base = '/') {
  const out = []
  for (const e0 of entries) {
    const e = { ...e0 }
    const url = e.url.startsWith('/') ? e.url.slice(1) : e.url
    if (url === LATEST || url.endsWith('/builds/latest.json')) continue
    if (url.endsWith('.html')) {
      if (url === 'index.html') e.url = base
      else { const parts = url.split('/'); parts[parts.length - 1] = parts[parts.length - 1].replace(/\.html$/, ''); e.url = parts.join('/') }
    }
    if (url.startsWith('_nuxt/builds/') && UUID_JSON.test(url)) e.revision = null
    out.push(e)
  }
  return out
}
/** a Workbox manifestTransforms formája */
export const manifestTransform = (base = '/') => async entries => ({ manifest: transformEntries(entries, base), warnings: [] })
