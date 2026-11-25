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
import InformModal from '~/components/modals/InformModal.vue'
import { buildTasks, TASK_KINDS, type Task, type TaskKind } from '~/utils/v22'
import { isOverdue, needsFollowUp, sinceDays, SUG_STATUS, sugFee, URGENCY } from '~/utils/suggest'
import { approveAndSend, archivedInfos, declineInfo, INFO_ARCH_TEXT, infoState, pendingInfos, restoreInfo } from '~/utils/v24'
import { dayDiff } from '~/utils/dates'

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
type Tab = 'tasks' | 'appt' | 'recall' | 'todo' | 'info'
const tabOf = (v: unknown): Tab => (v === 'recall' ? 'recall' : v === 'todo' ? 'todo' : v === 'appt' ? 'appt' : v === 'info' ? 'info' : 'tasks')
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
/* egységes Teendők (spec v2.2, 8. pont): raktári teendők nélkül */
const fKind = ref<'' | TaskKind>((Object.keys(TASK_KINDS) as string[]).includes(String(route.query.kind)) ? String(route.query.kind) as TaskKind : ''), fDoc = ref(''), fUrg = ref('')
watch(() => route.query.kind, v => { if ((Object.keys(TASK_KINDS) as string[]).includes(String(v))) { fKind.value = String(v) as TaskKind; tab.value = 'tasks' } })
/* v2.4 10. pont: a jóváhagyásra váró tájékoztatók is teendők (az orvosnak) */
const approveTasks = computed<Task[]>(() => pendingInfos(db.value).map(r => ({ key: 'a:' + r.id, kind: 'approve' as TaskKind, patientId: r.patientId, doctorId: r.doctorId, title: `${fmtDate(r.date)} – ${typeNames(db.value, r.typeIds) || 'kezelés'}`, detail: 'A kezelés utáni tájékoztató e-mail az orvos jóváhagyására vár.', urgency: 'recommended' as const, due: r.patientInfo?.deadline || null, overdue: false, status: `vár (${Math.max(0, dayDiff(r.date, today()))} napja)`, ref: r.id, refKind: 'record' as const })))
const allTasks = computed<Task[]>(() => [...buildTasks(db.value), ...approveTasks.value])
const tasks = computed(() => allTasks.value.filter(t => (!fKind.value || t.kind === fKind.value) && (!fDoc.value || t.doctorId === fDoc.value) && (!fUrg.value || t.urgency === fUrg.value)))
const taskCount = computed(() => allTasks.value.length)
const pnm = (aid: string) => { const a = ap.byId(aid); return a ? (pat(a.patientId)?.name || '?') + ' ' + a.start : aid }
function openConflict(t: (typeof allTasks.value)[number]) { const a = ap.byId(t.appts?.[0] || ''); if (!a) return; ap.showInCalendar(t.appts || [], a.date); navigateTo('/') }
function intended(t: (typeof allTasks.value)[number]) {
  const ids = t.appts || []
  ids.forEach(id => { const a = ap.byId(id); if (a) a.overlapOk = [...(a.overlapOk || []), ...ids.filter(x => x !== id && !(a.overlapOk || []).some(o => o.id === x)).map(x => ({ id: x, at: new Date().toISOString(), by: 'asszisztens' }))] })
  ui.toast('Szándékos átfedésként lezárva – a naptárban halványabb jelzés marad')
}
function act(t: (typeof allTasks.value)[number]) {
  if (t.kind === 'conflict') { openConflict(t); return }
  if (t.kind === 'approve') { tab.value = 'info'; openRec.value = t.ref; return }
  if (t.refKind === 'suggestion') ui.open(BookingModal, { suggestionIds: [t.ref] })
  else if (t.kind === 'inform') ui.open(InformModal, { patientId: t.patientId, apptIds: [t.ref] })
  else if (t.refKind === 'recall') ui.open(BookingModal, { patientId: t.patientId, typeId: t.typeId })
  else ui.open(AppointmentModal, { id: t.ref.split('|')[0]! })
}
function detail(t: (typeof allTasks.value)[number]) {
  if (t.kind === 'conflict') { openConflict(t); return }
  if (t.kind === 'approve') { tab.value = 'info'; openRec.value = t.ref; return }
  if (t.refKind === 'suggestion') ui.open(SuggestionModal, { id: t.ref })
  else if (t.refKind === 'recall') ui.open(RecallMessageModal, { patientId: t.patientId, typeId: t.typeId })
  else act(t)
}
function done(t: (typeof allTasks.value)[number]) { const [a, r] = t.ref.split('|'); if (r) ap.doneReply(a!, r) }
function coord(pid: string) { ui.open(InformModal, { patientId: pid }) }

