<script setup lang="ts">
// Páciens adatai: két külön megjegyzésmező (egészségügyi figyelmeztetés / belső megjegyzés), fogazat, ráhagyás
import { usePatientStore } from '~/stores/patient'
import { useDataStore } from '~/stores/data'
import type { Dentition } from '~/utils/types'
import { ageOn, today } from '~/utils/dates'

export interface PatientDraft {
  name: string; birth: string; taj: string; phone: string; email: string; address: string
  healthWarning: string; internalNote: string; needsBuffer: boolean; dentition: Dentition
  /** kezelő orvos – új páciensnél kötelező (spec v2.2, 5. pont) */
  doctorId: string | null
}
const m = defineModel<PatientDraft>({ required: true })
const props = defineProps<{ isNew?: boolean }>()
const patients = usePatientStore()
const data = useDataStore()
const touchedDent = ref(!props.isNew)
const suggested = computed(() => (m.value.birth ? patients.suggestedDentition(m.value.birth) : null))
const age = computed(() => (m.value.birth ? ageOn(m.value.birth, today()) : null))
// új páciensnél a születési dátumból javasolt fogazat
watch(() => m.value.birth, () => { if (!touchedDent.value && suggested.value) m.value.dentition = suggested.value })
function setDent(d: Dentition) { touchedDent.value = true; m.value.dentition = d }
</script>

<template>
  <div>
    <div class="grid2">
      <div class="field"><label class="f">Név *</label><input v-model="m.name" class="inp" autocomplete="off"></div>
      <div class="field"><label class="f">Születési dátum * <span v-if="age !== null" class="n">({{ age }} éves)</span></label><input v-model="m.birth" class="inp" type="date"></div>
      <div class="field"><label class="f">TAJ-szám</label><input v-model="m.taj" class="inp" placeholder="000 000 000" inputmode="numeric"></div>
      <div class="field"><label class="f">Telefon *</label><input v-model="m.phone" class="inp" placeholder="+36 30 123 4567" inputmode="tel"></div>
      <div class="field"><label class="f">E-mail</label><input v-model="m.email" class="inp" type="email" inputmode="email"></div>
      <div class="field"><label class="f">Lakcím</label><input v-model="m.address" class="inp"></div>
    </div>
    <div class="field">
      <label class="f">Kezelő orvos <span v-if="isNew" class="n">* kötelező – az ő pácienseként kerül nyilvántartásba</span></label>
      <select v-model="m.doctorId" class="inp" :style="isNew && !m.doctorId ? 'border-color:#f6b7c3' : ''">
        <option :value="null">{{ isNew ? '– válassz orvost –' : '– nincs megadva –' }}</option>
        <option v-for="d in data.db.doctors" :key="d.id" :value="d.id">{{ d.name }}</option>
      </select>
    </div>
    <div class="field">
      <label class="f">⚕ Egészségügyi figyelmeztetés <span class="n">(csak az ellátást befolyásoló adat: allergia, érzékenység, vérhígító, várandósság… – mindig látszik és a PDF-re is rákerül)</span></label>
      <input v-model="m.healthWarning" class="inp" placeholder="pl. Penicillin-allergia" style="border-color:#f6b7c3">
    </div>
    <div class="field">
      <label class="f">🔒 Belső megjegyzés <span class="n">(adminisztratív – alapból rejtve, nem nyomtatódik)</span></label>
      <input v-model="m.internalNote" class="inp" placeholder="pl. délelőtti időpontot kér, számlát cégre kéri">
    </div>
    <div class="grid2">
      <div class="field">
        <label class="f">Fogazat</label>
        <div class="seg">
          <button type="button" :class="{ on: m.dentition === 'primary' }" @click="setDent('primary')">Tejfogazat</button>
          <button type="button" :class="{ on: m.dentition === 'permanent' }" @click="setDent('permanent')">Maradó fogazat</button>
        </div>
        <div v-if="suggested" class="small muted" style="margin-top:5px">Javaslat a születési dátum alapján: <b>{{ suggested === 'primary' ? 'tejfogazat' : 'maradó fogazat' }}</b></div>
      </div>
      <div class="field">
        <label class="f">Naptár</label>
        <label class="switch" :class="{ on: m.needsBuffer }" @click.prevent="m.needsBuffer = !m.needsBuffer"><i />Ráhagyást igényel (tartaléksáv az időpontjai után)</label>
      </div>
    </div>
  </div>
</template>
