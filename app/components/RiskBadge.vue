<script setup lang="ts">
import type { Risk } from '~/utils/logic'
const props = defineProps<{ risk: Risk }>()
const LBL = { low: ['alacsony', 'b-green'], mid: ['közepes', 'b-yellow'], high: ['magas', 'b-red'] } as const
const l = computed(() => LBL[props.risk.level])
</script>

<template>
  <span class="badge" :class="l[1]" :title="risk.factors.join('; ') || 'nincs kockázati tényező'">{{ Math.round(risk.p * 100) }}% · {{ l[0] }}</span>
</template>
