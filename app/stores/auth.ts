// Bejelentkezés és szerepkörök (specifikáció 7.2).
// Az 1.0 demóban nincs bejelentkezés és nincsenek szerepkörök: minden funkció egy közös felületről érhető el.
import { defineStore } from 'pinia'

export type Role = 'admin' | 'fogorvos' | 'asszisztens'

export const useAuthStore = defineStore('auth', () => {
  const demo = true
  const user = ref<{ name: string; role: Role } | null>({ name: 'Demó felhasználó', role: 'admin' })
  /** a demóban minden jogosultság megvan */
  const can = (_permission: string) => demo || user.value?.role === 'admin'
  return { demo, user, can }
})
