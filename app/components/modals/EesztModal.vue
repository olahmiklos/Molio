<script setup lang="ts">
// EESZT-jelentés szemléltetése: a végleges rendszerben a kezelés jóváhagyása után automatikusan megy
import { useDataStore } from '~/stores/data'
import { useOfficeStore } from '~/stores/office'
import { useUiStore } from '~/stores/ui'
import { fmtDate } from '~/utils/dates'
import { eesztPayload } from '~/utils/office'
const props = defineProps<{ recordId: string }>()
const data = useDataStore()
const office = useOfficeStore()
const ui = useUiStore()
const r = computed(() => data.db.records.find(x => x.id === props.recordId)!)
const rows = computed(() => eesztPayload(data.db, r.value))
const busy = ref(false)
function send() {
  busy.value = true
  setTimeout(() => { const ref = office.sendEeszt(props.recordId); busy.value = false; ui.toast('Beküldve (szimulált) – azonosító: ' + ref) }, 900)
}
</script>

<template>
  <ModalShell title="EESZT – ellátási esemény jelentése" wide>
    <div class="ai-note" style="margin-top:0">
      <b>Szemléltetés.</b> A demó nem kapcsolódik az Elektronikus Egészségügyi Szolgáltatási Térhez, semmi nem megy ki.
      A végleges rendszerben a kezelés jóváhagyásakor a program automatikusan összeállítja és beküldi az ellátási eseményt és az ambuláns lapot – az orvosnak és az asszisztensnek nem kell külön felületen rögzítenie.
      (Az éles bekötéshez az EESZT-csatlakozás engedélyeztetése és tanúsítása szükséges.)
    </div>
    <div class="kv" style="grid-template-columns:200px 1fr">
      <template v-for="[k, v] in rows" :key="k"><div>{{ k }}</div><div><b>{{ v }}</b></div></template>
      <div>Állapot</div>
      <div>
        <span v-if="r.eeszt?.status === 'sent'" class="badge b-green">✓ beküldve {{ r.eeszt.sentAt ? fmtDate(r.eeszt.sentAt) : '' }} · {{ r.eeszt.ref }}</span>
        <span v-else class="badge b-yellow">beküldésre vár</span>
      </div>
    </div>
    <template #foot>
      <div class="spacer" />
      <button class="btn" @click="ui.close()">Bezárás</button>
      <button v-if="r.eeszt?.status !== 'sent'" class="btn pri" :disabled="busy" @click="send">{{ busy ? 'Küldés…' : 'Beküldés (szimulált)' }}</button>
    </template>
  </ModalShell>
</template>
