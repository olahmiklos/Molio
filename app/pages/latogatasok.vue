<script setup lang="ts">
// Rejtett „Látogatások” nézet (spec v2.4 20. pont): CSAK a teszt / fejlesztői buildben létezik – a main buildben az útvonal sem jön létre (nuxt.config.ts → pages:extend),
// az olvasó végpont pedig a main gazdagépen nem létezik (worker/index.ts). A nézet mindkét ág (main és teszt) látogatásait mutatja: idő (magyar idő szerint),
// ág, IP-cím (a Worker olvassa a kérésből), verzió, közelítő hely, böngésző / eszköz, új vagy ismétlődő. 90 napos megőrzés; Export (CSV) és „Napló törlése”.
import { useUiStore } from '~/stores/ui'
import { APP_VERSION } from '~/utils/meta'

interface V { t: string; ip: string; country?: string; city?: string; ver: string; commit: string; ua: string; branch: string; bot?: boolean }
const ui = useUiStore()
const rows = ref<V[]>([])
const names = ref<Record<string, { name: string; own: boolean }>>({})
const full = ref<string[]>([])
const cap = ref(200)
const state = ref<'idle' | 'loading' | 'ok' | 'err'>('idle')
const fBranch = ref<'' | 'main' | 'teszt'>(''), fPeriod = ref<'today' | '7' | '30' | 'all'>('30'), fVer = ref(''), hideOwn = ref(true), showBots = ref(false)
const fmt = (iso: string) => new Intl.DateTimeFormat('hu-HU', { timeZone: 'Europe/Budapest', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
const huDay = (iso: string) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Budapest' }).format(new Date(iso))
async function load() {
  state.value = 'loading'
  try {
    const r = await fetch('/api/latogatas')
    const j = await r.json() as { ok?: boolean; days?: { day: string; branch: string; list: V[]; full: boolean }[]; names?: Record<string, { name: string; own: boolean }>; cap?: number; kv?: boolean }
    if (!r.ok || !j.ok) throw new Error('nem érhető el')
    rows.value = (j.days || []).flatMap(d => d.list.map(v => ({ ...v, branch: v.branch || d.branch }))).sort((a, b) => b.t.localeCompare(a.t))
    full.value = (j.days || []).filter(d => d.full).map(d => `${d.day} (${d.branch})`)
    names.value = j.names || {}; cap.value = j.cap || 200
    state.value = 'ok'
    if (j.kv === false) ui.toast('A központi tároló (MOLIO_LOG) ezen a Workeren nincs bekötve – hibanapló B-013')
  } catch { state.value = 'err' }
}
onMounted(load)
/** új vagy ismétlődő: azonos IP-ről azonos ágra korábban volt-e látogatás */
const repeat = computed(() => {
  const seen = new Set<string>(), out = new Map<V, boolean>()
  rows.value.slice().reverse().forEach(v => { const k = v.branch + '|' + v.ip; out.set(v, seen.has(k)); seen.add(k) })
  return out
})
const since = computed(() => { const n = Date.now(); return fPeriod.value === 'today' ? huDay(new Date(n).toISOString()) : fPeriod.value === 'all' ? '' : new Date(n - Number(fPeriod.value) * 86400000).toISOString() })
const isOwn = (ip: string) => !!names.value[ip]?.own
const list = computed(() => rows.value.filter(v => (!fBranch.value || v.branch === fBranch.value) && (!fVer.value || v.ver === fVer.value) && (showBots.value || !v.bot) && (!hideOwn.value || !isOwn(v.ip))
  && (fPeriod.value === 'all' || (fPeriod.value === 'today' ? huDay(v.t) === since.value : v.t >= since.value))))
const versions = computed(() => [...new Set(rows.value.map(v => v.ver).filter(Boolean))])
const human = computed(() => rows.value.filter(v => !v.bot))
const stats = (b: 'main' | 'teszt') => { const l = human.value.filter(v => v.branch === b); return { n: l.length, ips: new Set(l.map(v => v.ip)).size, last: l[0]?.t || '' } }
/** „Az új kiadást a main ágon látta-e már valaki a saját IP-címeitől eltérő címről?” */
const release = computed(() => {
  const main = human.value.filter(v => v.branch === 'main')
  const ver = main.map(v => v.ver).filter(Boolean).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0] || 'v' + APP_VERSION.replace(/\.0$/, '')
  const others = main.filter(v => v.ver === ver && !isOwn(v.ip))
  return { ver, ips: new Set(others.map(v => v.ip)).size, first: others[others.length - 1]?.t || '', last: others[0]?.t || '' }
})
async function setName(ip: string, name: string, own: boolean) {
  try { const r = await fetch('/api/latogatas/nev', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ip, name, own }) }); const j = await r.json(); if (j.names) names.value = j.names; ui.toast('Mentve') } catch { ui.toast('Nem sikerült menteni') }
}
async function clearLog() {
  if (!(await ui.confirm('Biztosan törlöd a <b>teljes látogatás-naplót</b> (mindkét ág)? Ez nem vonható vissza.', 'Napló törlése', true))) return
  try { await fetch('/api/latogatas', { method: 'DELETE' }); ui.toast('A napló törölve'); await load() } catch { ui.toast('A törlés nem sikerült') }
}
function exportCsv() {
  const head = 'időpont;ág;IP-cím;név;verzió;commit;ország;város;böngésző / eszköz;új vagy ismétlődő;robot / előnézet'
  const body = list.value.map(v => [fmt(v.t), v.branch, v.ip, names.value[v.ip]?.name || '', v.ver, v.commit, v.country || '', v.city || '', v.ua, repeat.value.get(v) ? 'ismétlődő' : 'új', v.bot ? 'igen' : ''].map(x => `"${String(x).replace(/"/g, '""')}"`).join(';'))
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + [head, ...body].join('\n')], { type: 'text/csv' })); a.download = 'molio-latogatasok.csv'; a.click()
}
const edit = reactive<Record<string, string>>({})
</script>