/* ---------- v2.4 10. pont: jóváhagyásra váró tájékoztatók (orvosi nézet) és Archívum ---------- */
/** a demóban belépés nélkül az orvosi szűrő választható: kiválasztott orvos = orvosi nézet (jóváhagyhat); „asszisztens” = csak az állapot látszik */
const actor = ref<string>(db.value.doctors[0]?.id || '')
const infoView = ref<'pending' | 'archive'>('pending')
const openRec = ref('')
const editing = ref(''), editText = ref('')
const declining = ref(''), declineReason = ref('')
const isDoctor = computed(() => !!actor.value)
const infoList = computed(() => (infoView.value === 'pending' ? pendingInfos(db.value, actor.value || undefined) : archivedInfos(db.value, actor.value || undefined)))
const infoCount = computed(() => pendingInfos(db.value).length)
const recById = (id: string) => db.value.records.find(r => r.id === id)
const dName = (id: string) => db.value.doctors.find(d => d.id === id)?.name || ''
function startEdit(id: string) { editing.value = id; editText.value = recById(id)?.patientInfo?.text || ''; openRec.value = id }
function saveEdit(id: string) { const i = recById(id)?.patientInfo; if (i && editText.value.trim() !== i.text.trim()) { i.text = editText.value; i.edited = true; i.log = [...(i.log || []), { at: new Date().toISOString(), by: dName(actor.value), what: 'a szöveg módosítva küldés előtt' }] } editing.value = '' }
function nextOf(id: string) { const l = infoList.value; const i = l.findIndex(r => r.id === id); const n = l[i + 1] || l.find(r => r.id !== id); openRec.value = n?.id || '' }
function approveSend(id: string) {
  if (!isDoctor.value) { ui.toast('Csak a kezelést végző orvos hagyhatja jóvá (válaszd ki az orvost)'); return }
  if (editing.value === id) saveEdit(id)
  const r = recById(id); const nm = dName(actor.value)
  nextOf(id)
  if (approveAndSend(db.value, id, nm)) ui.toast(`Jóváhagyva és elküldve e-mailben: ${pat(r!.patientId)?.email} (demó: szimulált küldés)`)
}
function decline(id: string) { if (!isDoctor.value) return; nextOf(id); if (declineInfo(db.value, id, dName(actor.value), declineReason.value.trim())) ui.toast('Nem szükséges – a tájékoztató nem megy ki'); declining.value = ''; declineReason.value = '' }
function bringBack(id: string) { if (!isDoctor.value) { ui.toast('Csak az orvos (és az adminisztrátor) hozhatja vissza'); return } if (restoreInfo(db.value, id, dName(actor.value))) ui.toast('Visszahozva a jóváhagyásra váró tájékoztatók közé – új 7 napos határidővel (nem ment ki semmi)') }
function openVisit(r: { id: string; patientId: string }) { navigateTo(`/paciensek/${r.patientId}#kezelesek`) }
</script>

