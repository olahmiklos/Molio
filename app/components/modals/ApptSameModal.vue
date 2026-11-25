<script setup lang="ts">
// v2.4 9. pont (B-011): azonos páciens, azonos vagy átfedő idő – külön, érthető kérdés az általános ütközés-figyelmeztetés helyett.
// „Összevonás egy időponttá” (előre kijelölt alapértelmezés), „Külön időpont” (egy koppintással), „Vissza” (semmi nem mentődik).
import { useDataStore } from '~/stores/data'
import { useUiStore } from '~/stores/ui'
import { DAYS, dow, fmtShort, fromMin, toMin } from '~/utils/dates'
import type { Appointment } from '~/utils/types'

export type SameChoice = 'merge' | 'separate' | 'back'
const props = defineProps<{ appt: Appointment; patientName: string; onDone: (c: SameChoice) => void }>()
const data = useDataStore(), ui = useUiStore()
const db = computed(() => data.db)
const tName = (id: string) => db.value.types.find(t => t.id === id)?.name || id
const dName = (id: string) => db.value.doctors.find(d => d.id === id)?.name || '–'
let done = false
function choose(c: SameChoice) { done = true; props.onDone(c); ui.close() }
onBeforeUnmount(() => { if (!done) props.onDone('back') })
const btn = ref<HTMLButtonElement | null>(null)
onMounted(() => nextTick(() => btn.value?.focus()))
</script>

<template>
  <ModalShell title="A páciensnek ekkor már van időpontja" data-test="azonos-ido">
    <p style="margin-top:0;line-height:1.55"><b>{{ patientName }}</b> páciensnek ekkor már van időpontja: <b>{{ fmtShort(appt.date) }} ({{ DAYS[dow(appt.date) - 1]!.toLowerCase() }}) {{ appt.start }}–{{ fromMin(toMin(appt.start) + appt.dur) }}</b>, {{ dName(appt.doctorId) }} – {{ appt.typeIds.map(tName).join(', ') }}. Mit szeretnél?</p>
    <ul class="small muted" style="line-height:1.6;margin:0 0 0 18px">
      <li><b>Összevonás egy időponttá:</b> az új kezelés a meglévő időpontba kerül; a kezdés marad, az időtartam a két kezelés időtartamának összege, a ráhagyás a nagyobbik.</li>
      <li><b>Külön időpont:</b> az új foglalás külön időpontként mentődik, ütközéssel (a naptárban egymás mellett látszik, és „Időpont-ütközés” teendő keletkezik).</li>
    </ul>
    <template #foot>
      <button class="btn" @click="choose('back')">Vissza</button>
      <div class="spacer" />
      <button class="btn" data-test="kulon-idopont" @click="choose('separate')">Külön időpont</button>
      <button ref="btn" class="btn pri" data-test="osszevonas" @click="choose('merge')">Összevonás egy időponttá</button>
    </template>
  </ModalShell>
</template>
