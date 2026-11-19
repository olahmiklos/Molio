<script setup lang="ts">
// Verzió és frissítés (spec v2.2, 3. pont): verziójelzés, build adatai, „Frissítés keresése”, másolható adatok, TESZT/DEMÓ jelölés
import { useDataStore } from '~/stores/data'
import { useUiStore } from '~/stores/ui'
import { APP_VERSION, BUILD_TIME_HU, SPEC, VERSION_LINE, buildInfo, versionReport } from '~/utils/meta'

const data = useDataStore()
const ui = useUiStore()
const { $pwa } = useNuxtApp() as any
const b = buildInfo()
const state = ref<'idle' | 'checking' | 'latest' | 'found' | 'unsupported'>('idle')
const report = computed(() => versionReport(data.db.version))

async function check() {
  state.value = 'checking'
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    if (!reg) { state.value = 'unsupported'; return }
    await reg.update()
    await new Promise(r => setTimeout(r, 1500))
    if (reg.waiting || $pwa?.needRefresh) state.value = 'found'
    else state.value = 'latest'
  } catch { state.value = 'unsupported' }
}
/** az új service worker átvétele: a tárolt adatok megmaradnak, csak a program kódja cserélődik */
function swap() {
  ui.toast('Frissítés…')
  $pwa?.updateServiceWorker?.(true)
  setTimeout(() => window.location.reload(), 2500)
}
async function copy() {
  try { await navigator.clipboard.writeText(report.value); ui.toast('Verzióadatok a vágólapra másolva') }
  catch { ui.toast('A másolás nem sikerült – jelöld ki és másold a szöveget kézzel') }
}
</script>

<template>
  <div>
    <div class="kv">
      <div>Verzió</div><div><b>{{ VERSION_LINE }}</b> <span v-if="b.env !== 'DEMÓ'" class="badge b-yellow">{{ b.env }}</span><span v-else class="badge b-green">DEMÓ</span><br><span class="muted">Molio {{ APP_VERSION }} · {{ SPEC.title }}</span></div>
      <div>Build</div><div>{{ BUILD_TIME_HU }}</div>
      <div v-if="b.env !== 'DEMÓ'">Ág és kód</div><div v-if="b.env !== 'DEMÓ'">{{ b.branch || 'ismeretlen' }} · <code>{{ b.short || 'ismeretlen' }}</code></div>
      <div v-else>Kód</div><div v-if="b.env === 'DEMÓ'"><code>{{ b.short || 'ismeretlen' }}</code> <span class="muted">({{ b.branch }})</span></div>
    </div>
    <div class="row" style="margin-top:10px">
      <button class="btn sm" :disabled="state === 'checking'" @click="check">{{ state === 'checking' ? 'Keresés…' : 'Frissítés keresése' }}</button>
      <button v-if="state === 'found' || $pwa?.needRefresh" class="btn sm pri" @click="swap">Új verzió telepítése és újraindítás</button>
      <button class="btn sm" @click="copy">Verzióadatok másolása</button>
      <span v-if="state === 'latest'" class="small" style="color:var(--green)">✓ A legfrissebb verziót használod.</span>
      <span v-else-if="state === 'found'" class="small" style="color:var(--orange)">Új verzió érhető el.</span>
      <span v-else-if="state === 'unsupported'" class="small muted">Ebben a környezetben (fejlesztői mód, vagy a böngésző nem támogatja) a frissítés keresése nem érhető el.</span>
    </div>
    <textarea class="inp" readonly rows="6" style="margin-top:10px;font-family:monospace;font-size:12px" :value="report" />
  </div>
</template>
