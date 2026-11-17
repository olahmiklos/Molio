<script setup lang="ts">
// Egészségügyi figyelmeztetés: mindig látható, kiemelve (spec 2.1.3)
defineProps<{ text?: string; compact?: boolean }>()
</script>

<template>
  <span v-if="text" class="health" :style="compact ? 'padding:4px 9px;font-size:12px' : ''"><b>⚕ Egészségügyi</b><span>{{ text }}</span></span>
</template>
