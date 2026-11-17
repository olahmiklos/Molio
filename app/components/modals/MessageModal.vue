<script setup lang="ts">
// Emlékeztető előnézete – a demóban üzenet nem megy ki, csak a szimulált küldés látszik
import { useDataStore } from '~/stores/data'
import { useAppointmentStore } from '~/stores/appointment'
import { useUiStore } from '~/stores/ui'
import { fmtDT } from '~/utils/dates'
import { fillTpl, remindInfo } from '~/utils/logic'

const props = defineProps<{ id: string }>()
const data = useDataStore()
const ap = useAppointmentStore()
const ui = useUiStore()
const db = computed(() => data.db)
const a = computed(() => ap.byId(props.id)!)
const p = computed(() => db.value.patients.find(x => x.id === a.value.patientId)!)
const n = computed(() => db.value.settings.notify)
const ri = computed(() => remindInfo(a.value))
const sms = computed(() => fillTpl(db.value, n.value.smsTpl, a.value))
function send() { ap.sendNow(props.id); ui.close(); ui.toast('Emlékeztető elküldve (demó – ténylegesen nem ment ki)') }
function confirmIt() { ap.toggleConfirm(props.id); ui.toast(a.value.confirmed ? 'Visszaigazolva – a kockázat csökkent' : 'Visszaigazolás törölve') }
</script>

<template>
  <ModalShell :title="`Emlékeztető – ${p.name}`" wide>
    <div class="hint">
      Demó: az üzenet nem megy ki ténylegesen. Az éles rendszer SMS-szolgáltatón és e-mail-szerveren keresztül, a beállított időben küldi.
      Állapot: <span class="badge" :class="ri.cls">{{ ri.label }}</span>
      <template v-if="ri.send"> · tervezett küldés: {{ fmtDT(ri.send) }}{{ ri.second ? ' és 2 órával a kezdés előtt' : '' }}</template>
    </div>
    <div class="grid2">
      <div v-if="a.remind.sms"><label class="f">📱 SMS – {{ p.phone }}</label><div class="sms">{{ sms }}</div><div class="small muted">{{ sms.length }} karakter</div></div>
      <div v-else class="muted">SMS-t nem kér.</div>
      <div v-if="a.remind.email"><label class="f">✉ E-mail – {{ p.email }}</label><div class="mail"><b>{{ fillTpl(db, n.mailSubj, a) }}</b><hr><span style="white-space:pre-line">{{ fillTpl(db, n.mailTpl, a) }}</span></div></div>
      <div v-else class="muted">E-mailt nem kér.</div>
    </div>
    <template #foot>
      <button class="btn" @click="confirmIt">{{ a.confirmed ? 'Visszaigazolás törlése' : '✓ Visszaigazolta' }}</button>
      <div class="spacer" />
      <button class="btn" @click="ui.close()">Bezárás</button>
      <button class="btn pri" @click="send">Küldés most (demó)</button>
    </template>
  </ModalShell>
</template>
