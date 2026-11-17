<script setup lang="ts">
// Belső megjegyzés: alapból rejtve; egér fölé húzásra, kattintásra vagy koppintásra látszik (spec 2.1.3)
defineProps<{ text?: string }>()
const open = ref(false)
</script>

<template>
  <button v-if="text" type="button" class="secret" :class="{ open }" title="Belső megjegyzés – kattints vagy vidd fölé az egeret" @click="open = !open">
    <span class="ph">🔒 belső megjegyzés</span><span class="tx">{{ text }}</span>
  </button>
  <span v-else class="muted">–</span>
</template>
