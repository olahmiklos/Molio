<script setup lang="ts">
// Heti sablon szerkesztése (spec v2.4 21. pont 5.): napok és időszakok 30 perces rácson; napi több időszak is megadható.
// A módosítás vázlaton történik; a „Mentés” előtt a program jelzi, hány meglévő időpontot érint (a meglévő időpontokat nem törli és nem mozdítja el).
import { DAYS } from '~/utils/dates'
import { GRID } from '~/utils/schedule'
import type { Period, WeekTpl } from '~/utils/types'

const props = defineProps<{ tpl: WeekTpl; label?: string }>()
const emit = defineEmits<{ save: [tpl: WeekTpl]; reset: [] }>()
const draft = ref<WeekTpl>(JSON.parse(JSON.stringify(props.tpl)))
watch(() => props.tpl, v => { draft.value = JSON.parse(JSON.stringify(v)) }, { deep: true })
const dirty = computed(() => JSON.stringify(draft.value) !== JSON.stringify(props.tpl))
const day = (d: number) => (draft.value[String(d)] ||= [])
function add(d: number) { const l = day(d); const last = l[l.length - 1]; l.push(last ? [last[1], GRID[Math.min(GRID.length - 1, GRID.indexOf(last[1]) + 4)]!] as Period : ['10:00', '20:00']) }
function rm(d: number, i: number) { day(d).splice(i, 1) }
const bad = computed(() => Object.values(draft.value).some(ps => ps.some(([a, b]) => a >= b)))
</script>

<template>
  <div class="wtpl">
    <div v-for="d in 7" :key="d" class="row" style="padding:3px 0;border-bottom:1px solid var(--line);gap:6px">
      <b style="width:84px">{{ DAYS[d - 1] }}</b>
      <span v-if="!day(d).length" class="small muted" style="min-width:90px">szabad nap</span>
      <span v-for="(p, i) in day(d)" :key="i" class="row" style="gap:2px">
        <select v-model="p[0]" class="inp auto" :aria-label="`${DAYS[d - 1]} kezdés`"><option v-for="t in GRID" :key="t" :value="t">{{ t }}</option></select>–<select v-model="p[1]" class="inp auto" :aria-label="`${DAYS[d - 1]} vége`"><option v-for="t in GRID" :key="t" :value="t">{{ t }}</option></select>
        <button class="btn sm" type="button" title="Időszak törlése" @click="rm(d, i)">×</button>
      </span>
      <button class="btn sm" type="button" @click="add(d)">+ időszak</button>
    </div>
    <div v-if="bad" class="warn small" style="margin-top:6px">Az időszak vége a kezdés után legyen.</div>
    <div class="row" style="margin-top:8px">
      <button class="btn sm pri" type="button" :disabled="!dirty || bad" @click="emit('save', JSON.parse(JSON.stringify(draft)))">Sablon mentése</button>
      <button class="btn sm" type="button" :disabled="!dirty" @click="draft = JSON.parse(JSON.stringify(props.tpl))">Elvetés</button>
      <button class="btn sm" type="button" @click="emit('reset')">Alapbeállítás (kedd–péntek 10:00–20:00)</button>
    </div>
  </div>
</template>
