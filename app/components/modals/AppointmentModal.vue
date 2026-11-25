<script setup lang="ts">
// Időpont részletei: páciens, egészségügyi figyelmeztetés, ráhagyás, emlékeztető, kockázat, kezelés indítása
import { useDataStore } from '~/stores/data'
import { useAppointmentStore } from '~/stores/appointment'
import { useTreatmentStore } from '~/stores/treatment'
import { useUiStore } from '~/stores/ui'
import { esc, fmtBirth, fmtDate, fmtFt, fmtLong, fromMin, toMin, today } from '~/utils/dates'
import { doctorName, recordForAppt, remindInfo, typeNames } from '~/utils/logic'
import { teethStr } from '~/utils/teeth'
import BookingModal from './BookingModal.vue'
import MessageModal from './MessageModal.vue'
import ApptRemoveModal from './ApptRemoveModal.vue'
import ApptMergeModal from './ApptMergeModal.vue'
import InformModal from './InformModal.vue'
import { patientFuture, sugSourceText } from '~/utils/v22'
import { conflictsFor } from '~/utils/conflicts'
import { isWorking, notWorkingText } from '~/utils/schedule'

const props = defineProps<{ id: string }>()
const data = useDataStore()
const ap = useAppointmentStore()
const tx = useTreatmentStore()
const ui = useUiStore()
const db = computed(() => data.db)
const a = computed(() => ap.byId(props.id))
const p = computed(() => db.value.patients.find(x => x.id === a.value?.patientId))
const rec = computed(() => (a.value ? recordForAppt(db.value, a.value.id) : undefined))
const ri = computed(() => (a.value ? remindInfo(a.value) : null))
const rk = computed(() => (a.value ? ap.risk(a.value) : null))
const end = computed(() => (a.value ? toMin(a.value.start) + a.value.dur : 0))
const maxBuf = computed(() => (a.value ? Math.max(0, db.value.settings.endHour * 60 - end.value) : 0))

/* v2.4 7. pont: az időpont ablaka elöl mutatja, kivel ütközik, és egy gombbal megnyitható az ütköző másik időpont */
const confs = computed(() => (a.value && !rec.value ? conflictsFor(db.value, a.value, x => !!recordForAppt(db.value, x.id)) : []))
const pn = (pid: string) => db.value.patients.find(x => x.id === pid)?.name || '?'
function openOther(id: string) { ui.close(); void import('./AppointmentModal.vue').then(m => ui.open(m.default, { id })) }
function intended(otherId: string) {
  const x = a.value; if (!x) return
  x.overlapOk = [...(x.overlapOk || []).filter(o => o.id !== otherId), { id: otherId, at: new Date().toISOString(), by: 'asszisztens' }]
  ui.toast('Szándékos átfedésként jóváhagyva – a naptárban halványabb jelzés marad')
}
const offSched = computed(() => !!a.value && !rec.value && a.value.date >= today() && !isWorking(db.value, a.value.doctorId, a.value.date, a.value.start, a.value.dur + (a.value.buffer || 0)))
function cancel() { ui.open(ApptRemoveModal, { id: props.id, kind: 'cancel' }) }
function remove() { ui.open(ApptRemoveModal, { id: props.id, kind: 'delete' }) }
const futureApt = computed(() => !!a.value && a.value.date >= today() && !rec.value)
const otherCount = computed(() => (a.value ? patientFuture(db.value, a.value.patientId, a.value.id).length : 0))
const itemSug = (sid?: string) => { const g = sid ? db.value.suggestions.find(x => x.id === sid) : null; return g ? sugSourceText(db.value, g) : '' }
async function start() {
  if (!a.value) return
  if (tx.active && tx.s?.appointmentId !== a.value.id) {
    const ok = await ui.confirm('Egy másik kezelés még folyamatban van. Elveted, és ezt indítod?', 'Új kezelés indítása', true)
    if (!ok) return
    tx.cancel()
  }
  if (!tx.active || tx.s?.appointmentId !== a.value.id) tx.startFromAppointment(a.value.id)
  ui.closeAll(); navigateTo('/kezeles')
}
function openRecord() { if (!rec.value) return; tx.editRecord(rec.value.id); ui.closeAll(); navigateTo('/kezeles') }
function edit() { ui.close(); ui.open(BookingModal, { editId: props.id }) }
function setBuf(v: string) { ap.setBuffer(props.id, Number(v)); ui.toast(Number(v) ? `Ráhagyás: ${v} perc` : 'Ráhagyás elhagyva') }
</script>

