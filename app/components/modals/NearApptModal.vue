<script setup lang="ts">
// 19. pont (B-007): a páciensnek 7 napon belül már van időpontja – megerősítés a foglalás jóváhagyása előtt
import { useDataStore } from '~/stores/data'
import { useUiStore } from '~/stores/ui'
import { DAYS, dow, fmtShort, fromMin, toMin } from '~/utils/dates'
import type { Appointment } from '~/utils/types'

type Choice = { kind: 'book' } | { kind: 'back' } | { kind: 'add'; id: string; doctorId: string }
const props = defineProps<{ list: Appointment[]; patientName: string; onDone: (c: Choice) => void }>()
const data = useDataStore()
const ui = useUiStore()
const db = computed(() => data.db)
const docs = reactive<Record<string, string>>(Object.fromEntries(props.list.map(a => [a.id, a.doctorId])))
const tName = (id: string) => db.value.types.find(t => t.id === id)?.name || id
const dName = (id: string) => db.value.doctors.find(d => d.id === id)?.name || '–'
let done = false
function choose(c: Choice) { done = true; props.onDone(c); ui.close() }
onBeforeUnmount(() => { if (!done) props.onDone({ kind: 'back' }) })
</script>

<template>
  <ModalShell title="7 napon belül már van időpontja" data-test="near-modal">
    <p style="margin-top:0;line-height:1.55"><b>{{ patientName }}</b> páciensnek 7 napon belül már van időpontja. Mit szeretnél?</p>
    <div v-for="a in list" :key="a.id" class="card" style="margin:0 0 10px;box-shadow:none;border:1px solid var(--line)">
      <div><b>{{ fmtShort(a.date) }} ({{ DAYS[dow(a.date) - 1]!.toLowerCase() }}) {{ a.start }}–{{ fromMin(toMin(a.start) + a.dur) }}</b>, {{ dName(a.doctorId) }} – {{ a.typeIds.map(tName).join(', ') }}</div>
      <div class="row" style="margin-top:8px">
        <label class="small muted">Az új kezelést végezze:</label>
        <select v-model="docs[a.id]" class="inp auto"><option v-for="d in db.doctors" :key="d.id" :value="d.id">{{ d.name }}</option></select>
        <button class="btn sm go" @click="choose({ kind: 'add', id: a.id, doctorId: docs[a.id]! })">Hozzáadás ehhez</button>
      </div>
    </div>
    <div class="small muted">A meglévő foglalás a hozzáadott kezelés idejével meghosszabbodik. Az orvos alapértelmezése a meglévő időpont orvosa.</div>
    <template #foot>
      <button class="btn" @click="choose({ kind: 'back' })">Vissza</button>
      <div class="spacer" />
      <button class="btn pri" @click="choose({ kind: 'book' })">Foglalás erre az időpontra</button>
    </template>
  </ModalShell>
</template>
