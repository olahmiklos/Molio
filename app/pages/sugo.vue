<script setup lang="ts">
// Súgó: a felhasználói kézikönyv letöltése (a buildkor készül, így minden kiadással frissül)
import { APP_VERSION, MANUAL, SPEC, DEV_TOOLS } from '~/utils/meta'
import { TRAIN_HELP, TRAIN_HELP_DEV, TRAIN_HELP_TITLE } from '~/data/betanitas'
// v2.5 2. pont: a „Diktálás betanítása – lépésről lépésre” fejezet a Súgó oldalon is olvasható (a teszt ágon is frissül; a PDF csak main kiadáskor)
const route = useRoute()
const chapter = ref<HTMLElement | null>(null)
const blocks = computed(() => (DEV_TOOLS ? [...TRAIN_HELP, TRAIN_HELP_DEV] : TRAIN_HELP))
interface ManualMeta { version: string; spec: string; builtAtText: string; branch: string; commit: string; preview: boolean; pages: number }
const meta = ref<ManualMeta | null>(null)
const failed = ref(false)
onMounted(async () => {
  const toChapter = () => { if (route.query.fejezet === 'betanitas') chapter.value?.scrollIntoView({ block: 'start' }) }
  await nextTick(); toChapter()
  try { meta.value = await $fetch<ManualMeta>(MANUAL.meta, { query: { t: Date.now() } }) } catch { failed.value = true }
  // a kézikönyv adatainak betöltése után a fejezet lejjebb kerülhet: újra odagörget
  await nextTick(); toChapter()
})
const TOPICS = [
  ['Kezelés diktálással', 'fogszám és felszín, anyagjavaslat, jóváhagyás, státuszfelvétel'],
  ['Diktálás betanítása', 'lépésről lépésre, mikor hagyd jóvá a javaslatot (lent, ezen az oldalon)'],
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
          <div v-if="meta" class="kv" style="grid-template-columns:150px minmax(0, 1fr);margin-bottom:12px;overflow-wrap:anywhere">
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
    <div ref="chapter" class="card help-ch" data-test="sugo-betanitas" style="scroll-margin-top:84px">
      <h2 style="margin-top:0">{{ TRAIN_HELP_TITLE }}</h2>
      <template v-for="b in blocks" :key="b.h">
        <h3>{{ b.h }}</h3>
        <p v-for="(t, i) in b.p || []" :key="'p' + i">{{ t }}</p>
        <ul v-if="b.li"><li v-for="(t, i) in b.li" :key="'l' + i">{{ t }}</li></ul>
        <ol v-if="b.ol"><li v-for="(t, i) in b.ol" :key="'o' + i">{{ t }}</li></ol>
      </template>
      <p class="small muted" style="margin-bottom:0"><NuxtLink to="/beallitasok?tab=train">Diktálás betanítása megnyitása →</NuxtLink></p>
    </div>
    <div class="card">
      <h2>Miről szól?</h2>
      <div v-for="[t, d] in TOPICS" :key="t" class="row" style="padding:7px 0;border-bottom:1px solid #eef1f3"><b style="min-width:200px">{{ t }}</b><span class="muted">{{ d }}</span></div>
      <p class="small muted" style="margin-bottom:0">Program: Molio {{ APP_VERSION }} · {{ SPEC.title }} · <NuxtLink to="/nevjegy">Névjegy</NuxtLink></p>
    </div>
  </div>
</template>

<style scoped>
.help-ch { line-height: 1.6; font-size: 15px }
.help-ch h3 { margin: 14px 0 4px }
.help-ch p { margin: 4px 0 }
.help-ch ul, .help-ch ol { margin: 4px 0 4px 20px; padding: 0 }
.help-ch li { margin: 3px 0; overflow-wrap: anywhere }
</style>
