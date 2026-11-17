<script setup lang="ts">
import { useDataStore } from '~/stores/data'
import { useUiStore } from '~/stores/ui'
import { useInventoryStore } from '~/stores/inventory'
import { useTreatmentStore } from '~/stores/treatment'
import { SPEC, APP_VERSION } from '~/utils/meta'

const data = useDataStore()
const ui = useUiStore()
const inv = useInventoryStore()
const tx = useTreatmentStore()
const route = useRoute()
const st = computed(() => data.db.settings)

const nav = [
  { to: '/', label: 'Naptár', short: 'Naptár', icon: 'calendar', match: (p: string) => p === '/' },
  { to: '/paciensek', label: 'Páciensek', short: 'Páciensek', icon: 'users', match: (p: string) => p.startsWith('/paciensek') },
  { to: '/kezeles', label: 'Kezelés', short: 'Kezelés', icon: 'tooth', match: (p: string) => p.startsWith('/kezeles') },
  { to: '/emlekeztetok', label: 'Emlékeztetők', short: 'Emlékezt.', icon: 'bell', match: (p: string) => p.startsWith('/emlekeztetok') },
  { to: '/raktar', label: 'Raktár', short: 'Raktár', icon: 'box', match: (p: string) => p.startsWith('/raktar') },
  { to: '/beallitasok', label: 'Beállítások', short: 'Beáll.', icon: 'gear', match: (p: string) => p.startsWith('/beallitasok') || p.startsWith('/nevjegy') },
]

// PWA: új verzió esetén a felhasználó dönt az újratöltésről
const { $pwa } = useNuxtApp() as any
watch(() => $pwa?.needRefresh, v => { if (v) ui.setUpdate(() => $pwa.updateServiceWorker(true)) }, { immediate: true })

onMounted(() => {
  const set = () => { ui.online = navigator.onLine }
  set(); window.addEventListener('online', set); window.addEventListener('offline', set)
  window.addEventListener('keydown', e => { if (e.key === 'Escape') { if (ui.confirmState) ui.answer(false); else ui.close() } })
})
</script>

<template>
  <div>
    <div class="topbar">
      <span>{{ st.address }}</span><span>|</span><span>☎ {{ st.phone }}</span><span>|</span><span>Rendelés: hétfő–péntek {{ st.startHour }}:00–{{ st.endHour }}:00</span>
    </div>
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
          {{ n.label }}<span v-if="n.to === '/kezeles' && tx.active" class="flagdot" style="margin-left:6px;background:var(--pink)">●</span>
        </NuxtLink>
      </nav>
    </header>
    <div class="demobar">
      <b>Bemutató verzió.</b>
      <span>Csak kitalált adatot rögzíts. A módosítások csak <b>ezen az eszközön és ebben a böngészőben</b> frissülnek és látszanak, más eszközön a demó a saját mintaadataival indul.</span>
      <span v-if="!ui.online" class="badge b-yellow">offline – a diktáláshoz internet kell, a szöveg gépelhető</span>
    </div>
    <NuxtLink v-if="inv.alerts.length" to="/raktar" class="alertbar">
      ⚠ {{ inv.alerts.length }} anyagot szükséges megrendelni: {{ inv.alerts.map(i => i.name).join(', ') }} – megnyitás a Raktárban →
    </NuxtLink>
    <div v-if="ui.updateAvailable" class="hint" style="margin:0;border-radius:0;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <b>Új verzió érhető el.</b><span>Az újratöltés után a frissített program fut.</span>
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
        Molio {{ APP_VERSION }} – bemutató program kitalált adatokkal.<br>
        Készült: <b>{{ SPEC.title }}</b> ({{ SPEC.version }}) alapján. <NuxtLink to="/nevjegy">Névjegy</NuxtLink>
      </div>
      <div class="dots"><i style="background:#ec2f7b" /><i style="background:#f5891f" /><i style="background:#13b0a5" /><i style="background:#3fa463" /><i style="background:#8b4fe0" /><i style="background:#2a8ccc" /></div>
    </footer>
    <nav class="tabbar">
      <NuxtLink v-for="n in nav" :key="n.to" :to="n.to" :class="{ on: n.match(route.path) }">
        <span class="ic"><AppIcon :name="n.icon" :size="22" /></span>{{ n.short }}
      </NuxtLink>
    </nav>

    <!-- modális ablakok -->
    <template v-for="m in ui.modals" :key="m.id">
      <div class="backdrop" @mousedown.self="ui.close()">
        <component :is="m.component" v-bind="m.props" />
      </div>
    </template>
    <div v-if="ui.confirmState" class="backdrop" style="z-index:150" @mousedown.self="ui.answer(false)">
      <div class="modal">
        <div class="mh"><h2>Megerősítés</h2></div>
        <div class="mb" style="line-height:1.55" v-html="ui.confirmState.msg" />
        <div class="mf">
          <button class="btn" @click="ui.answer(false)">Mégse</button>
          <button class="btn" :class="ui.confirmState.danger ? 'danger' : 'pri'" @click="ui.answer(true)">{{ ui.confirmState.yes }}</button>
        </div>
      </div>
    </div>
    <div v-if="ui.toastMsg" class="toast">{{ ui.toastMsg }}</div>
  </div>
</template>
