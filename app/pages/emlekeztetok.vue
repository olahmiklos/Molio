<script setup lang="ts">
// Emlékeztetők és a meg nem jelenés kockázata a következő hétre (spec 2.1.2)
import { useDataStore } from '~/stores/data'
import { useAppointmentStore } from '~/stores/appointment'
import { useUiStore } from '~/stores/ui'
import { addDays, DAYS, dow, fmtDate, fmtDT, fmtFt, fmtShort, today } from '~/utils/dates'
import { doctorName, typeNames } from '~/utils/logic'
import AppointmentModal from '~/components/modals/AppointmentModal.vue'
import MessageModal from '~/components/modals/MessageModal.vue'
import BookingModal from '~/components/modals/BookingModal.vue'
import { useOfficeStore } from '~/stores/office'
import { recallText } from '~/utils/office'

const data = useDataStore()
const ap = useAppointmentStore()
const ui = useUiStore()
const db = computed(() => data.db)
const list = computed(() => ap.weekList)
const atRisk = computed(() => list.value.reduce((s, x) => s + x.price * x.rk.p, 0))
const high = computed(() => list.value.filter(x => x.rk.level === 'high'))
const pat = (id: string) => db.value.patients.find(p => p.id === id)
const office = useOfficeStore()
const route = useRoute()
const tab = ref<'appt' | 'recall'>(route.query.tab === 'recall' ? 'recall' : 'appt')
watch(() => route.query.tab, v => { tab.value = v === 'recall' ? 'recall' : 'appt' })
const showBooked = ref(false)
const recalls = computed(() => office.recalls.filter(r => showBooked.value || !r.booked))
const preview = ref<string | null>(null)
const STATE: Record<string, [string, string]> = { overdue: ['lejárt', 'b-red'], due: ['esedékes', 'b-yellow'], soon: ['hamarosan', 'b-gray'] }
function inviteIt(r: (typeof office.recalls)[number]) {
  const ch = [r.patient.remind.sms || !r.patient.email ? 'SMS' : '', r.patient.email && r.patient.remind.email ? 'e-mail' : ''].filter(Boolean)
  office.invite(r.patient.id, r.typeId, ch.length ? ch : ['SMS'])
  ui.toast(`Meghívó elküldve (szimulált): ${r.patient.name}`)
}
function confirmIt(id: string) { ap.toggleConfirm(id); ui.toast(ap.byId(id)?.confirmed ? 'Visszaigazolva – a kockázat csökkent' : 'Visszaigazolás törölve') }
</script>

