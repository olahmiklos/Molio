<script setup lang="ts">
// „Mai feladat” (spec v2.4 8. pont): a kezelési alkalom képernyő legfelső sávjában, a diktálás gomb mellett, egy gyors, rövid összefoglaló arról,
// mi a tervezett kezelés; a részletek egy koppintásra nyílnak le. A kiemelt figyelmeztetés lenyitás nélkül is mindig látszik.
// A diktálás után jelöli, mi lett elvégezve (✓), mi nincs még rögzítve, és mi nem történt meg szándékosan (megjegyzéssel → a következő alkalom „következő lépése”).
// Minden ágon egyformán jelenik meg (a felhasználó munkafolyamatának része).
import { useDataStore } from '~/stores/data'
import { useTreatmentStore } from '~/stores/treatment'
import { useUiStore } from '~/stores/ui'
import { doctorName } from '~/utils/logic'
import { fmtLong, fromMin, toMin } from '~/utils/dates'
import { previousNextSteps } from '~/utils/v24'
import AppointmentModal from './modals/AppointmentModal.vue'

const data = useDataStore(), tx = useTreatmentStore(), ui = useUiStore()
const db = computed(() => data.db)
const s = computed(() => tx.s!)
const p = computed(() => tx.patient)
const open = ref(false)
const appt = computed(() => (s.value.appointmentId ? db.value.appointments.find(a => a.id === s.value.appointmentId) : null))
const marks = computed(() => tx.planMarksNow)
const next = computed(() => previousNextSteps(db.value, s.value.patientId, s.value.recordId))
const hasPlan = computed(() => marks.value.length > 0)
const doneN = computed(() => marks.value.filter(m => m.state === 'done').length)
const noteEdit = reactive<Record<string, string>>({})
const key = (m: { tooth: number | null; typeId: string }) => `${m.tooth ?? 0}:${m.typeId}`
function toggleNot(m: { tooth: number | null; typeId: string; state: string }) {
  if (m.state === 'notdone') tx.setNotDone(key(m), null)
  else tx.setNotDone(key(m), noteEdit[key(m)] || '')
}
</script>

<template>
  <div class="tb-wrap" style="flex:1;min-width:0" data-test="mai-feladat">
    <div class="tb-row">
      <span class="small muted" style="font-weight:800;letter-spacing:.06em;text-transform:uppercase">Mai feladat</span>
      <template v-if="hasPlan">
        <span v-for="m in marks" :key="key(m)" class="tb-item">
          <span class="tb-main">{{ m.label }}</span>
          <span v-if="m.state === 'done'" class="tb-ok">✓ elvégezve</span>
          <span v-else-if="m.state === 'notdone'" class="tb-not">nem történt meg</span>
          <span v-else class="tb-pend">még nincs rögzítve</span>
        </span>
      </template>
      <span v-else class="small" data-test="nincs-terv">Nincs előre tervezett kezelés – a diktálással rögzítheti a mai kezelést</span>
      <span v-if="p?.healthWarning" class="tb-warn" title="Kiemelt figyelmeztetés a páciens kartonjáról">⚕ {{ p.healthWarning }}</span>
      <span v-if="hasPlan && marks.length > 1" class="small muted">{{ doneN }}/{{ marks.length }} kész</span>
      <button class="btn sm ghost" type="button" :aria-expanded="open" @click="open = !open">{{ open ? 'Részletek ▴' : 'Részletek ▾' }}</button>
    </div>
    <div v-if="open" class="tb-det">
      <div><b>{{ p?.name }}</b><template v-if="appt"> · {{ fmtLong(appt.date) }}, {{ appt.start }}–{{ fromMin(toMin(appt.start) + appt.dur) }} ({{ appt.dur }} perc) · {{ doctorName(db, appt.doctorId) }}</template><template v-else> · időpont nélkül indított kezelés</template></div>
      <div v-if="appt?.note"><span class="muted">Az időponthoz rögzítve:</span> {{ appt.note }}</div>
      <div v-for="n in next" :key="n"><span class="muted">Előző alkalom – következő lépés:</span> {{ n }}</div>
      <div v-for="m in marks" :key="'d' + key(m)" class="row" style="gap:6px;margin-top:4px">
        <span style="min-width:200px">{{ m.label }}</span>
        <input v-if="m.state !== 'done'" v-model="noteEdit[key(m)]" class="inp" style="max-width:260px" :placeholder="m.state === 'notdone' ? (m.note || 'megjegyzés (nem kötelező)') : 'ha nem történik meg: rövid megjegyzés'" @change="m.state === 'notdone' && tx.setNotDone(key(m), noteEdit[key(m)] || '')">
        <button v-if="m.state !== 'done'" class="btn sm" :class="{ danger: m.state === 'notdone' }" type="button" @click="toggleNot(m)">{{ m.state === 'notdone' ? 'Visszavonás' : 'Nem történt meg' }}</button>
        <span v-if="m.state === 'notdone'" class="small muted">a következő alkalom összefoglalójában „következő lépésként” jelenik meg</span>
      </div>
      <div class="small muted" style="margin-top:6px">A jelölés csak tájékoztat: a mentést nem blokkolja, és a diktálás tartalmát nem módosítja. A terv nem töltődik be magától az eredménybe.</div>
      <button v-if="appt" class="btn sm" style="margin-top:6px" type="button" @click="ui.open(AppointmentModal, { id: appt.id })">Az időpont teljes összefoglalója</button>
    </div>
  </div>
</template>
