<script setup lang="ts">
// Főoldal (Naptár). v2.4 10. pont 6.: az orvosnak szóló, jóváhagyásra váró tájékoztatók száma a főoldalon is látszik.
import { useDataStore } from '~/stores/data'
import { pendingInfos } from '~/utils/v24'
const data = useDataStore()
const n = computed(() => pendingInfos(data.db).length)
</script>

<template>
  <div>
    <NuxtLink v-if="n" to="/emlekeztetok?tab=info" class="alertbar" style="background:#eef6fb;color:#1d5c8c;border-radius:10px;margin-bottom:10px" data-test="fooldal-tajekoztato">✉ {{ n }} tájékoztató vár jóváhagyásra – az orvos a Teendők között olvashatja el és küldheti ki →</NuxtLink>
    <CalendarView />
  </div>
</template>
