<script setup lang="ts">
import { useDataStore } from '~/stores/data'
import { useUiStore } from '~/stores/ui'
import { useInventoryStore } from '~/stores/inventory'
import { useTreatmentStore } from '~/stores/treatment'
import { useSuggestionStore } from '~/stores/suggestion'
import { useAppointmentStore } from '~/stores/appointment'
import { useRepository } from '~/repositories'
import { BUILD_DATE_HU, SPEC, VERSION_BADGE, VERSION_LINE, buildInfo } from '~/utils/meta'
import { logVisit } from '~/utils/visit'
import { todoAlerts } from '~/utils/v24'

const data = useDataStore()
const ui = useUiStore()
const inv = useInventoryStore()
const sugs = useSuggestionStore()
const ap = useAppointmentStore()
const tx = useTreatmentStore()
const route = useRoute()
const st = computed(() => data.db.settings)

const nav = [
  { to: '/', label: 'Naptár', short: 'Naptár', icon: 'calendar', match: (p: string) => p === '/' },
  { to: '/paciensek', label: 'Páciensek', short: 'Páciensek', icon: 'users', match: (p: string) => p.startsWith('/paciensek') },
  { to: '/kezeles', label: 'Kezelés', short: 'Kezelés', icon: 'tooth', match: (p: string) => p.startsWith('/kezeles') },
  { to: '/emlekeztetok', label: 'Teendők', short: 'Teendők', icon: 'bell', match: (p: string) => p.startsWith('/emlekeztetok') },
  { to: '/raktar', label: 'Raktár', short: 'Raktár', icon: 'box', match: (p: string) => p.startsWith('/raktar') },
  { to: '/sterilizalas', label: 'Sterilizálás', short: 'Steril.', icon: 'shield', match: (p: string) => p.startsWith('/sterilizalas') },
  { to: '/beallitasok', label: 'Beállítások', short: 'Beáll.', icon: 'gear', match: (p: string) => p.startsWith('/beallitasok') || p.startsWith('/nevjegy') || p.startsWith('/sugo') },
]

// PWA: új verzió esetén a program magától frissít, hogy senki ne ragadjon egy régi verzióban.
// Ha éppen folyamatban lévő kezelés vagy nyitott ablak van, megvárja a végét (addig a sáv kínálja a kézi újratöltést).
const { $pwa } = useNuxtApp() as any
const busy = computed(() => tx.active || ui.modals.length > 0 || !!ui.confirmState)
// az új service worker aktiválása; ha a lapot még nem ő vezérli (első látogatás), nincs controllerchange, ezért biztonsági újratöltés
function applyUpdate() {
  $pwa.updateServiceWorker(true)
  setTimeout(() => window.location.reload(), 2500)
}
// v2.3 6. pont: a main ágon (nyilvános demó) nincs csendes frissítés – felugró „Új verzió érhető el” ablak, OK után (piszkozatmentéssel) újratöltés;
// a teszt ágon a korábbi működés marad (magától frissít, ha nincs folyamatban lévő munka)
const isMain = buildInfo().env === 'DEMÓ'
const showUpdate = ref(false)
const RESUME = 'molio-resume-v23'
function tryAutoUpdate() {
  if (!$pwa?.needRefresh) return
  if (isMain) { showUpdate.value = true; return }
  if (busy.value) { ui.setUpdate(applyUpdate); return }
  applyUpdate()
}
watch(() => $pwa?.needRefresh, tryAutoUpdate, { immediate: true })
watch(busy, b => { if (!b && !isMain) tryAutoUpdate() })
/** OK: a folyamatban lévő diktálás / szerkesztés piszkozatba kerül, majd az új verzió aktiválódik és az oldal újratöltődik */
async function confirmUpdate() {
  try {
    if (tx.active && tx.s) {
      tx.applyParse(); tx.saveDraft()
      localStorage.setItem(RESUME, JSON.stringify({ patientId: tx.s.patientId, apptId: tx.s.appointmentId }))
      await useRepository().save(data.db)
    }
  } catch { /* a frissítés ettől még lefusson */ }
  applyUpdate()
}
async function offerResume() {
  let j: { patientId: string; apptId: string | null } | null = null
  try { j = JSON.parse(localStorage.getItem(RESUME) || 'null'); localStorage.removeItem(RESUME) } catch { /* nincs */ }
  if (!j) return
  if (await ui.confirm('A frissítés előtt a folyamatban lévő diktálást <b>piszkozatba mentettük</b>. Folytatod ott, ahol abbahagytad?', 'Folytatás', false, 'Később')) {
    if (j.apptId) tx.startFromAppointment(j.apptId); else tx.startNew(j.patientId)
    navigateTo('/kezeles')
  }
}

