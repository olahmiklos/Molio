// A program verziója és a specifikáció, amely alapján készült
export const APP_VERSION = '2.0.0'
/** a program neve és verziója Molio 2.0 marad; a specifikáció verziója v2.1 */
export const APP_LABEL = 'Molio 2.0 – bemutató (demó) verzió'
export const BUILD_DATE = '2026-11-19'
export const BUILD_DATE_HU = '2026. november 19.'
export const SPEC = {
  title: 'Molio_fogorvosi_szoftver_specifikacio_v2.1',
  name: 'Molio — Fogorvosi Szoftver — Funkcionális Specifikáció',
  version: 'v2.1',
  /** a specifikáció utolsó módosítása */
  date: '2026. november 19.',
}
/** a felületi verziójelzés: „Molio 2.0 – a specifikáció v2.1 alapján készült” + build dátuma */
export const VERSION_LINE = `Molio ${APP_VERSION.replace(/\.0$/, '')} – a specifikáció ${SPEC.version} alapján készült`
/** a demóban egy diktálás-gombnyomás legfeljebb ennyi másodpercig rögzít (a végleges változatban hosszabb diktálás engedélyezett) */
export const DICTATION_LIMIT_S = 30
/** a felhasználói kézikönyv (a buildkor készül a docs/kezikonyv.md-ből) */
export const MANUAL = { pdf: '/kezikonyv/Molio_felhasznaloi_kezikonyv.pdf', meta: '/kezikonyv/meta.json' }
