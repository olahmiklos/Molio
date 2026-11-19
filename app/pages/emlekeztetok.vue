<script setup lang="ts">
// Emlékeztetők: időpont-emlékeztetők és kockázat (2.1.2), kontroll-felülvizsgálatok (8. pont), javasolt további kezelések (12. pont)
import { useDataStore } from '~/stores/data'
import { useAppointmentStore } from '~/stores/appointment'
import { useSuggestionStore } from '~/stores/suggestion'
import { useUiStore } from '~/stores/ui'
import { addDays, DAYS, dow, fmtDate, fmtDT, fmtFt, fmtShort, today } from '~/utils/dates'
import { doctorName, typeNames } from '~/utils/logic'
import AppointmentModal from '~/components/modals/AppointmentModal.vue'
import MessageModal from '~/components/modals/MessageModal.vue'
import BookingModal from '~/components/modals/BookingModal.vue'
import RecallMessageModal from '~/components/modals/RecallMessageModal.vue'
import RecallSnoozeModal from '~/components/modals/RecallSnoozeModal.vue'
import SuggestionModal from '~/components/modals/SuggestionModal.vue'
import { useOfficeStore } from '~/stores/office'
import { agoText } from '~/utils/office'
import { isOverdue, needsFollowUp, sinceDays, SUG_STATUS, sugFee, URGENCY } from '~/utils/suggest'

const data = useDataStore()
const ap = useAppointmentStore()
const sugs = useSuggestionStore()
const ui = useUiStore()
const db = computed(() => data.db)
const list = computed(() => ap.weekList)
const atRisk = computed(() => list.value.reduce((s, x) => s + x.price * x.rk.p, 0))
const high = computed(() => list.value.filter(x => x.rk.level === 'high'))
const pat = (id: string) => db.value.patients.find(p => p.id === id)
const office = useOfficeStore()
const route = useRoute()
type Tab = 'appt' | 'recall' | 'todo'
const tabOf = (v: unknown): Tab => (v === 'recall' ? 'recall' : v === 'todo' ? 'todo' : 'appt')
const tab = ref<Tab>(tabOf(route.query.tab))
watch(() => route.query.tab, v => { tab.value = tabOf(v) })
const showBooked = ref(false), showHidden = ref(false)
const recalls = computed(() => office.recalls.filter(r => (showBooked.value || !r.booked) && (showHidden.value || !r.snoozed)))
const openRecalls = computed(() => office.recalls.filter(r => !r.booked && !r.snoozed).length)
const STATE: Record<string, [string, string]> = { overdue: ['lejárt', 'b-red'], due: ['esedékes', 'b-yellow'], soon: ['hamarosan', 'b-gray'] }
const tname = (id: string) => db.value.types.find(x => x.id === id)?.name || id
const sugFilter = ref<'open' | 'all'>('open')
const sugList = computed(() => (sugFilter.value === 'open' ? sugs.open : db.value.suggestions.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))))
const signals = computed(() => ap.signals)
</script>

