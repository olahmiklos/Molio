import { defineStore } from 'pinia'

export const useAppStore = defineStore('app', () => {
  const name = ref('Molio')
  return { name }
})
