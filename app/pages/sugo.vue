<script setup lang="ts">
// Súgó: a felhasználói kézikönyv letöltése (a buildkor készül, így minden kiadással frissül)
import { APP_VERSION, MANUAL, SPEC } from '~/utils/meta'
interface ManualMeta { version: string; spec: string; builtAtText: string; branch: string; commit: string; preview: boolean; pages: number }
const meta = ref<ManualMeta | null>(null)
const failed = ref(false)
onMounted(async () => {
  try { meta.value = await $fetch<ManualMeta>(MANUAL.meta, { query: { t: Date.now() } }) } catch { failed.value = true }
})
const TOPICS = [
  ['Kezelés diktálással', 'fogszám és felszín, anyagjavaslat, jóváhagyás, státuszfelvétel'],
  ['Páciens-tájékoztató', 'vázlat → orvosi jóváhagyás → küldés'],
  ['Beleegyező nyilatkozat', 'aláírás tableten, PDF a kartonba'],
  ['Raktár', 'átlagár, gyártási szám és lejárat, rendelési javaslat, visszahívás'],
  ['Kontroll-meghívók', 'fogkő 6 havonta, állapotfelmérés évente'],
  ['Sterilizációs napló', 'Bowie–Dick-teszt, tételszám a kartonban'],
  ['EESZT és számlázás', 'mi történik majd az éles rendszerben'],
]
</script>

<template>
  <div>
    <div class="pagehead"><h1>Súgó és felhasználói kézikönyv</h1></div>
    <div class="card" style="border-top:5px solid var(--green)">
      <div class="row" style="gap:18px;align-items:flex-start">
        <div style="font-size:54px;line-height:1">📘</div>
        <div style="flex:1;min-width:240px">
          <h2 style="margin-top:0">Molio – Felhasználói kézikönyv (PDF)</h2>
          <p class="muted" style="margin-top:0;line-height:1.6">A kézikönyv a programmal együtt frissül: minden új kiadáskor automatikusan újra elkészül, így mindig az éppen futó verziót írja le.</p>
          <div v-if="meta" class="kv" style="grid-template-columns:150px 1fr;margin-bottom:12px">
            <div>Verzió</div><div><b>{{ meta.version }}</b></div>
            <div>Specifikáció</div><div>{{ meta.spec }}</div>
            <div>Kelte</div><div>{{ meta.builtAtText }}<span v-if="meta.commit" class="muted small"> · {{ meta.commit }}</span></div>
            <div>Terjedelem</div><div>{{ meta.pages }} oldal</div>
          </div>
          <div v-if="meta?.preview" class="warn">Ez a teszt-előnézet ({{ meta.branch }} ág) kézikönyve, nem a kiadott verzióé.</div>
          <div v-if="failed" class="warn">A kézikönyv adatai most nem érhetők el (offline vagy helyi fejlesztői futtatás). Online, a kiadott oldalon letölthető.</div>
          <div class="row">
            <a class="btn pri" :href="MANUAL.pdf" download="Molio_felhasznaloi_kezikonyv.pdf"><AppIcon name="download" :size="16" />Kézikönyv letöltése (PDF)</a>
            <a class="btn" :href="MANUAL.pdf" target="_blank" rel="noopener">Megnyitás új lapon</a>
          </div>
        </div>
      </div>
    </div>
    <div class="card">
      <h2>Miről szól?</h2>
      <div v-for="[t, d] in TOPICS" :key="t" class="row" style="padding:7px 0;border-bottom:1px solid #eef1f3"><b style="min-width:200px">{{ t }}</b><span class="muted">{{ d }}</span></div>
      <p class="small muted" style="margin-bottom:0">Program: Molio {{ APP_VERSION }} · {{ SPEC.title }} · <NuxtLink to="/nevjegy">Névjegy</NuxtLink></p>
    </div>
  </div>
</template>