<template>
  <div>
    <div class="pagehead"><h1>Emlékeztetők</h1><span v-if="tab === 'appt'" class="muted">{{ fmtDate(today()) }} – {{ fmtDate(addDays(today(), 7)) }}</span>
      <div class="spacer" />
      <div class="seg"><button :class="{ on: tab === 'appt' }" @click="tab = 'appt'">Időpontok és kockázat<template v-if="signals.length"> ({{ signals.length }} lemondás)</template></button><button :class="{ on: tab === 'recall' }" @click="tab = 'recall'">Kontroll-felülvizsgálatok ({{ openRecalls }})</button><button :class="{ on: tab === 'todo' }" @click="tab = 'todo'">Teendők: javasolt kezelések ({{ sugs.count }})</button></div>
    </div>
    <template v-if="tab === 'recall'">
      <div class="hint">
        A program figyeli, kinél esedékes a rendszeres felülvizsgálat: <b>állapotfelmérés és fogkő-eltávolítás is 6 havonta</b> (alapértelmezett, később felülvizsgálandó; kezeléstípusonként a Beállítások / Kezelési csomagok lapon állítható).
        A lista két dátumot mutat: a <b>legutóbbi kezelés</b> és a <b>felülvizsgálat esedékessége</b> napját. Az üzenet sablonja a Beállításokban szerkeszthető. A küldés a demóban szimulált.
      </div>
      <div class="row" style="margin-bottom:10px"><label class="switch" :class="{ on: showBooked }" @click.prevent="showBooked = !showBooked"><i />a már foglalt időpontúak is</label><label class="switch" :class="{ on: showHidden }" @click.prevent="showHidden = !showHidden"><i />a „nem szükséges / később” jelöltek is</label></div>
      <div class="card flush scroll-x">
        <table class="t">
          <thead><tr><th>Legutóbbi kezelés</th><th>Felülvizsgálat esedékes</th><th>Páciens</th><th class="hide-m">Kezelés</th><th>Állapot</th><th /></tr></thead>
          <tbody>
            <tr v-for="r in recalls" :key="r.patient.id + r.typeId">
              <td class="nowrap"><b>{{ fmtDate(r.last) }}</b><div class="small muted">{{ agoText(r.last) }}</div></td>
              <td class="nowrap"><b>{{ fmtDate(r.due) }}</b><div class="small muted">{{ r.days < 0 ? `${-r.days} napja lejárt` : r.days === 0 ? 'ma' : `${r.days} nap múlva` }}</div></td>
              <td><NuxtLink :to="`/paciensek/${r.patient.id}`"><b>{{ r.patient.name }}</b></NuxtLink><div class="small muted">{{ r.patient.phone || '–' }}{{ r.patient.email ? ' · ' + r.patient.email : '' }}</div></td>
              <td class="small hide-m">{{ r.typeName }}</td>
              <td>
                <span v-if="r.booked" class="badge b-green">időpontja van: {{ fmtDate(r.booked) }}</span>
                <span v-else-if="r.snoozed" class="badge b-gray">{{ r.snoozed.until ? 'elhalasztva: ' + fmtDate(r.snoozed.until) : 'nem szükséges' }}</span>
                <span v-else-if="r.noContact" class="badge b-red">Nincs elérhetőség</span>
                <template v-else>
                  <span v-if="r.invitedAt" class="badge b-blue">Kiküldve: {{ fmtDate(r.invitedAt) }} · {{ r.invitedVia.join(' + ') }}</span>
                  <span v-else class="badge" :class="STATE[r.state]![1]">{{ STATE[r.state]![0] }} · nincs kiküldve</span>
                </template>
                <div v-if="r.snoozed?.reason" class="small muted" style="margin-top:3px">{{ r.snoozed.reason }}</div>
              </td>
              <td class="nowrap">
                <template v-if="r.snoozed"><button class="btn sm" @click="office.undoSnooze(r.patient.id, r.typeId, r.last)">Visszaállítás</button></template>
                <template v-else-if="!r.booked">
                  <button class="btn sm" :class="{ pri: !r.invitedAt }" :disabled="r.noContact" :title="r.noContact ? 'Nincs elérhetőség' : ''" @click="ui.open(RecallMessageModal, { patientId: r.patient.id, typeId: r.typeId })">{{ r.invitedAt ? 'Üzenet újra' : 'Üzenet küldése' }}</button>
                  <button class="btn sm go" style="margin-left:4px" @click="ui.open(BookingModal, { patientId: r.patient.id, typeId: r.typeId })">Időpont</button>
                  <button class="btn sm" style="margin-left:4px" @click="ui.open(RecallSnoozeModal, { patientId: r.patient.id, typeId: r.typeId, last: r.last, name: r.patient.name })">Később / nem kell</button>
                </template>
              </td>
            </tr>
            <tr v-if="!recalls.length"><td colspan="6" class="muted">Nincs esedékes felülvizsgálat a következő 45 napban.</td></tr>
          </tbody>
        </table>
      </div>
    </template>
    <template v-else-if="tab === 'todo'">
      <div class="hint">
        A kezelés közben „szükséges”, „javasolt”, „kell” jelzéssel diktált, de még be nem ütemezett kezelések gyűjtőlistája az asszisztensnek: időpontot kell egyeztetni.
        Egy javaslat addig nyitott, amíg nincs hozzá időpont; ha {{ 14 }} napig (sürgősnél 3 napig) nincs megkeresés, újra jelez. Az „elvetve” állapotot csak az orvos állíthatja be.
        <span class="small">(Alapértelmezett szabályok, később felülvizsgálandók.)</span>
      </div>
      <div v-if="signals.length" class="warn" style="margin-bottom:10px">
        <b>Lemondást jelzett időpontok ({{ signals.length }}):</b> a „NEM” válasz csak jelzés, az időpont nem mondódik le automatikusan.
        <div v-for="a in signals" :key="a.id" class="row" style="padding:4px 0"><span>{{ pat(a.patientId)?.name }} · {{ fmtShort(a.date) }} {{ a.start }} · „{{ a.cancelSignal!.text }}”</span><div class="spacer" /><button class="btn sm" @click="ui.open(AppointmentModal, { id: a.id })">Megnyitás</button></div>
      </div>
      <div class="row" style="margin-bottom:10px"><div class="seg"><button :class="{ on: sugFilter === 'open' }" @click="sugFilter = 'open'">Nyitott ({{ sugs.count }})</button><button :class="{ on: sugFilter === 'all' }" @click="sugFilter = 'all'">Összes</button></div>
        <span v-if="sugs.overdueCount" class="badge b-red">{{ sugs.overdueCount }} határidőn túl</span><span v-if="sugs.followUpCount" class="badge b-yellow">{{ sugs.followUpCount }} újra jelez</span></div>
      <div class="card flush scroll-x">
        <table class="t">
          <thead><tr><th>Páciens</th><th>Kezelés</th><th>Sürgősség</th><th class="hide-m">Határidő</th><th>Állapot</th><th class="hide-m">Becsült díj</th><th /></tr></thead>
          <tbody>
            <tr v-for="g in sugList" :key="g.id" class="click" @click="ui.open(SuggestionModal, { id: g.id })">
              <td><b>{{ pat(g.patientId)?.name }}</b><div class="small muted">{{ pat(g.patientId)?.phone }}</div></td>
              <td>{{ tname(g.typeId) }}<div class="small muted">{{ g.tooth ? g.tooth + '-es fog' : '' }}{{ g.note ? ' · ' + g.note : '' }}</div></td>
              <td><span class="badge" :class="URGENCY[g.urgency].cls">{{ URGENCY[g.urgency].label }}</span></td>
              <td class="hide-m nowrap"><span :style="isOverdue(g) ? 'color:var(--red);font-weight:700' : ''">{{ g.due ? fmtDate(g.due) : '–' }}</span><div class="small muted">{{ sinceDays(g) }} napja javasolva</div></td>
              <td><span class="badge" :class="SUG_STATUS[g.status].cls">{{ SUG_STATUS[g.status].label }}</span><div v-if="needsFollowUp(g)" class="small" style="color:var(--orange)">újra megkeresendő</div><div v-if="g.callback" class="small">📞 visszahívást kért</div></td>
              <td class="hide-m nowrap">{{ fmtFt(sugFee(db, g)) }}</td>
              <td class="nowrap" @click.stop><button class="btn sm go" :disabled="g.status === 'booked' || g.status === 'done'" @click="ui.open(BookingModal, { suggestionIds: [g.id] })">Időpont</button></td>
            </tr>
            <tr v-if="!sugList.length"><td colspan="7" class="muted">Nincs nyitott javasolt kezelés.</td></tr>
          </tbody>
        </table>
      </div>
    </template>
    <template v-else>
    <div class="kpis">
      <div class="kpi"><div class="kv-v" style="color:var(--green)">{{ list.length }}</div><div class="kv-l">időpont a következő 7 napban</div></div>
      <div class="kpi"><div class="kv-v" style="color:var(--blue)">{{ list.filter(x => x.ri.ch.length).length }}</div><div class="kv-l">kér emlékeztetőt</div></div>
      <div class="kpi"><div class="kv-v" style="color:var(--orange)">{{ list.filter(x => x.ri.status === 'cancelled').length }}</div><div class="kv-l">lemondást jelzett</div></div>
      <div class="kpi"><div class="kv-v" style="color:var(--red)">{{ high.length }}</div><div class="kv-l">magas kockázatú időpont</div></div>
      <div class="kpi"><div class="kv-v" style="color:var(--pink)">{{ fmtFt(atRisk) }}</div><div class="kv-l">bevételi kitettség (díj × kockázat)</div></div>
    </div>
    <div class="hint">
      A program minden időpontra megbecsüli, mekkora eséllyel marad el: a páciens korábbi kimaradásai, 24 órán belüli lemondásai és késései, a foglalás előtti idő,
      valamint az emlékeztető alapján. Az emlékeztető csak akkor kér választ, ha a páciens <b>nem</b> tud jönni (válasz: NEM); „megerősítve” állapot nincs. A <b>magas kockázatú</b> pácienseket érdemes telefonon is megkeresni.
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
            </td>
          </tr>
          <tr v-if="!list.length"><td colspan="8" class="muted">Nincs időpont a következő 7 napban.</td></tr>
        </tbody>
      </table>
    </div>
    </template>
  </div>
</template>
