<script setup lang="ts">
// Fogtérkép panel: váltás a feltöltött röntgenképre ugyanakkora méretben, jelmagyarázat (spec 2.2.5)
import { useDentalChartStore } from '~/stores/dentalChart'
import { usePatientStore } from '~/stores/patient'
import type { SurfaceMap } from '~/utils/types'
import { docTypeName, STATUS_STYLE } from '~/utils/defaults'
import { fmtDate } from '~/utils/dates'

const props = defineProps<{
  patientId: string
  sessKey?: string
  selected?: number[]
  focus?: number | null
  current?: SurfaceMap
  draft?: Record<string, string[]> | null
  flags?: Record<string, string>
  marks?: Record<number, 'planned' | 'added' | 'postponed'>
  hl?: number | null
  clickable?: boolean
}>()
const emit = defineEmits<{ tooth: [n: number]; hover: [n: number | null] }>()
const chart = useDentalChartStore()
const patients = usePatientStore()
const files = useFiles()
const p = computed(() => patients.byId(props.patientId)!)
const model = computed(() => chart.model(props.patientId, p.value.dentition, props.draft || undefined))
const xrays = computed(() => (props.sessKey ? chart.sessionXrays(props.patientId, props.sessKey) : chart.xrays(props.patientId)))
const v = computed(() => chart.viewOf(props.patientId))
const xrayId = computed(() => (v.value.xrayId && xrays.value.some(x => x.id === v.value.xrayId) ? v.value.xrayId : xrays.value[0]?.id || null))
const showXray = computed(() => v.value.mode === 'xray' && !!xrayId.value)
const legend = [
  ['#2a8ccc', 'tömés (kezelt felszín)'], ['#8b4fe0', 'gyökérkezelés'], ['#f5b31f', 'korona / hídtag'], ['#13b0a5', 'implantátum'],
  ['#f5891f', 'szuvas'], ['#c08457', 'gyökérmaradvány'], ['#ec2f7b', 'aktuális kezelés'],
  ['#2a8ccc', 'jelölő: előjegyzett tétel'], ['#f5b31f', 'jelölő: kezelés közben hozzáadva'],
]
</script>

<template>
  <div>
    <div class="chart-bar">
      <div class="seg">
        <button :class="{ on: !showXray }" @click="v.mode = 'chart'">🦷 Fogtérkép</button>
        <button :class="{ on: showXray }" :disabled="!xrays.length" :title="xrays.length ? '' : 'Nincs feltöltött röntgenkép'" @click="v.mode = 'xray'">🩻 Röntgen{{ xrays.length ? ` (${xrays.length})` : '' }}</button>
      </div>
      <select v-if="showXray && xrays.length > 1" class="inp auto" :value="xrayId" @change="v.xrayId = ($event.target as HTMLSelectElement).value">
        <option v-for="x in xrays" :key="x.id" :value="x.id">{{ docTypeName(x.type) }} – {{ fmtDate(x.date) }}</option>
      </select>
      <span class="pill">{{ p.dentition === 'primary' ? 'Tejfogazat (20 fog)' : 'Maradó fogazat (32 fog)' }}</span>
      <span v-if="!xrays.length" class="small muted hide-m">Röntgenkép feltöltése után egy kattintással átváltható.</span>
      <slot name="tools" />
    </div>
    <div v-if="showXray" class="xchart"><img class="xray-img" :src="files.url(xrayId)" alt="Röntgenkép"></div>
    <ToothChart v-else :dentition="p.dentition" :model="model" :selected="selected" :focus="focus" :current="current" :draft="draft" :flags="flags" :marks="marks" :hl="hl" :clickable="clickable" @tooth="emit('tooth', $event)" @hover="emit('hover', $event)" />
    <div class="xlegend">
      <span v-for="[c, l] in legend" :key="l"><i :style="`background:${c}`" />{{ l }}</span>
      <span><i style="border:1.5px dashed #9fb1c4;background:transparent" />{{ STATUS_STYLE.hianyzik!.label }}</span>
      <span class="muted hide-m">· vidd az egeret a fog fölé az előzményekhez</span><span class="muted show-m">· tartsd nyomva a fogat az előzményekhez</span>
    </div>
  </div>
</template>
