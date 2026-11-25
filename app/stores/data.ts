// Központi adat-store: betölti és menti az adatokat az adatelérési rétegen keresztül.
// A modul-store-ok (páciens, időpont, kezelés, raktár…) erre épülnek.
import { defineStore } from 'pinia'
import { useRepository } from '~/repositories'
import type { DB } from '~/utils/types'
import { DB_VERSION, seed } from '~/utils/seed'
import { migrate } from '~/utils/migrate'
import { setSynonyms } from '~/utils/codesets'
import { ensureV24 } from '~/utils/v24'

export const useDataStore = defineStore('data', () => {
  const db = ref<DB>(null as unknown as DB)
  const ready = ref(false)
  let timer: ReturnType<typeof setTimeout> | null = null
  let stopWatch: (() => void) | null = null

  async function load() {
    const repo = useRepository()
    let loaded = await repo.load().catch(() => null)
    if (loaded && (loaded.version === 4 || loaded.version === 5)) { loaded = migrate(loaded, DB_VERSION); await repo.save(loaded) }
    if (!loaded || loaded.version !== DB_VERSION) {
      if (loaded) await repo.reset()
      loaded = seed()
      await repo.save(loaded)
    }
    // v2.4: a beosztás, a személyzet és a tájékoztató-jóváhagyás mezőinek pótlása (adatvesztés nélkül)
    ensureV24(loaded)
    setSynonyms(loaded.settings.synonyms)
    db.value = loaded
    ready.value = true
    stopWatch?.()
    stopWatch = watch(db, () => scheduleSave(), { deep: true })
  }

  function scheduleSave() {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => { useRepository().save(db.value) }, 250)
  }

  async function reset() {
    const repo = useRepository()
    stopWatch?.()
    await repo.reset()
    const fresh = ensureV24(seed())
    await repo.save(fresh)
    db.value = fresh
    setSynonyms(fresh.settings.synonyms)
    stopWatch = watch(db, () => scheduleSave(), { deep: true })
  }

  return { db, ready, load, reset }
})
