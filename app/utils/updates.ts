// v2.5 1. pont (B-008): az új verziót egyedül a service worker / PWA észleli (betöltéskor, előtérbe kerüléskor, időközönként és a
// „Frissítés keresése” gombbal). A Nuxt beépített elavult-build figyelője minden ágon ki van kapcsolva (nuxt.config.ts → experimental).
// Az utolsó frissítés-ellenőrzés ideje a teszt ági fejlesztői részletekben (Névjegy / Verzió) látszik.
import { ref } from 'vue'

const KEY = 'molio-last-update-check'
export const lastUpdateCheck = ref<string>(typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) || '' : '')
/** a Nuxt elavult-build figyelője ki van-e kapcsolva (a build beállításából; a Névjegy fejlesztői részleteiben jelenik meg) */
export const NUXT_WATCHER_OFF = true

/** a service worker frissítés-ellenőrzése; az időpontot rögzíti (a hibát elnyeli, a frissítés-ellenőrzés nem zavarhat más funkciót) */
export async function checkForUpdate(): Promise<ServiceWorkerRegistration | null> {
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    lastUpdateCheck.value = new Date().toISOString()
    try { localStorage.setItem(KEY, lastUpdateCheck.value) } catch { /* tele a tároló */ }
    if (!reg) return null
    await reg.update()
    return reg
  } catch { return null }
}
