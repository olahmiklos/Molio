<script setup lang="ts">
// Verzió és frissítés (spec v2.2, 3. pont): verziójelzés, build adatai, „Frissítés keresése”, másolható adatok, TESZT/DEMÓ jelölés
import { useDataStore } from '~/stores/data'
import { useUiStore } from '~/stores/ui'
import acc from '~/data/accuracy.json'
import { useDictStore } from '~/stores/dict'
import { useVoiceStore } from '~/stores/voice'
import { AI_MODEL_LABEL, WHISPER_MODEL } from '~/utils/dict/prompt'
import { APP_VERSION, BUILD_TIME_HU, SPEC, VERSION_LINE, buildInfo, versionReport } from '~/utils/meta'

const data = useDataStore()
const ui = useUiStore()
const { $pwa } = useNuxtApp() as any
const b = buildInfo()
const state = ref<'idle' | 'checking' | 'latest' | 'found' | 'unsupported'>('idle')
const dict = useDictStore(), voice = useVoiceStore()
onMounted(() => { dict.init(); void voice.probe() })
const recognizer = computed(() => dict.s.prefs.recognizer === 'whisper' ? `Pontos felismerés (Whisper – ${WHISPER_MODEL})` : 'Alap felismerés (a böngésző saját felismerője)')
const aiLine = computed(() => `${AI_MODEL_LABEL} – ${dict.s.prefs.ai ? 'be van kapcsolva' : 'ki van kapcsolva (kísérleti)'}`)
const accLine = computed(() => `Diktálás-értelmezés pontossága: ${String(acc.total).replace('.', ',')}% – tesztkészlet: ${acc.examples} példa${acc.prev ? ` (előző kiadás: ${String(acc.prev.total).replace('.', ',')}%)` : ''}`)
const report = computed(() => [versionReport(data.db.version), `Felismerő: ${recognizer.value}`, `AI-értelmezés: ${aiLine.value}`, accLine.value].join('\n'))

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
      <div>Felismerő</div><div>{{ recognizer }}</div>
      <div>AI-értelmezés</div><div>{{ aiLine }}</div>
      <div>Pontosság</div><div>{{ accLine }}<br><span class="muted small">kategóriánként: <template v-for="(v, k) in acc.byCat" :key="k">{{ k }} {{ String(v).replace('.', ',') }}% · </template></span></div>
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