/** v2.4 7., 10., 21. pont: a Teendők jelvénye – ütközések, jóváhagyásra váró tájékoztatók, beosztáson kívüli időpontok, lemondást jelzők */
const alerts = computed(() => todoAlerts(data.db))
const todoBadge = computed(() => alerts.value.total)
const todoTitle = computed(() => alerts.value.parts.join(' · '))

onMounted(() => {
  void nextTick(offerResume)
  // v2.4 20. pont: látogatás naplózása (látogatásonként egyszer; a hiba nem zavar más funkciót)
  void logVisit()
  // a main ágon 4 óránként háttér-ellenőrzés a nyitott oldalon (előtérbe kerüléskor és betöltéskor is)
  if (isMain) setInterval(() => navigator.serviceWorker?.getRegistration().then(r => r?.update()).catch(() => {}), 4 * 3600 * 1000)
  const set = () => { ui.online = navigator.onLine }
  set(); window.addEventListener('online', set); window.addEventListener('offline', set)
  // előtérbe kerüléskor azonnal keres új verziót (telefonon, tableten a háttérből visszatérve)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') navigator.serviceWorker?.getRegistration().then(r => r?.update()).catch(() => {})
  })
  window.addEventListener('keydown', e => { if (e.key === 'Escape') { if (ui.confirmState) ui.answer(false); else ui.close() } })
})
</script>