<template>
  <div>
    <div class="pagehead"><NuxtLink to="/beallitasok" class="btn">‹ Beállítások</NuxtLink><h1>Látogatások</h1><span class="badge b-yellow">csak a teszt ágon</span><div class="spacer" />
      <button class="btn sm" :disabled="state === 'loading'" @click="load">Frissítés</button><button class="btn sm" @click="exportCsv">Export (CSV)</button><button class="btn sm danger" @click="clearLog">Napló törlése</button></div>
    <div class="hint small">A main (molio…) és a teszt (teszt-molio…) oldal megtekintései: a program betöltődésekor, látogatásonként egyszer (30 perc inaktivitás után új látogatás). A bejegyzések 90 napig maradnak meg. A napló a KV ingyenes írás-keretének kímélése miatt napi {{ cap }} bejegyzésig ír ágonként; a robotok és a link-előnézetek nem írnak. Páciens- vagy alkalmazásadat nem kerül a naplóba.</div>
    <div v-if="state === 'err'" class="err">A látogatás-napló nem érhető el (a teszt Workeren a MOLIO_LOG kötés hiányozhat – hibanapló B-013).</div>
    <div v-if="full.length" class="warn small">A napi felső határ elérve: {{ full.join(', ') }} – ezeken a napokon a további látogatások nem kerültek a naplóba.</div>
    <div class="kpis">
      <div v-for="b in (['main', 'teszt'] as const)" :key="b" class="kpi"><div class="kv-v" :style="b === 'main' ? 'color:var(--green)' : 'color:var(--orange)'">{{ stats(b).n }}</div><div class="kv-l">{{ b }}: látogatás · {{ stats(b).ips }} egyedi IP<br>utolsó: {{ stats(b).last ? fmt(stats(b).last) : '–' }}</div></div>
    </div>
    <div class="card" data-test="kiadas-latta">
      <b>Az új kiadást ({{ release.ver }}) a main ágon látta-e már valaki a saját IP-címeitől eltérő címről?</b>
      <div style="margin-top:4px">{{ release.ips ? `Igen – ${release.ips} más IP-cím nyitotta meg; első: ${fmt(release.first)}, utolsó: ${fmt(release.last)}.` : 'Még nem (a „saját” jelölésű címeken kívül senki).' }}</div>
    </div>
    <div class="row" style="margin:8px 0">
      <select v-model="fBranch" class="inp auto"><option value="">mindkét ág</option><option value="main">main</option><option value="teszt">teszt</option></select>
      <select v-model="fPeriod" class="inp auto"><option value="today">ma</option><option value="7">7 nap</option><option value="30">30 nap</option><option value="all">minden</option></select>
      <select v-model="fVer" class="inp auto"><option value="">minden verzió</option><option v-for="v in versions" :key="v" :value="v">{{ v }}</option></select>
      <label class="switch" :class="{ on: hideOwn }" @click.prevent="hideOwn = !hideOwn"><i />„saját” címek elrejtése</label>
      <label class="switch" :class="{ on: showBots }" @click.prevent="showBots = !showBots"><i />robot / előnézet is</label>
      <span class="small muted">{{ list.length }} sor</span>
    </div>
    <div class="card flush scroll-x">
      <table class="t ss">
        <thead><tr><th>Időpont</th><th>Ág</th><th>IP-cím</th><th>Verzió</th><th class="hide-m">Hely</th><th class="hide-m">Böngésző / eszköz</th><th>Új?</th></tr></thead>
        <tbody>
          <tr v-for="(v, i) in list" :key="i">
            <td class="nowrap small">{{ fmt(v.t) }}</td>
            <td><span class="badge" :class="v.branch === 'main' ? 'b-green' : 'b-yellow'">{{ v.branch }}</span><span v-if="v.bot" class="badge b-gray">robot / előnézet</span></td>
            <td class="small"><code>{{ v.ip || "–" }}</code> <b v-if="names[v.ip]?.name">{{ names[v.ip]!.name }}</b><div class="row" style="gap:4px;margin-top:2px"><input v-model="edit[v.ip]" class="inp" style="width:130px;padding:2px 6px" :placeholder="names[v.ip]?.name || 'név…'" @change="setName(v.ip, edit[v.ip] || '', isOwn(v.ip))"><label class="small"><input type="checkbox" :checked="isOwn(v.ip)" @change="setName(v.ip, edit[v.ip] || names[v.ip]?.name || '', ($event.target as HTMLInputElement).checked)"> saját</label></div></td>
            <td class="small nowrap">{{ v.ver }}<span v-if="v.commit" class="muted"> · {{ v.commit }}</span></td>
            <td class="small hide-m">{{ [v.city, v.country].filter(Boolean).join(', ') || '–' }}</td>
            <td class="small hide-m">{{ v.ua }}</td>
            <td class="small">{{ repeat.get(v) ? 'ismétlődő' : 'új' }}</td>
          </tr>
          <tr v-if="!list.length"><td colspan="7" class="muted">{{ state === 'loading' ? 'Betöltés…' : 'Nincs látogatás a szűrés szerint.' }}</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
