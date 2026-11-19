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

async function cancel() {
  if (!a.value || !p.value) return
  const lateC = ap.isLateCancel(a.value)
  const ok = await ui.confirm(`Biztosan lemondod ${esc(p.value.name)} időpontját (${fmtDate(a.value.date)} ${a.value.start})? A sáv felszabadul és újra foglalható.${lateC ? '<div class="warn" style="margin-top:10px">24 órán belüli lemondás: a program megjegyzi, és ez növeli a páciens következő időpontjainak meg nem jelenési kockázatát.</div>' : ''}`, 'Lemondás', true)
  if (!ok) return
  ap.cancel(props.id); ui.close(); ui.toast('Időpont lemondva, a sáv felszabadult')
}
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
      <template v-if="a.note"><div>Megjegyzés</div><div>{{ a.note }}</div></template>
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
      <div class="spacer" />
      <button v-if="ri && ri.ch.length && !rec" class="btn" @click="ui.open(MessageModal, { id: a.id })">Emlékeztető</button>
      <button class="btn" :disabled="!!rec" @click="edit">Módosítás</button>
      <button class="btn" @click="ui.closeAll(); navigateTo(`/paciensek/${p.id}`)">Karton</button>
      <button v-if="rec" class="btn pri" @click="openRecord">Kezelés megnyitása</button>
      <button v-else class="btn go" @click="start"><AppIcon name="tooth" :size="16" />Kezelés indítása</button>
    </template>
  </ModalShell>
</template>
