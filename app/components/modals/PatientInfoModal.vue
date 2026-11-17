<script setup lang="ts">
// Közérthető tájékoztató a páciensnek: a program vázlatot készít, de csak az orvos jóváhagyása után küldhető ki
import { useDataStore } from '~/stores/data'
import { useOfficeStore } from '~/stores/office'
import { useUiStore } from '~/stores/ui'
import { fmtDate } from '~/utils/dates'
const props = defineProps<{ recordId: string }>()
const data = useDataStore()
const office = useOfficeStore()
const ui = useUiStore()
const db = computed(() => data.db)
const r = computed(() => db.value.records.find(x => x.id === props.recordId)!)
office.ensureInfo(props.recordId)
const info = computed(() => r.value.patientInfo!)
const p = computed(() => db.value.patients.find(x => x.id === r.value.patientId)!)
const text = computed({ get: () => info.value.text, set: v => office.setInfoText(props.recordId, v) })
const doctorId = ref(r.value.doctorId)
const sms = ref(!!p.value.remind.sms || !p.value.email)
const email = ref(!!p.value.email && !!p.value.remind.email)
const STATE: Record<string, [string, string]> = { draft: ['Vázlat – orvosi jóváhagyásra vár', 'b-yellow'], approved: ['Jóváhagyva – küldhető', 'b-green'], sent: ['Elküldve (szimulált)', 'b-blue'] }
async function regen() { if (await ui.confirm('Újra elkészíted a vázlatot a kezelés adataiból? A kézi módosítások elvesznek.', 'Újragenerálás')) office.regenerateInfo(props.recordId) }
function approve() { office.approveInfo(props.recordId, doctorId.value); ui.toast('Jóváhagyva – most már elküldhető') }
function send() {
  const ch = [sms.value && 'SMS', email.value && 'e-mail'].filter(Boolean) as string[]
  if (!ch.length) { ui.toast('Válassz csatornát'); return }
  if (office.sendInfo(props.recordId, ch)) { ui.close(); ui.toast('Tájékoztató elküldve (demó: szimulált küldés)') }
}
</script>

<template>
  <ModalShell title="Tájékoztató a páciensnek" wide>
    <template #head><span class="badge" :class="STATE[info.status]![1]">{{ STATE[info.status]![0] }}</span></template>
    <div class="ai-note" style="margin-top:0">
      A program a kezelés adataiból <b>közérthető összefoglalót</b> készít (mi történt, mire figyeljen otthon, mikor jöjjön legközelebb).
      <b>Csak az orvos jóváhagyása után küldhető ki</b>, hogy pontatlan szöveg ne jusson el a pácienshez. Ha jóváhagyás után módosítod, újra jóvá kell hagyni.
      <span class="small">(Demó: sablon alapú szöveg. A végleges verzióban a vázlatot az AI írja a diktálásból – a jóváhagyás ott is kötelező.)</span>
    </div>
    <div class="small muted" style="margin-bottom:6px">{{ p.name }} · {{ fmtDate(r.date) }} {{ r.time }}</div>
    <textarea v-model="text" class="inp" rows="15" style="font-size:14px;line-height:1.55" :disabled="info.status === 'sent'" />
    <div v-if="info.status !== 'draft'" class="small muted" style="margin-top:6px">
      Jóváhagyta: <b>{{ info.approvedBy }}</b>, {{ info.approvedAt ? fmtDate(info.approvedAt) : '' }}<template v-if="info.status === 'sent'"> · elküldve: {{ info.sentAt ? fmtDate(info.sentAt) : '' }} ({{ (info.channels || []).join(', ') }})</template>
    </div>
    <div v-if="info.status === 'approved'" class="row" style="margin-top:10px">
      <span class="small muted">Küldés:</span>
      <label class="chip" :class="{ on: sms }" @click.prevent="sms = !sms">📱 SMS · {{ p.phone }}</label>
      <label class="chip" :class="{ on: email, static: !p.email }" @click.prevent="p.email && (email = !email)">✉ {{ p.email || 'nincs e-mail-cím' }}</label>
    </div>
    <template #foot>
      <button v-if="info.status !== 'sent'" class="btn" @click="regen">Újragenerálás</button>
      <div class="spacer" />
      <button class="btn" @click="ui.close()">Bezárás</button>
      <template v-if="info.status === 'draft'">
        <select v-model="doctorId" class="inp auto"><option v-for="d in db.doctors" :key="d.id" :value="d.id">{{ d.name }}</option></select>
        <button class="btn pri" @click="approve"><AppIcon name="check" :size="16" />Orvosként jóváhagyom</button>
      </template>
      <button v-else-if="info.status === 'approved'" class="btn go" @click="send">Küldés a páciensnek</button>
    </template>
  </ModalShell>
</template>
