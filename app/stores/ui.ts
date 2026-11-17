// Felületi állapot: értesítések (toast), modális ablakok, kapcsolat, frissítés
import { defineStore } from 'pinia'
import { markRaw, type Component } from 'vue'

interface ModalEntry { id: number; component: Component; props: Record<string, unknown>; wide?: boolean }
interface ConfirmState { msg: string; yes: string; danger?: boolean; resolve: (v: boolean) => void }

export const useUiStore = defineStore('ui', () => {
  const toastMsg = ref('')
  let toastTimer: ReturnType<typeof setTimeout> | null = null
  const modals = ref<ModalEntry[]>([])
  const confirmState = ref<ConfirmState | null>(null)
  const online = ref(true)
  const updateAvailable = ref(false)
  let updateFn: (() => void) | null = null
  let seq = 0

  function toast(msg: string) {
    toastMsg.value = msg
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(() => { toastMsg.value = '' }, 2800)
  }
  function open(component: Component, props: Record<string, unknown> = {}) {
    modals.value.push({ id: ++seq, component: markRaw(component), props })
  }
  function close() { modals.value.pop() }
  function closeAll() { modals.value = [] }
  function confirm(msg: string, yes = 'Igen', danger = false) {
    return new Promise<boolean>(resolve => { confirmState.value = { msg, yes, danger, resolve } })
  }
  function answer(v: boolean) { const c = confirmState.value; confirmState.value = null; c?.resolve(v) }
  function setUpdate(fn: () => void) { updateFn = fn; updateAvailable.value = true }
  function applyUpdate() { updateAvailable.value = false; updateFn?.() }

  return { toastMsg, modals, confirmState, online, updateAvailable, toast, open, close, closeAll, confirm, answer, setUpdate, applyUpdate }
})
