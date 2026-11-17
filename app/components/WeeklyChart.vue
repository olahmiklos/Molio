<script setup lang="ts">
// Heti fogyás: elmúlt 8 hét felhasználása és a lefoglalt kezelésekből tervezett fogyás
import { useInventoryStore } from '~/stores/inventory'
import type { Item } from '~/utils/types'
import { fmtNum, fmtShort } from '~/utils/dates'
const props = defineProps<{ item: Item }>()
const inv = useInventoryStore()
const W = 820, H = 210, pl = 40, pb = 36
const d = computed(() => inv.weekly(props.item))
const max = computed(() => Math.max(1, ...d.value.weeks.map(w => w.past + w.plan)))
const bw = computed(() => (W - pl) / d.value.weeks.length)
const sc = computed(() => (H - pb - 24) / max.value)
</script>

<template>
  <svg :viewBox="`0 0 ${W} ${H}`" width="100%" :style="`max-width:${W}px`">
    <g v-for="f in [0, 0.5, 1]" :key="f">
      <line :x1="pl" :x2="W" :y1="H - pb - (H - pb - 24) * f" :y2="H - pb - (H - pb - 24) * f" stroke="#e8eef1" />
      <text :x="pl - 6" :y="H - pb - (H - pb - 24) * f + 4" font-size="10" text-anchor="end" fill="#64748b">{{ fmtNum(max * f) }}</text>
    </g>
    <g v-for="(w, i) in d.weeks" :key="w.s">
      <rect v-if="w.past" :x="pl + i * bw + 3" :y="H - pb - w.past * sc" :width="bw - 6" :height="w.past * sc" fill="#3fa463" rx="2"><title>{{ fmtShort(w.s) }}: {{ fmtNum(w.past) }} {{ item.unit }} felhasználva</title></rect>
      <rect v-if="w.plan" :x="pl + i * bw + 3" :y="H - pb - w.past * sc - w.plan * sc" :width="bw - 6" :height="w.plan * sc" fill="#f7a8c8" rx="2"><title>{{ fmtShort(w.s) }}: {{ fmtNum(w.plan) }} {{ item.unit }} tervezett</title></rect>
      <text v-if="i % 2 === 0" :x="pl + i * bw + bw / 2" :y="H - pb + 14" font-size="10" text-anchor="middle" fill="#64748b">{{ fmtShort(w.s) }}</text>
      <g v-if="w.s === d.w0">
        <line :x1="pl + i * bw" :x2="pl + i * bw" y1="6" :y2="H - pb" stroke="#94a3b8" stroke-dasharray="3 3" />
        <text :x="pl + i * bw + 3" y="13" font-size="10" fill="#64748b">ez a hét</text>
      </g>
    </g>
    <rect :x="pl" :y="H - 12" width="10" height="10" fill="#3fa463" /><text :x="pl + 14" :y="H - 3" font-size="11" fill="#334155">felhasználva</text>
    <rect :x="pl + 110" :y="H - 12" width="10" height="10" fill="#f7a8c8" /><text :x="pl + 124" :y="H - 3" font-size="11" fill="#334155">tervezett (lefoglalt kezelések)</text>
  </svg>
</template>
