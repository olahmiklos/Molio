<script setup lang="ts">
// Jóváhagyás után: készletfigyelmeztetés és a fogazati státusz frissítésének felajánlása
// (tömés után tömött, húzás után hiányzik, gyökérkezelés után gyökérkezelt, korona után korona)
import { usePatientStore } from '~/stores/patient'
import { useUiStore } from '~/stores/ui'
import { STATUS_STYLE } from '~/utils/defaults'
import { toothLabel } from '~/utils/teeth'
import PatientInfoModal from './PatientInfoModal.vue'

const props = defineProps<{ warns: { level: 'err' | 'warn'; text: string }[]; statusOffer: Record<string, string[]>; patientId: string; recordId?: string; hasInfo?: boolean }>()
const patients = usePatientStore()
const ui = useUiStore()
const chosen = ref<string[]>(Object.keys(props.statusOffer))
const toggle = (n: string) => { chosen.value = chosen.value.includes(n) ? chosen.value.filter(x => x !== n) : [...chosen.value, n] }
function applyStatus() {
  const patch: Record<string, string[]> = {}
  chosen.value.forEach(n => { patch[n] = props.statusOffer[n]! })
  if (Object.keys(patch).length) { patients.addStatus(props.patientId, patch, 'Kezelés után frissítve'); ui.toast('Fogazati státusz frissítve') }
  ui.close()
}
</script>

<template>
  <ModalShell title="Kezelés mentve">
    <template v-if="warns.length">
      <h3>Készletfigyelmeztetés</h3>
      <div v-for="(w, i) in warns" :key="i" :class="w.level">{{ w.text }}</div>
    </template>
    <div v-if="hasInfo && recordId" class="ai-note row" style="margin:0 0 10px">
      <span><b>Elkészült a páciens-tájékoztató vázlata.</b> Átnézés és orvosi jóváhagyás után küldhető ki.</span>
      <button class="btn sm pri" @click="ui.close(); ui.open(PatientInfoModal, { recordId })">Megnyitás</button>
    </div>
    <template v-if="Object.keys(statusOffer).length">
      <h3 style="margin-top:12px">Frissíted az érintett fogak státuszát?</h3>
      <div class="row">
        <label v-for="(st, n) in statusOffer" :key="n" class="chip" :class="{ on: chosen.includes(String(n)) }" @click.prevent="toggle(String(n))">{{ toothLabel(Number(n)) }}: {{ st.map(s => STATUS_STYLE[s]?.label || s).join(', ') }}</label>
      </div>
    </template>
    <template #foot>
      <button v-if="warns.length" class="btn" @click="ui.close(); navigateTo('/raktar')">Raktár megnyitása</button>
      <div class="spacer" />
      <button class="btn" @click="ui.close()">{{ Object.keys(statusOffer).length ? 'Nem' : 'Rendben' }}</button>
      <button v-if="Object.keys(statusOffer).length" class="btn pri" @click="applyStatus">Státusz frissítése</button>
    </template>
  </ModalShell>
</template>
