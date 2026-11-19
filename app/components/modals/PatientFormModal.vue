<script setup lang="ts">
import { usePatientStore } from '~/stores/patient'
import { useUiStore } from '~/stores/ui'
import { fmtBirth } from '~/utils/dates'
import type { PatientDraft } from '../PatientFields.vue'

const props = defineProps<{ id?: string }>()
const patients = usePatientStore()
const ui = useUiStore()
const p = props.id ? patients.byId(props.id) : undefined
const draft = ref<PatientDraft>({
  name: p?.name || '', birth: p?.birth || '', taj: p?.taj || '', phone: p?.phone || '', email: p?.email || '', address: p?.address || '',
  healthWarning: p?.healthWarning || '', internalNote: p?.internalNote || '', needsBuffer: !!p?.needsBuffer, dentition: p?.dentition || 'permanent', doctorId: p?.doctorId || null,
})
const msg = ref('')
const dupId = ref<string | null>(null)
async function save() {
  const d = draft.value
  msg.value = ''; dupId.value = null
  if (!d.name.trim() || !d.birth || !d.phone.trim()) { msg.value = 'A név, a születési dátum és a telefonszám kötelező.'; return }
  if (!p && !d.doctorId) { msg.value = 'Új páciensnél a kezelő orvos megadása kötelező.'; return }
  if (!p) {
    const dup = patients.findDuplicate(d.name, d.birth)
    if (dup) { msg.value = `Már van ilyen páciens: ${dup.name} (szül. ${fmtBirth(dup.birth)}).`; dupId.value = dup.id; return }
    const np = patients.create({ ...d, name: d.name.trim(), phone: d.phone.trim() })
    ui.close(); navigateTo(`/paciensek/${np.id}`); ui.toast('Páciens felvéve')
  } else {
    const { doctorId, ...rest } = d
    patients.update(p.id, { ...rest, name: d.name.trim(), phone: d.phone.trim() })
    if (doctorId && doctorId !== p.doctorId) {
      const n = patients.upcoming(p.id).filter(a => a.doctorId !== doctorId).length
      const tr = n ? await ui.confirm(`A kezelő orvos módosul. <b>${n}</b> jövőbeli időpontja van a páciensnek másik orvosnál. Átkerüljenek az új orvoshoz? (Ütközés esetén az adott időpont marad, és jelezzük.)`, 'Igen, átviszem', false, 'Nem, maradnak') : false
      const r = patients.changeDoctor(p.id, doctorId, { by: 'asszisztens', reason: 'karton szerkesztése', transfer: tr })
      ui.toast(r.conflicts.length ? `Kezelő orvos módosítva; ütközés miatt nem vihető át: ${r.conflicts.join(', ')}` : `Kezelő orvos módosítva${r.moved ? `, ${r.moved} időpont átkerült` : ''}`)
    } else ui.toast('Adatok mentve')
    ui.close()
  }
}
</script>

<template>
  <ModalShell :title="p ? 'Páciens adatai' : 'Új páciens'" wide>
    <PatientFields v-model="draft" :is-new="!p" />
    <div v-if="msg" class="warn row">{{ msg }} <button v-if="dupId" class="btn sm" @click="ui.close(); navigateTo(`/paciensek/${dupId}`)">Megnyitom</button></div>
    <template #foot>
      <button class="btn" @click="ui.close()">Mégse</button>
      <button class="btn pri" @click="save">Mentés</button>
    </template>
  </ModalShell>
</template>
