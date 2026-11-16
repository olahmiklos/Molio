<script setup lang="ts">
const app = useAppStore()
</script>

<template>
  <main style="font-family: system-ui, sans-serif; padding: 2rem">
    <h1>{{ app.name }}</h1>
    <p>Az alapprojekt fut. A funkciók a specifikáció elkészülte után kerülnek bele.</p>
  </main>
</template>
