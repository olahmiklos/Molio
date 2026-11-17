<script setup lang="ts">
// Gyors betegösszefoglaló (spec 2.2.2) – szabályalapú kivonat, nem AI által írt szöveg
import { usePatientStore } from '~/stores/patient'
const props = defineProps<{ patientId: string; limit?: number }>()
const patients = usePatientStore()
const lines = computed(() => { const l = patients.summary(props.patientId); return props.limit ? l.slice(0, props.limit) : l })
</script>

<template>
  <ul class="sum">
    <li v-for="(l, i) in lines" :key="i">
      <template v-if="l.kind === 'base'"><b>{{ l.strong }}</b>, {{ l.text }}.</template>
      <template v-else-if="l.kind === 'warn'"><HealthWarning :text="l.text" compact /></template>
      <template v-else-if="l.kind === 'last'">Legutóbbi kezelés: <b>{{ l.strong }}</b>, {{ l.text }}</template>
      <template v-else-if="l.kind === 'todo'">📌 Teendő a legutóbbi bejegyzésből: <b>{{ l.text }}</b></template>
      <template v-else-if="l.kind === 'next'">{{ l.text }} – meg nem jelenési kockázat: <RiskBadge :risk="l.risk!" /></template>
      <template v-else>{{ l.text }}</template>
    </li>
  </ul>
</template>
