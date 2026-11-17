// Csatolt fájlok elérése a böngésző tárolójából (object URL gyorsítótárral)
import { useRepository } from '~/repositories'

const URLS: Record<string, string> = {}
const urls = reactive<Record<string, string>>({})

export function useFiles() {
  async function urlOf(id: string) {
    if (URLS[id]) return URLS[id]
    const b = await useRepository().getFile(id)
    if (!b) return null
    URLS[id] = URL.createObjectURL(b)
    urls[id] = URLS[id]!
    return URLS[id]!
  }
  /** reaktív: a kép betöltése után magától frissül */
  function url(id: string | null | undefined) {
    if (!id) return ''
    if (!urls[id]) urlOf(id)
    return urls[id] || ''
  }
  async function blobOf(id: string) { return useRepository().getFile(id) }
  return { urlOf, url, blobOf }
}
