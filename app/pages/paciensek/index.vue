<script setup lang="ts">
import { usePatientStore } from '~/stores/patient'
import { useUiStore } from '~/stores/ui'
import { fmtBirth, fmtDate } from '~/utils/dates'
import PatientFormModal from '~/components/modals/PatientFormModal.vue'

const patients = usePatientStore()
const ui = useUiStore()
const q = ref('')
const list = computed(() => patients.search(q.value))
</script>

<template>
  <div>
    <div class="pagehead">
      <h1>Páciensek</h1>
      <span class="pill">{{ patients.sorted.length }} fő</span>
      <div class="spacer" />
      <input v-model="q" class="inp" style="max-width:320px" placeholder="Keresés név, telefon vagy TAJ alapján">
      <button class="btn pri" @click="ui.open(PatientFormModal, {})"><AppIcon name="plus" :size="16" />Új páciens</button>
    </div>
    <div class="card flush scroll-x">
      <table class="t">
        <thead><tr><th>Név</th><th>Születési dátum</th><th class="hide-m">TAJ</th><th class="hide-m">Telefon</th><th>Utolsó kezelés</th><th>Következő időpont</th></tr></thead>
        <tbody>
          <tr v-for="p in list" :key="p.id" class="click" @click="navigateTo(`/paciensek/${p.id}`)">
            <td>
              <b>{{ p.name }}</b>
              <span v-if="p.healthWarning" class="badge b-red" style="margin-left:6px" :title="p.healthWarning">⚕</span>
              <span v-if="p.dentition === 'primary'" class="badge b-gray" style="margin-left:4px">tejfog</span>
              <span v-if="p.needsBuffer" class="badge b-buf" style="margin-left:4px" title="Ráhagyást igényel">ráhagyás</span>
            </td>
            <td class="nowrap">{{ fmtBirth(p.birth) }}</td>
            <td class="hide-m nowrap">{{ p.taj }}</td>
            <td class="hide-m nowrap">{{ p.phone }}</td>
            <td class="nowrap">{{ patients.lastRecord(p.id) ? fmtDate(patients.lastRecord(p.id)!.date) : '–' }}</td>
            <td class="nowrap">{{ patients.upcoming(p.id)[0] ? fmtDate(patients.upcoming(p.id)[0]!.date) + ' ' + patients.upcoming(p.id)[0]!.start : '–' }}</td>
          </tr>
          <tr v-if="!list.length"><td colspan="6" class="muted">Nincs találat.</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