<template>
  <div>
    <div class="pagehead"><h1>Emlékeztetők</h1><span v-if="tab === 'appt'" class="muted">{{ fmtDate(today()) }} – {{ fmtDate(addDays(today(), 7)) }}</span>
      <div class="spacer" />
      <div class="seg"><button :class="{ on: tab === 'appt' }" @click="tab = 'appt'">Időpontok és kockázat</button><button :class="{ on: tab === 'recall' }" @click="tab = 'recall'">Kontroll-meghívók ({{ office.recalls.filter(r => !r.booked).length }})</button></div>
    </div>
    <template v-if="tab === 'recall'">
      <div class="hint">
        A program figyeli, kinél esedékes a rendszeres kontroll: <b>fogkő-eltávolítás 6 havonta, állapotfelmérés évente</b> (kezeléstípusonként a Beállítások / Kezelési csomagok lapon állítható).
        Az esedékesség a legutóbbi ilyen kezelés dátumából számolódik; akinek már van ilyen időpontja, az alapból nem látszik. A meghívó a demóban nem megy ki, csak szimulált.
      </div>
      <div class="row" style="margin-bottom:10px"><label class="switch" :class="{ on: showBooked }" @click.prevent="showBooked = !showBooked"><i />a már foglalt időpontúak is</label></div>
      <div class="card flush scroll-x">
        <table class="t">
          <thead><tr><th>Esedékes</th><th>Páciens</th><th>Kontroll</th><th class="hide-m">Legutóbb</th><th>Állapot</th><th /></tr></thead>
          <tbody>
            <tr v-for="r in recalls" :key="r.patient.id + r.typeId">
              <td class="nowrap"><b>{{ fmtDate(r.due) }}</b><div class="small muted">{{ r.days < 0 ? `${-r.days} napja` : r.days === 0 ? 'ma' : `${r.days} nap múlva` }}</div></td>
              <td><NuxtLink :to="`/paciensek/${r.patient.id}`"><b>{{ r.patient.name }}</b></NuxtLink><div class="small muted">{{ r.patient.phone }}</div></td>
              <td class="small">{{ r.typeName }}</td>
              <td class="hide-m nowrap">{{ fmtDate(r.last) }}</td>
              <td>
                <span v-if="r.booked" class="badge b-green">időpontja van: {{ fmtDate(r.booked) }}</span>
                <template v-else><span class="badge" :class="STATE[r.state]![1]">{{ STATE[r.state]![0] }}</span><div v-if="r.invitedAt" class="small muted" style="margin-top:3px">meghívva: {{ fmtDate(r.invitedAt) }}</div></template>
              </td>
              <td class="nowrap">
                <template v-if="!r.booked">
                  <button class="btn sm" @click="preview = preview === r.patient.id + r.typeId ? null : r.patient.id + r.typeId">Üzenet</button>
                  <button class="btn sm" :class="{ pri: !r.invitedAt }" style="margin-left:4px" @click="inviteIt(r)">{{ r.invitedAt ? 'Újra' : 'Meghívó' }}</button>
                  <button class="btn sm go" style="margin-left:4px" @click="ui.open(BookingModal, { patientId: r.patient.id, typeId: r.typeId })">Időpont</button>
                  <div v-if="preview === r.patient.id + r.typeId" class="sms" style="margin-top:8px;white-space:normal">{{ recallText(db, r) }}</div>
                </template>
              </td>
            </tr>
            <tr v-if="!recalls.length"><td colspan="6" class="muted">Nincs esedékes kontroll a következő 45 napban.</td></tr>
          </tbody>
        </table>
      </div>
    </template>
    <template v-else>
    <div class="kpis">
      <div class="kpi"><div class="kv-v" style="color:var(--green)">{{ list.length }}</div><div class="kv-l">időpont a következő 7 napban</div></div>
      <div class="kpi"><div class="kv-v" style="color:var(--blue)">{{ list.filter(x => x.ri.ch.length).length }}</div><div class="kv-l">kér emlékeztetőt</div></div>
      <div class="kpi"><div class="kv-v" style="color:var(--teal)">{{ list.filter(x => x.ri.status === 'confirmed').length }}</div><div class="kv-l">visszaigazolta</div></div>
      <div class="kpi"><div class="kv-v" style="color:var(--red)">{{ high.length }}</div><div class="kv-l">magas kockázatú időpont</div></div>
      <div class="kpi"><div class="kv-v" style="color:var(--pink)">{{ fmtFt(atRisk) }}</div><div class="kv-l">bevételi kitettség (díj × kockázat)</div></div>
    </div>
    <div class="hint">
      A program minden időpontra megbecsüli, mekkora eséllyel marad el: a páciens korábbi kimaradásai, 24 órán belüli lemondásai és késései, a foglalás előtti idő,
      valamint az emlékeztető és a visszaigazolás alapján. A <b>magas kockázatú</b> pácienseket érdemes telefonon is megkeresni.
      <span class="small">(Demó: szabályalapú becslés; az üzenetek nem mennek ki ténylegesen, csak az előnézet és a szimulált küldés látszik.)</span>
    </div>
    <div class="card flush scroll-x">
      <table class="t">
        <thead><tr><th>Időpont</th><th>Páciens</th><th class="hide-m">Kezelés</th><th class="hide-m">Díj</th><th>Értesítés</th><th>Állapot</th><th>Meg nem jelenés</th><th /></tr></thead>
        <tbody>
          <tr v-for="{ a, rk, ri, price } in list" :key="a.id" class="click" @click="ui.open(AppointmentModal, { id: a.id })">
            <td class="nowrap"><b>{{ fmtShort(a.date) }} {{ DAYS[dow(a.date) - 1]!.slice(0, 3) }}.</b> {{ a.start }}<div class="small muted">{{ doctorName(db, a.doctorId) }}</div></td>
            <td><b>{{ pat(a.patientId)?.name }}</b><div class="small muted">{{ pat(a.patientId)?.phone }}</div></td>
            <td class="small hide-m">{{ typeNames(db, a.typeIds) }}</td>
            <td class="nowrap hide-m">{{ fmtFt(price) }}</td>
            <td class="small"><template v-if="ri.ch.length">{{ ri.ch.join(' + ') }}<div class="muted">{{ fmtDT(ri.send!) }}{{ ri.second ? ' + 2 órával előtte' : '' }}</div></template><span v-else class="muted">nem kér</span></td>
            <td><span class="badge" :class="ri.cls">{{ ri.label }}</span></td>
            <td><RiskBadge :risk="rk" /><div v-if="rk.level === 'high'" class="small" style="color:var(--red);margin-top:3px">📞 telefonos megerősítés javasolt</div></td>
            <td class="nowrap" @click.stop>
              <button v-if="ri.ch.length" class="btn sm" @click="ui.open(MessageModal, { id: a.id })">Üzenet</button>
              <button class="btn sm" :class="{ pri: a.confirmed }" style="margin-left:4px" @click="confirmIt(a.id)">{{ a.confirmed ? '✓ Visszaigazolva' : 'Visszaigazolta' }}</button>
            </td>
          </tr>
          <tr v-if="!list.length"><td colspan="8" class="muted">Nincs időpont a következő 7 napban.</td></tr>
        </tbody>
      </table>
    </div>
    </template>
  </div>
</template>