<template>
  <ModalShell v-if="a && p" title="Időpont" wide>
    <div v-for="c in confs" :key="c.other.id" :class="c.ok ? 'hint' : 'err'" class="row" style="gap:8px" data-test="utkozes-ablak">
      <span><b>{{ c.ok ? 'Szándékos átfedés' : c.hard ? '‼ Ütközik' : '‼ A ráhagyás ütközik' }}:</b> {{ pn(c.other.patientId) }} · {{ c.other.start }}–{{ fromMin(toMin(c.other.start) + c.other.dur) }} · {{ typeNames(db, c.other.typeIds) }}<template v-if="c.ok"> – jóváhagyta: {{ (a.overlapOk || c.other.overlapOk || []).find(o => o.id === c.other.id || o.id === a!.id)?.by || 'munkatárs' }}</template></span>
      <div class="spacer" />
      <button class="btn sm" @click="openOther(c.other.id)">Az ütköző időpont megnyitása</button>
      <button v-if="!c.ok" class="btn sm" @click="intended(c.other.id)">Szándékos átfedés</button>
    </div>
    <div v-if="offSched" class="warn" data-test="beosztason-kivul">Az időpont a beosztáson kívül esik: {{ notWorkingText(db, a.doctorId, a.date) }}. Helyezd át, vagy értesítsd a pácienst.</div>
    <div v-if="a.urgent" class="hint small">Sürgős eset – a beosztáson kívüli foglalást {{ a.urgent.by }} indoklással felülbírálta: „{{ a.urgent.reason }}”.</div>
    <div class="kv">
      <div>Páciens</div>
      <div><b>{{ p.name }}</b> <span class="muted">(szül. {{ fmtBirth(p.birth) }})</span></div>
      <template v-if="p.healthWarning"><div>Egészségügyi</div><div><HealthWarning :text="p.healthWarning" compact /></div></template>
      <div>Telefon</div><div>{{ p.phone }}</div>
      <div>Időpont</div><div>{{ fmtLong(a.date) }}, {{ a.start }}–{{ fromMin(end) }}</div>
      <div>Ráhagyás</div>
      <div class="row">
        <select class="inp auto" :value="a.buffer" :disabled="!!rec" @change="setBuf(($event.target as HTMLSelectElement).value)">
          <option v-for="m in [0, 30, 60].filter(x => x <= maxBuf || x === a!.buffer)" :key="m" :value="m">{{ m ? m + ' perc' : 'nincs' }}</option>
        </select>
        <span v-if="a.buffer" class="badge b-buf">{{ fromMin(end) }}–{{ fromMin(end + a.buffer) }} tartalék</span>
        <span class="small muted">rövidíthető vagy elhagyható</span>
      </div>
      <div>Orvos</div><div>{{ doctorName(db, a.doctorId) }}</div>
      <div>Kezelés</div>
      <div>{{ typeNames(db, a.typeIds) }} <span class="muted">· {{ fmtFt(ap.price(a)) }}</span>
        <div v-if="a.planned?.teeth.length" class="small" style="margin-top:4px">Tervezett: <span v-for="t in a.planned.teeth" :key="t" class="tchip plan">{{ teethStr([t], a.planned.surfaces) }}</span></div>
      </div>
      <template v-if="a.items?.length">
        <div>Tételek</div>
        <div>
          <div v-for="(i, k) in a.items" :key="k" class="small" style="padding:2px 0">
            <span class="tchip">{{ i.tooth ?? '–' }}</span> {{ db.types.find(t => t.id === i.typeId)?.name }}<span v-if="i.surfaces.length"> ({{ i.surfaces.join('') }})</span>
            <span v-if="i.suggestionId" class="badge b-blue" style="margin-left:4px">javasolt</span>
            <span v-if="i.suggestionId" class="muted"> – {{ itemSug(i.suggestionId) }}</span>
          </div>
          <div v-if="a.mergedFrom?.length" class="small muted">Összevont időpont ({{ a.mergedFrom.length }} másik időpontból).</div>
        </div>
      </template>
      <template v-if="a.note"><div>Megjegyzés</div><div>{{ a.note }}</div></template>
      <template v-if="a.log?.length"><div>Napló</div><div class="small muted"><div v-for="(l, k) in a.log.slice(-4)" :key="k">{{ new Date(l.at).toLocaleString('hu-HU') }} · {{ l.by }}: {{ l.note }}</div></div></template>
      <template v-if="p.internalNote"><div>Belső megjegyzés</div><div><InternalNote :text="p.internalNote" /></div></template>
      <template v-if="a.cancelSignal && !rec">
        <div>Lemondás jelezve</div>
        <div class="warn" style="margin:0">A páciens a következőt válaszolta az emlékeztetőre: „{{ a.cancelSignal.text }}”. Automatikus lemondás nincs: hívd vissza, majd mondd le vagy tartsd meg az időpontot.
          <div class="row" style="margin-top:6px"><button class="btn sm" @click="ap.clearSignal(a.id); ui.toast('Jelzés törölve – az időpont marad')">Marad az időpont</button><button class="btn sm danger" @click="cancel">Időpont lemondása</button></div></div>
      </template>
      <div>Emlékeztető</div>
      <div>
        <template v-if="ri && ri.ch.length">{{ ri.ch.join(' + ') }} · {{ a.remind.timing === '48' ? '48' : '24' }} órával előtte{{ ri.second ? ' és 2 órával előtte' : '' }} <span class="badge" :class="ri.cls">{{ ri.label }}</span></template>
        <span v-else class="badge b-gray">nem kér emlékeztetőt</span>
      </div>
      <template v-if="!rec && a.status !== 'noshow' && rk">
        <div>Meg nem jelenés</div>
        <div>
          <RiskBadge :risk="rk" />
          <div class="small muted" style="margin-top:4px">{{ rk.factors.join(' · ') || 'nincs kockázati tényező' }}</div>
          <div v-if="rk.level === 'high'" class="warn" style="margin:6px 0 0">Javaslat: hívd fel telefonon egy nappal előtte, és kérj visszaigazolást.</div>
        </div>
      </template>
      <template v-if="a.date <= today() && !rec">
        <div>Megjelenés</div>
        <div class="row">
          <button class="btn sm" :class="{ danger: a.status === 'noshow' }" @click="ap.toggleNoShow(a.id); ui.toast(a.status === 'noshow' ? 'Rögzítve: nem jelent meg' : 'Visszavonva')">{{ a.status === 'noshow' ? '✗ Nem jelent meg – visszavonás' : 'Nem jelent meg' }}</button>
          <span class="small muted">Késés:</span>
          <input class="inp" type="number" min="0" step="5" style="width:80px" :value="a.late || ''" placeholder="0" @change="ap.setLate(a.id, Number(($event.target as HTMLInputElement).value)); ui.toast('Késés rögzítve')">
          <span class="small muted">perc</span>
        </div>
      </template>
    </div>
    <div class="sumbox">
      <div class="small" style="font-weight:700;color:var(--purple);margin-bottom:4px">✨ Gyors összefoglaló</div>
      <PatientSummary :patient-id="p.id" :limit="5" />
    </div>
    <p v-if="rec"><span class="badge b-green">✓ A kezelés már rögzítve van</span></p>
    <template #foot>
      <button class="btn danger" :disabled="!!rec" :title="rec ? 'Rögzített kezelés után nem mondható le' : ''" @click="cancel">Lemondás</button>
      <button v-if="futureApt" class="btn danger" @click="remove">Törlés</button>
      <button v-if="futureApt && otherCount" class="btn" @click="ui.open(ApptMergeModal, { id: a!.id, mode: 'merge' })">Összevonás</button>
      <button v-if="futureApt && otherCount && a.items?.length" class="btn" @click="ui.open(ApptMergeModal, { id: a!.id, mode: 'move' })">Tételek áthelyezése</button>
      <button v-if="futureApt && a.items?.some(i => i.suggestionId)" class="btn" @click="ui.open(InformModal, { patientId: p!.id, apptIds: [a!.id] })">Tájékoztató</button>
      <div class="spacer" />
      <button v-if="ri && ri.ch.length && !rec" class="btn" @click="ui.open(MessageModal, { id: a.id })">Emlékeztető</button>
      <button class="btn" :disabled="!!rec" @click="edit">Módosítás</button>
      <button class="btn" @click="ui.closeAll(); navigateTo(`/paciensek/${p.id}`)">Karton</button>
      <button v-if="rec" class="btn pri" @click="openRecord">Kezelés megnyitása</button>
      <button v-else class="btn go" @click="start"><AppIcon name="tooth" :size="16" />Kezelés indítása</button>
    </template>
  </ModalShell>
</template>
