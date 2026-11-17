<script setup lang="ts">
// Egy fog állapotának javítása a státuszvázlatban
import { useDataStore } from '~/stores/data'
import { useTreatmentStore } from '~/stores/treatment'
import { useUiStore } from '~/stores/ui'
import { STATUS_STYLE } from '~/utils/defaults'
import { toothLabel } from '~/utils/teeth'

const props = defineProps<{ n: number }>()
const data = useDataStore()
const tx = useTreatmentStore()
const ui = useUiStore()
const cur = ref<string[]>([...(tx.statusDraft[props.n] || [])])
const toggle = (id: string) => {
  if (cur.value.includes(id)) cur.value = cur.value.filter(x => x !== id)
  else cur.value = id === 'ep' ? ['ep'] : [...cur.value.filter(x => x !== 'ep'), id]
}
function save() { tx.setToothStatus(props.n, cur.value); ui.close() }
</script>

<template>
  <ModalShell :title="toothLabel(n)">
    <p class="muted" style="margin-top:0">Jelöld be a fog állapotát (több is lehet, pl. gyökérkezelt és korona).</p>
    <div class="row">
      <span v-for="d in data.db.settings.statusDict" :key="d.id" class="chip" :class="{ on: cur.includes(d.id) }" @click="toggle(d.id)">
        <i :style="`width:10px;height:10px;border-radius:3px;background:${STATUS_STYLE[d.id]?.color || '#999'}`" />{{ d.name }}
      </span>
    </div>
    <template #foot>
      <button class="btn" @click="ui.close()">Mégse</button>
      <button class="btn pri" @click="save">Rendben</button>
    </template>
  </ModalShell>
</template>
