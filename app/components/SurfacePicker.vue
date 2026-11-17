<script setup lang="ts">
// A kiválasztott fog nagyítva, öt mezőre osztva: a felszín kattintással / koppintással jelölhető (spec 2.2.7)
import type { Surface } from '~/utils/types'
import { isUpper, onViewerLeft, surfaceCode, surfaceName, toothLabel } from '~/utils/teeth'

const props = defineProps<{ n: number; value: Surface[]; planned?: Surface[] }>()
const emit = defineEmits<{ toggle: [s: Surface] }>()
const up = computed(() => isUpper(props.n))
const mesRight = computed(() => onViewerLeft(props.n))
const map = computed(() => ({ top: (up.value ? 'V' : 'L') as Surface, bottom: (up.value ? 'L' : 'V') as Surface, left: (mesRight.value ? 'D' : 'M') as Surface, right: (mesRight.value ? 'M' : 'D') as Surface }))
const P = {
  top: '6,6 144,6 106,44 44,44', bottom: '6,144 144,144 106,106 44,106', left: '6,6 44,44 44,106 6,144', right: '144,6 106,44 106,106 144,144',
}
const LP = { top: [75, 30], bottom: [75, 130], left: [24, 80], right: [126, 80] } as Record<string, [number, number]>
const fill = (s: Surface) => (props.value.includes(s) ? '#ec2f7b' : props.planned?.includes(s) ? '#fde3ee' : '#f1f5f8')
const txt = (s: Surface) => (props.value.includes(s) ? '#fff' : '#4e5661')
</script>

<template>
  <div class="surfpick">
    <svg viewBox="0 0 150 150" role="group" :aria-label="`${toothLabel(n)} felszínei`">
      <polygon v-for="(pts, k) in P" :key="k" :points="pts" class="seg-s" :fill="fill(map[k])" stroke="#fff" stroke-width="3" @click="emit('toggle', map[k])" />
      <rect x="44" y="44" width="62" height="62" rx="6" class="seg-s" :fill="fill('O')" stroke="#fff" stroke-width="3" @click="emit('toggle', 'O')" />
      <text v-for="(pos, k) in LP" :key="'t' + k" :x="pos[0]" :y="pos[1] + 5" text-anchor="middle" font-size="15" font-weight="800" :fill="txt(map[k as keyof typeof map])" pointer-events="none">{{ surfaceCode(n, map[k as keyof typeof map]) }}</text>
      <text x="75" y="80" text-anchor="middle" font-size="17" font-weight="800" :fill="txt('O')" pointer-events="none">{{ surfaceCode(n, 'O') }}</text>
    </svg>
    <div class="small" style="line-height:1.7;min-width:180px">
      <div style="font-size:15px;font-weight:800;color:var(--dark)">{{ toothLabel(n) }}</div>
      <div v-for="s in (['M', 'O', 'D', 'V', 'L'] as Surface[])" :key="s">
        <b :style="value.includes(s) ? 'color:var(--pink)' : ''">{{ surfaceCode(n, s) }}</b> – {{ surfaceName(n, s) }}
        <span v-if="planned?.includes(s)" class="badge b-gray">tervezett</span>
      </div>
    </div>
  </div>
</template>
