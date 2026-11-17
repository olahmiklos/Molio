<script setup lang="ts">
import { useUiStore } from '~/stores/ui'
defineProps<{ title: string; wide?: boolean }>()
const ui = useUiStore()
</script>

<template>
  <div class="modal" :class="{ wide }">
    <div class="mh">
      <h2>{{ title }}</h2>
      <slot name="head" />
      <button class="x" aria-label="Bezárás" @click="ui.close()">×</button>
    </div>
    <div class="mb"><slot /></div>
    <div v-if="$slots.foot" class="mf"><slot name="foot" /></div>
  </div>
</template>
