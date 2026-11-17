// Adatelérési réteg (specifikáció 6.2): a store-ok csak ezen keresztül érik el az adatokat.
// Két megvalósítás: a nyilvános demó a böngésző tárolóját (IndexedDB) használja,
// a végleges rendszer a szerver REST API-ját (Nitro + Prisma + PostgreSQL).
import { clear, createStore, del, get, set } from 'idb-keyval'
import type { DB } from '~/utils/types'

export interface DataRepository {
  readonly kind: 'browser' | 'api'
  load(): Promise<DB | null>
  save(db: DB): Promise<void>
  reset(): Promise<void>
  putFile(id: string, blob: Blob): Promise<boolean>
  getFile(id: string): Promise<Blob | null>
  deleteFile(id: string): Promise<void>
}

const KEY = 'molio-demo-db'

/** böngészős tároló a demóhoz: az adatok csak ezen az eszközön és ebben a böngészőben vannak meg */
export function createBrowserRepository(): DataRepository {
  const dataStore = typeof indexedDB !== 'undefined' ? createStore('molio-demo', 'data') : null
  const fileStore = typeof indexedDB !== 'undefined' ? createStore('molio-demo-files', 'files') : null
  const mem: Record<string, Blob> = {}
  let memDb: DB | null = null
  return {
    kind: 'browser',
    async load() {
      if (!dataStore) return memDb
      try { return (await get<DB>(KEY, dataStore)) || null } catch { return memDb }
    },
    async save(db) {
      const plain = JSON.parse(JSON.stringify(db)) as DB
      memDb = plain
      if (!dataStore) return
      try { await set(KEY, plain, dataStore) } catch (e) { console.warn('Mentés sikertelen', e) }
    },
    async reset() {
      memDb = null
      Object.keys(mem).forEach(k => delete mem[k])
      try { if (dataStore) await del(KEY, dataStore); if (fileStore) await clear(fileStore) } catch { /* nincs teendő */ }
    },
    async putFile(id, blob) {
      if (!fileStore) { mem[id] = blob; return false }
      try { await set(id, blob, fileStore); return true } catch { mem[id] = blob; return false }
    },
    async getFile(id) {
      if (mem[id]) return mem[id]!
      if (!fileStore) return null
      try { return (await get<Blob>(id, fileStore)) || null } catch { return null }
    },
    async deleteFile(id) {
      delete mem[id]
      try { if (fileStore) await del(id, fileStore) } catch { /* nincs teendő */ }
    },
  }
}

/** a végleges rendszer: a szerver API-ja (a demóban nem használt) */
export function createApiRepository(base = '/api'): DataRepository {
  return {
    kind: 'api',
    load: () => $fetch<DB>(`${base}/snapshot`),
    save: db => $fetch(`${base}/snapshot`, { method: 'PUT', body: db }).then(() => undefined),
    reset: () => $fetch(`${base}/snapshot`, { method: 'DELETE' }).then(() => undefined),
    putFile: (id, blob) => $fetch(`${base}/documents/${id}`, { method: 'PUT', body: blob }).then(() => true),
    getFile: id => $fetch<Blob>(`${base}/documents/${id}`, { responseType: 'blob' }),
    deleteFile: id => $fetch(`${base}/documents/${id}`, { method: 'DELETE' }).then(() => undefined),
  }
}

let repo: DataRepository | null = null
export function useRepository(): DataRepository {
  if (!repo) {
    const source = useRuntimeConfig().public.dataSource
    repo = source === 'api' ? createApiRepository() : createBrowserRepository()
  }
  return repo
}