<template>
  <div>
    <!-- v2.4 22. pont: a rendelő adatsora (cím, telefon, rendelési idő, Súgó link) a fejlécből kikerült; a Súgó a Beállításokból érhető el -->
    <header class="hdr">
      <NuxtLink to="/" class="brand">
        <img src="/logo.svg" alt="">
        <div>
          <div class="nm">Mol<b>io</b></div>
          <small>{{ data.db.company.name }} · demó</small>
        </div>
      </NuxtLink>
      <nav class="nav">
        <NuxtLink v-for="n in nav" :key="n.to" :to="n.to" :class="{ on: n.match(route.path) }">
          {{ n.label }}<span v-if="n.to === '/kezeles' && tx.active" class="flagdot" style="margin-left:6px;background:var(--pink)">●</span><span v-if="n.to === '/emlekeztetok' && todoBadge" class="flagdot" style="margin-left:6px" :title="todoTitle" data-test="teendo-jelveny">{{ todoBadge }}</span>
        </NuxtLink>
      </nav>
    </header>
    <div class="demobar">
      <b>Bemutató verzió.</b>
      <span>Csak kitalált adatot rögzíts. A módosítások csak <b>ezen az eszközön és ebben a böngészőben</b> frissülnek és látszanak, más eszközön a demó a saját mintaadataival indul.</span>
      <span data-test="latogatas-tajekoztato">A bemutató a látogatás idejét és az IP-címet naplózza.</span>
      <span v-if="!ui.online" class="badge b-yellow">offline – a diktáláshoz internet kell, a szöveg gépelhető</span>
    </div>
    <NuxtLink v-if="inv.alerts.length" to="/raktar" class="alertbar">
      ⚠ {{ inv.alerts.length }} anyagot szükséges megrendelni: {{ inv.alerts.map(i => i.name).join(', ') }} – megnyitás a Raktárban →
    </NuxtLink>
    <NuxtLink v-if="sugs.count" to="/emlekeztetok?tab=todo" class="alertbar" style="background:#fff3e0;color:#9a4b00">
      📋 {{ sugs.count }} javasolt kezeléshez időpontot kell egyeztetni{{ sugs.overdueCount ? ` (${sugs.overdueCount} határidőn túl)` : '' }} – megnyitás a Teendők között →
    </NuxtLink>
    <NuxtLink v-if="ap.signals.length" to="/emlekeztetok" class="alertbar" style="background:#fdecea;color:#a1241a">
      ✉ {{ ap.signals.length }} páciens lemondást jelzett az emlékeztetőre (NEM válasz) – az asszisztens döntése szükséges →
    </NuxtLink>
    <div v-if="ui.updateAvailable" class="hint" style="margin:0;border-radius:0;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <b>Új verzió érhető el.</b><span>A folyamatban lévő munka befejezése után magától frissül, vagy most is újratöltheted.</span>
      <button class="btn sm pri" @click="ui.applyUpdate()">Újratöltés most</button>
      <button class="btn sm" @click="ui.updateAvailable = false">Később</button>
    </div>
    <main class="main">
      <slot />
    </main>
    <footer class="foot">
      <div>
        <div class="fb">Mol<b>io</b> · {{ data.db.company.name }}</div>
        <div style="margin-top:6px">{{ st.address }}</div>
      </div>
      <div>
        <div class="small" style="opacity:.7">Bejelentkezés:</div>
        <div class="ph">{{ st.phone }}</div>
      </div>
      <div class="small" style="opacity:.75;max-width:420px;line-height:1.5">
        <b>{{ VERSION_LINE }}</b> · build: {{ BUILD_DATE_HU }} <span v-if="buildInfo().env !== 'DEMÓ'" class="badge b-yellow">{{ buildInfo().env }}</span> – bemutató program kitalált adatokkal. <span style="opacity:.8">{{ VERSION_BADGE }}</span><br>
        Specifikáció: {{ SPEC.title }}. <NuxtLink to="/nevjegy">Névjegy</NuxtLink> · <NuxtLink to="/sugo">Felhasználói kézikönyv (PDF)</NuxtLink>
      </div>
      <div class="dots"><i style="background:#ec2f7b" /><i style="background:#f5891f" /><i style="background:#13b0a5" /><i style="background:#3fa463" /><i style="background:#8b4fe0" /><i style="background:#2a8ccc" /></div>
    </footer>
    <nav class="tabbar">
      <NuxtLink v-for="n in nav" :key="n.to" :to="n.to" :class="{ on: n.match(route.path) }">
        <span class="ic"><AppIcon :name="n.icon" :size="22" /><i v-if="n.to === '/emlekeztetok' && todoBadge" class="tb-badge">{{ todoBadge }}</i></span>{{ n.short }}
      </NuxtLink>
    </nav>

    <!-- modális ablakok -->
    <template v-for="m in ui.modals" :key="m.id">
      <div class="backdrop" @mousedown.self="ui.close()">
        <component :is="m.component" v-bind="m.props" />
      </div>
    </template>
    <div v-if="showUpdate" class="backdrop" style="z-index:200;align-items:center" role="alertdialog" aria-modal="true" aria-labelledby="upd-h" data-test="uj-verzio">
      <div class="modal" style="width:480px;margin-bottom:env(safe-area-inset-bottom)">
        <div class="mh"><h2 id="upd-h">Új verzió érhető el</h2></div>
        <div class="mb" style="line-height:1.55">Most került kiadásra a Molio új verziója. Az új verzió használatához kattintson az OK gombra – az oldal újratöltődik. A folyamatban lévő munkát (pl. diktálást) előtte piszkozatba mentjük, újratöltés után felajánljuk a folytatást.</div>
        <div class="mf" style="padding-bottom:max(14px, env(safe-area-inset-bottom))"><button class="btn pri" @click="confirmUpdate">OK</button></div>
      </div>
    </div>
    <div v-if="ui.confirmState" class="backdrop" style="z-index:250" @mousedown.self="ui.answer(false)">
      <div class="modal">
        <div class="mh"><h2>Megerősítés</h2></div>
        <div class="mb" style="line-height:1.55" v-html="ui.confirmState.msg" />
        <div class="mf">
          <button class="btn" @click="ui.answer(false)">{{ ui.confirmState.no }}</button>
          <button class="btn" :class="ui.confirmState.danger ? 'danger' : 'pri'" @click="ui.answer(true)">{{ ui.confirmState.yes }}</button>
        </div>
      </div>
    </div>
    <div v-if="ui.toastMsg" class="toast">{{ ui.toastMsg }}<button v-if="ui.toastAction" class="btn sm" style="margin-left:12px" @click="const act = ui.toastAction; ui.toastMsg = ''; ui.toastAction = null; act.fn()">{{ ui.toastAction.label }}</button></div>
  </div>
</template>