<template>
  <div>
    <div class="pagehead"><h1>Teendők</h1><span v-if="tab === 'appt'" class="muted">{{ fmtDate(today()) }} – {{ fmtDate(addDays(today(), 7)) }}</span>
      <div class="spacer" />
      <div class="seg"><button :class="{ on: tab === 'tasks' }" @click="tab = 'tasks'">Minden teendő ({{ taskCount }})</button><button :class="{ on: tab === 'appt' }" @click="tab = 'appt'">Emlékeztetők és kockázat<template v-if="signals.length"> ({{ signals.length }} lemondás)</template></button><button :class="{ on: tab === 'recall' }" @click="tab = 'recall'">Kontroll-felülvizsgálatok ({{ openRecalls }})</button><button :class="{ on: tab === 'todo' }" @click="tab = 'todo'">Javasolt kezelések ({{ sugs.count }})</button><button :class="{ on: tab === 'info' }" data-test="tajekoztatok-ful" @click="tab = 'info'">Jóváhagyásra váró tájékoztatók ({{ infoCount }})</button></div>
    </div>
    <template v-if="tab === 'tasks'">
      <div class="hint">Egységes teendőlista: időpont-ütközések, beosztáson kívüli időpontok, egyeztetendő időpontok (javasolt kezelések), kiküldendő tájékoztatók, az orvos jóváhagyására váró tájékoztatók, esedékes kontrollok, lemondást jelzett időpontok és a páciensek üzenetei. A raktári teendők (megrendelés, szállítás) a Raktár menüben maradnak.</div>
      <div class="row" style="margin-bottom:10px">
        <select v-model="fKind" class="inp auto"><option value="">minden típus</option><option v-for="(v, k) in TASK_KINDS" :key="k" :value="k">{{ v.label }}</option></select>
        <select v-model="fDoc" class="inp auto"><option value="">minden orvos</option><option v-for="d in db.doctors" :key="d.id" :value="d.id">{{ d.name }}</option></select>
        <select v-model="fUrg" class="inp auto"><option value="">minden sürgősség</option><option value="urgent">sürgős</option><option value="recommended">javasolt</option><option value="later">ráér</option></select>
        <span class="muted small">{{ tasks.length }} / {{ taskCount }} teendő</span>
      </div>
      <div class="card flush scroll-x">
        <table class="t">
          <thead><tr><th>Teendő</th><th>Páciens</th><th class="hide-m">Orvos</th><th class="hide-m">Határidő</th><th>Állapot</th><th /></tr></thead>
          <tbody>
            <tr v-for="t in tasks" :key="t.key" class="click" @click="detail(t)">
              <td><span class="badge" :class="TASK_KINDS[t.kind].cls">{{ TASK_KINDS[t.kind].label }}</span><div style="margin-top:3px"><b>{{ t.title }}</b></div><div class="small muted">{{ t.detail }}</div></td>
              <td><b>{{ pat(t.patientId)?.name }}</b><div class="small muted">{{ pat(t.patientId)?.phone }}</div></td>
              <td class="hide-m small">{{ t.doctorId ? doctorName(db, t.doctorId) : '–' }}</td>
              <td class="hide-m nowrap"><span :style="t.overdue ? 'color:var(--red);font-weight:700' : ''">{{ t.due ? fmtDate(t.due) : '–' }}</span><div class="small muted">{{ URGENCY[t.urgency].label }}</div></td>
              <td class="small">{{ t.status }}</td>
              <td class="nowrap" @click.stop>
                <button v-if="t.kind === 'reply'" class="btn sm" @click="done(t)">Kész</button>
                <template v-if="t.kind === 'conflict'">
                  <button class="btn sm go" @click="openConflict(t)">Megnyitás</button>
                  <select class="inp auto" style="margin-left:4px" aria-label="Áthelyezés" @change="($event.target as HTMLSelectElement).value && ui.open(BookingModal, { editId: ($event.target as HTMLSelectElement).value }); ($event.target as HTMLSelectElement).value = ''"><option value="">Áthelyezés…</option><option v-for="id in t.appts" :key="id" :value="id">{{ pnm(id) }}</option></select>
                  <select class="inp auto" style="margin-left:4px" aria-label="Értesítés kiküldése" @change="($event.target as HTMLSelectElement).value && ui.open(MessageModal, { id: ($event.target as HTMLSelectElement).value }); ($event.target as HTMLSelectElement).value = ''"><option value="">Értesítés kiküldése…</option><option v-for="id in t.appts" :key="id" :value="id">{{ pnm(id) }}</option></select>
                  <button class="btn sm" style="margin-left:4px" title="Az átfedés szándékos (pl. két szék, két asszisztens) – a feladat lezárul" @click="intended(t)">Szándékos átfedés</button>
                </template>
                <template v-else-if="t.kind === 'offsched'">
                  <button class="btn sm go" @click="ui.open(BookingModal, { editId: t.ref })">Áthelyezés</button>
                  <button class="btn sm" style="margin-left:4px" @click="ui.open(MessageModal, { id: t.ref })">Értesítés</button>
                </template>
                <button v-else class="btn sm go" @click="act(t)">{{ t.kind === 'inform' ? 'Tájékoztató' : t.kind === 'approve' ? 'Elolvasás' : t.kind === 'cancel' || t.kind === 'reply' ? 'Megnyitás' : 'Időpont' }}</button>
                <button v-if="t.kind === 'schedule' || t.kind === 'late'" class="btn sm" style="margin-left:4px" title="Kézi, udvarias üzenet: egyeztessen időpontot" @click="coord(t.patientId)">Üzenet</button>
              </td>
            </tr>
            <tr v-if="!tasks.length"><td colspan="6" class="muted">Nincs teendő.</td></tr>
          </tbody>
        </table>
      </div>
    </template>
    <template v-else-if="tab === 'info'">
      <div class="hint">A kezelés utáni tájékoztató e-mail csak az orvos jóváhagyása után megy ki, és csak ha a páciens e-mailes értesítést kér. Ha 7 napon belül nincs jóváhagyás, az Archívumba kerül („nem került kiküldésre”) – onnan visszahozható. Tömeges jóváhagyás nincs, hogy az orvos valóban elolvassa, mi megy ki. <span class="small">(Demó: a küldés szimulált, valódi e-mail nem megy ki.)</span></div>
      <div class="row" style="margin-bottom:10px">
        <label class="small muted">Nézet:</label>
        <select v-model="actor" class="inp auto" data-test="orvos-szuro"><option v-for="d in db.doctors" :key="d.id" :value="d.id">{{ d.name }} (orvos)</option><option value="">Asszisztens – csak az állapot</option></select>
        <div class="seg"><button :class="{ on: infoView === 'pending' }" @click="infoView = 'pending'">Jóváhagyásra vár</button><button :class="{ on: infoView === 'archive' }" @click="infoView = 'archive'">Archívum</button></div>
        <span class="small muted">{{ infoList.length }} tájékoztató</span>
      </div>
      <div v-for="r in infoList" :key="r.id" class="card" style="padding:12px 14px" :data-test="'info-' + infoState(r)">
        <div class="row click" @click="openRec = openRec === r.id ? '' : r.id">
          <b>{{ pat(r.patientId)?.name }}</b><span>{{ fmtDate(r.date) }} · {{ typeNames(db, r.typeIds) || 'kezelés' }}</span><span class="small muted">{{ dName(r.doctorId) }}</span>
          <span v-if="infoState(r) === 'pending'" class="badge b-yellow">vár {{ Math.max(0, dayDiff(r.date, today())) }} napja · határidő: {{ r.patientInfo?.deadline ? fmtDate(r.patientInfo.deadline) : '–' }}</span>
          <span v-else class="badge" :class="infoState(r) === 'sent' ? 'b-green' : 'b-gray'">{{ INFO_ARCH_TEXT[infoState(r)] }}{{ infoState(r) === 'sent' && r.patientInfo?.sentAt ? ': ' + fmtDate(r.patientInfo.sentAt.slice(0, 10)) + ' · e-mail · ' + (r.patientInfo.approvedBy || '') : '' }}</span>
          <div class="spacer" /><span class="small muted">{{ openRec === r.id ? '▴' : '▾' }}</span>
        </div>
        <div v-if="openRec === r.id" style="margin-top:8px">
          <textarea v-if="editing === r.id" v-model="editText" class="inp" rows="12" style="font-size:14px;line-height:1.55" />
          <div v-else class="mail" style="white-space:pre-line;font-size:14px;line-height:1.55">{{ r.patientInfo?.text }}</div>
          <div v-if="r.patientInfo?.archived === 'declined' && r.patientInfo.declineReason" class="small muted">Indoklás: {{ r.patientInfo.declineReason }}</div>
          <div v-if="r.patientInfo?.log?.length" class="small muted" style="margin-top:4px"><div v-for="(l, k) in r.patientInfo.log" :key="k">{{ new Date(l.at).toLocaleString('hu-HU') }} · {{ l.by }}: {{ l.what }}</div></div>
          <div class="row" style="margin-top:8px">
            <template v-if="infoState(r) === 'pending'">
              <button class="btn go" :disabled="!isDoctor" :title="isDoctor ? '' : 'Csak az orvos hagyhatja jóvá'" data-test="jovahagyas-kuldes" @click="approveSend(r.id)">Jóváhagyás és küldés</button>
              <button v-if="editing !== r.id" class="btn" :disabled="!isDoctor" @click="startEdit(r.id)">Szerkesztés</button>
              <button v-else class="btn" @click="saveEdit(r.id)">Szerkesztés kész</button>
              <template v-if="declining === r.id"><input v-model="declineReason" class="inp" style="max-width:220px" placeholder="Indoklás (nem kötelező)"><button class="btn danger" @click="decline(r.id)">Nem szükséges – megerősítés</button></template>
              <button v-else class="btn" :disabled="!isDoctor" @click="declining = r.id">Nem szükséges</button>
            </template>
            <button v-else-if="infoState(r) === 'expired' || infoState(r) === 'declined'" class="btn" :disabled="!isDoctor" data-test="visszahozas" @click="bringBack(r.id)">Visszahozás jóváhagyásra</button>
            <button class="btn" @click="openVisit(r)">Megnyitás</button>
            <span v-if="!isDoctor" class="small muted">Asszisztens nézet: az állapot látszik, a jóváhagyás az orvosé.</span>
          </div>
        </div>
      </div>
      <p v-if="!infoList.length" class="muted">{{ infoView === 'pending' ? 'Nincs jóváhagyásra váró tájékoztató.' : 'Az archívum üres.' }}</p>
    </template>
    <template v-else-if="tab === 'recall'">
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
