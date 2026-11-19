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
/** a páciens válasza (szimulált): csak a „NEM” jellegű válasz jelez, az „igen”/hallgatás nem igényel teendőt (9. pont) */
const reply = ref('')
function simulate() {
  if (!reply.value.trim()) return
  const r = ap.simulateReply(props.id, reply.value)
  ui.toast(r === 'cancel' ? 'Lemondást jelzett – az asszisztens értesítve' : 'Üzenet rögzítve, nincs teendő')
  reply.value = ''
}
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
    <div class="hint" style="margin-top:12px">
      <b>Válasz szimulálása (demó).</b> Az üzenet arra kéri a pácienst, hogy csak akkor válaszoljon <b>NEM</b>-mel, ha nem tud eljönni; a megerősítést nem kérjük.
      Írd be egy válasz szövegét (pl. „nem”, „Nem tudok”, „sajnos nem megyek”):
      <div class="row" style="margin-top:6px"><input v-model="reply" class="inp" style="max-width:320px" placeholder="Páciens válasza" @keyup.enter="simulate"><button class="btn sm" @click="simulate">Válasz szimulálása</button></div>
      <div v-if="a.cancelSignal" class="warn" style="margin-top:8px">Lemondást jelzett: „{{ a.cancelSignal.text }}” – az asszisztens dönt (időpont lemondása vagy visszahívás). <button class="btn sm" @click="ap.clearSignal(a.id)">Jelzés törlése</button></div>
    </div>
    <template #foot>
      <div class="spacer" />
      <button class="btn" @click="ui.close()">Bezárás</button>
      <button class="btn pri" @click="send">Küldés most (demó)</button>
    </template>
  </ModalShell>
</template>
