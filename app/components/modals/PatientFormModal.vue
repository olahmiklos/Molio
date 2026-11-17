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
  healthWarning: p?.healthWarning || '', internalNote: p?.internalNote || '', needsBuffer: !!p?.needsBuffer, dentition: p?.dentition || 'permanent',
})
const msg = ref('')
const dupId = ref<string | null>(null)
function save() {
  const d = draft.value
  msg.value = ''; dupId.value = null
  if (!d.name.trim() || !d.birth || !d.phone.trim()) { msg.value = 'A név, a születési dátum és a telefonszám kötelező.'; return }
  if (!p) {
    const dup = patients.findDuplicate(d.name, d.birth)
    if (dup) { msg.value = `Már van ilyen páciens: ${dup.name} (szül. ${fmtBirth(dup.birth)}).`; dupId.value = dup.id; return }
    const np = patients.create({ ...d, name: d.name.trim(), phone: d.phone.trim() })
    ui.close(); navigateTo(`/paciensek/${np.id}`); ui.toast('Páciens felvéve')
  } else {
    patients.update(p.id, { ...d, name: d.name.trim(), phone: d.phone.trim() })
    ui.close(); ui.toast('Adatok mentve')
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
