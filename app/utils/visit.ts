// Látogatás-napló (spec v2.4 20. pont): a program betöltődésekor látogatásonként egyszer jelez a Workernek (POST /api/latogatas).
// Új látogatás: ha az előző jelzés ugyanarról az eszközről ugyanarra az ágra több mint 30 perccel korábbi (a böngésző érvényesíti, hogy a KV írás-keret ne fogyjon).
// Az IP-címet és a közelítő helyet a Worker olvassa a kérésből; páciens- vagy alkalmazásadat nem kerül a naplóba. A hiba nem zavar más funkciót.
import { APP_VERSION, BRANCH_TAG, buildInfo } from './meta'

export const VISIT_GAP_MIN = 30
const KEY = 'molio-visit-v24'

/** „Safari · iPhone” jellegű rövid böngésző- és eszközleírás a böngésző azonosítójából */
export function shortUA(ua: string): string {
  const dev = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Macintosh|Mac OS X/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'egyéb'
  const br = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'egyéb'
  return `${br} · ${dev}`
}
/** új látogatás-e (30 perces inaktivitás után) */
export function isNewVisit(lastIso: string | null, now = Date.now()): boolean {
  if (!lastIso) return true
  const t = Date.parse(lastIso)
  return !Number.isFinite(t) || now - t > VISIT_GAP_MIN * 60000
}
export async function logVisit(): Promise<void> {
  try {
    if (typeof window === 'undefined' || typeof navigator === 'undefined' || !navigator.onLine) return
    // automatizált böngésző (pl. tesztelő robot) nem ír a naplóba
    if ((navigator as Navigator & { webdriver?: boolean }).webdriver) return
    const branch = BRANCH_TAG()
    const k = KEY + ':' + branch
    const last = localStorage.getItem(k)
    if (!isNewVisit(last)) { localStorage.setItem(k, new Date().toISOString()); return }
    localStorage.setItem(k, new Date().toISOString())
    const b = buildInfo()
    await fetch('/api/latogatas', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ branch, version: 'v' + APP_VERSION.replace(/\.0$/, ''), commit: b.short || '', ua: shortUA(navigator.userAgent) }), keepalive: true })
  } catch { /* a látogatás-napló hibája lenyelődik */ }
}
