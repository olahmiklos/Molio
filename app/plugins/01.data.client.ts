// Indításkor betölti az adatokat a böngésző tárolójából (első megnyitáskor mintaadatokkal indul)
import { useDataStore } from '~/stores/data'

export default defineNuxtPlugin(async () => {
  await useDataStore().load()
})
