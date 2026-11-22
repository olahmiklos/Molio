// A program verziója és a specifikáció, amely alapján készült
declare const __MOLIO_BUILD__: { commit: string; branch: string; builtAt: string } | undefined

export const APP_VERSION = '2.3.0'
/** a verziójelzés alapja: demó v2.3, a specifikáció v2.3 alapján */
export const APP_LABEL = 'Molio – bemutató (demó) verzió v2.3'
export const SPEC = {
  title: 'Molio_fogorvosi_szoftver_specifikacio_v2.3',
  name: 'Molio — Fogorvosi Szoftver — Funkcionális Specifikáció',
  version: 'v2.3',
  /** a specifikáció utolsó módosítása */
  date: '2026. november 22.',
}

/** a buildkor (nuxt.config.ts) a ténylegesen fordított kódból kerül be: build ideje, ág és commit; nem kézzel írt szöveg */
export interface BuildInfo { commit: string; short: string; branch: string; builtAt: string; env: 'TESZT' | 'DEMÓ' | 'FEJLESZTŐI' }
export function buildInfo(): BuildInfo {
  const b = typeof __MOLIO_BUILD__ !== 'undefined' ? __MOLIO_BUILD__ : { commit: '', branch: '', builtAt: new Date().toISOString() }
  // a main ág a nyilvános (ügyfeleknek szóló) demó, minden más ág tesztkörnyezet
  const env: BuildInfo['env'] = b.branch === 'main' ? 'DEMÓ' : b.branch ? 'TESZT' : 'FEJLESZTŐI'
  return { commit: b.commit, short: b.commit.slice(0, 7), branch: b.branch, builtAt: b.builtAt, env }
}
const HU_DATE = (iso: string) => new Intl.DateTimeFormat('hu-HU', { timeZone: 'Europe/Budapest', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(iso))
const HU_TIME = (iso: string) => new Intl.DateTimeFormat('hu-HU', { timeZone: 'Europe/Budapest', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
const ISO_DAY = (iso: string) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Budapest' }).format(new Date(iso))
/** a build dátuma és ideje (budapesti idő szerint) */
export const BUILD_DATE = ISO_DAY(buildInfo().builtAt)
export const BUILD_DATE_HU = HU_DATE(buildInfo().builtAt)
export const BUILD_TIME_HU = `${HU_DATE(buildInfo().builtAt)} ${HU_TIME(buildInfo().builtAt)}`
/** a felületi verziójelzés: „Demó v2.3 – a specifikáció v2.3 alapján készült” (a build dátumával együtt jelenik meg) */
export const VERSION_LINE = `Demó v${APP_VERSION.replace(/\.0$/, '')} – a specifikáció ${SPEC.version} alapján készült`
/** rövid jelvény a láblécben és a bejelentkezési képernyőn: „v2.3 · spec 2.3 · 2026-11-22” */
export const VERSION_BADGE = `v${APP_VERSION.replace(/\.0$/, '')} · spec ${SPEC.version.slice(1)} · ${BUILD_DATE}`
/** a verzióadatok másolható, szöveges formában (hibabejelentéshez) */
export function versionReport(dataVersion: number): string {
  const b = buildInfo()
  return [VERSION_LINE, `Program: Molio ${APP_VERSION}`, `Specifikáció: ${SPEC.title}`, `Kiadás: ${BUILD_TIME_HU}`, `Környezet: ${b.env}${b.branch ? ' (' + b.branch + ' ág)' : ''}`, `Adatverzió: ${dataVersion}`, `Build: ${b.short || 'ismeretlen'}`].join('\n')
}
/** a demóban egy diktálás-gombnyomás legfeljebb ennyi másodpercig rögzít (a végleges változatban hosszabb diktálás engedélyezett) */
export const DICTATION_LIMIT_S = 30
/** a felhasználói kézikönyv (a buildkor készül a docs/kezikonyv.md-ből) */
export const MANUAL = { pdf: '/kezikonyv/Molio_felhasznaloi_kezikonyv.pdf', meta: '/kezikonyv/meta.json' }
