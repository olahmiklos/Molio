<script setup lang="ts">
// Beállítások → Diktálás (spec v2.3, 7., 8., 14., 17. pont; v2.4 1., 4., 6., 12., 15., 19. pont).
// Main ág: csak az AI-értelmezés kapcsolója (alapból bekapcsolva), az „Így diktálj” súgó, a „Diktálás betanítása” indítása, a tanult javítások és a Rövidítéseim.
// A felismerés rögzített beállítással fut (felismerő, zajszűrés, szakszó-szöveg, beszédészlelés, küszöbök) – ezek csak kiadással változnak.
// Teszt ág: a próbabeállítások is állíthatók (a Diktálás-laborban kimérve), és a központilag gyűjtött javítások exportálhatók.
import { useDataStore } from '~/stores/data'
import { useDictStore } from '~/stores/dict'
import { useVoiceStore } from '~/stores/voice'
import { useUiStore } from '~/stores/ui'
import { DEV_TOOLS } from '~/utils/meta'
import { PROMPT_STYLES } from '~/utils/dict/prompt'
import { isBroken, type Macro } from '~/utils/dict/macro'
import { fmtDT } from '~/utils/dates'
import MacroModal from '~/components/modals/MacroModal.vue'
const dict = useDictStore(), voice = useVoiceStore(), ui = useUiStore(), data = useDataStore()
onMounted(() => { dict.init(); void voice.probe() })
const p = computed(() => dict.s.prefs)
const status = computed(() => voice.whisperOk ? 'elérhető' : 'jelenleg nem elérhető (a böngésző felismerője a tartalék)')
const rules = computed(() => dict.s.personal.slice().reverse())
const SRC: Record<string, string> = { kezi: 'kézi', betanitas: 'betanítás', tanult: 'ismétlődésből', javitas: 'javításból', kozponti: 'központi (más eszközről)' }
const ctx = computed(() => ({ types: data.db.types, items: data.db.items }))
const lineTxt = (m: Macro) => m.lines.map(l => (l.kind === 'type' ? data.db.types.find(t => t.id === l.id)?.name : `${data.db.items.find(i => i.id === l.id)?.name} ×${l.qty || 1}`) || l.id).join(' · ')
async function delMacro(m: Macro) { if (await ui.confirm(`Törlöd a(z) <b>${m.name}</b> rövidítést?`, 'Törlés', true)) { dict.s.macros = dict.s.macros.filter(x => x.id !== m.id); ui.toast('Rövidítés törölve') } }
async function delRule(id: string) { if (await ui.confirm('Törlöd ezt a tanult javítást?', 'Törlés', true)) dict.removePersonal(id) }
async function exportLearned() {
  const central = await dict.pullLearn(true)
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), local: { rules: dict.s.personal, macros: dict.s.macros }, central: central?.raw || null }, null, 1)], { type: 'application/json' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'molio-tanult-javitasok.json'; a.click()
}
</script>

<template>
  <div>
    <div class="card">
      <h2>Diktálás</h2>
      <div class="row" style="gap:10px 20px;margin:4px 0 10px;flex-wrap:wrap">
        <label class="switch" :class="{ on: p.ai && !dict.aiInfo.exhausted, off: dict.aiInfo.exhausted }" data-test="ai-beallitas" @click.prevent="!dict.aiInfo.exhausted && (p.ai = !p.ai)"><i />AI-értelmezés</label>
        <span class="small muted">Az AI segít a mondatok értelmezésében; kikapcsolva is működik a diktálás. {{ dict.aiInfo.exhausted ? 'Most ki van kapcsolva – a mai keret elfogyott.' : '' }}</span>
      </div>
      <template v-if="DEV_TOOLS">
        <div class="hint small">Teszt ág: a próbabeállítások itt és a Diktálás-laborban állíthatók. A main ágon a fogorvos semmit nem állít: ott a rögzített beállítás fut (felismerő: Whisper, zajszűrés be, szakszó-szöveg: rövid mondatos, átalakítás: új, beszédészlelés be, küszöb: közepes).</div>
        <div class="field"><label class="f">Hangfelismerő</label>
          <select v-model="p.recognizer" class="inp" style="max-width:100%" data-test="felismero"><option value="whisper">Pontos felismerés (Whisper, szerver)</option><option value="browser">Alap felismerés (böngésző)</option></select>
          <div class="small muted" style="margin-top:4px">A pontos felismerő állapota: <b>{{ status }}</b>. Napi keret, időtúllépés (15 mp) és kéréskorlát (60 kérés/óra eszközönként) mellett működik.</div></div>
        <div class="row" style="gap:10px 20px;margin:10px 0;flex-wrap:wrap">
          <label class="switch" :class="{ on: p.livePreview }" @click.prevent="p.livePreview = !p.livePreview"><i />Élő előnézet beszéd közben</label>
          <label class="switch" :class="{ on: p.noise }" @click.prevent="p.noise = !p.noise"><i />Zajszűrés</label>
          <label class="switch" :class="{ on: p.vad }" @click.prevent="p.vad = !p.vad"><i />Beszédészlelés (vad_filter)</label>
        </div>
        <div class="grid3">
          <div class="field"><label class="f">Szakszó-szöveg</label><select v-model="p.promptStyle" class="inp"><option v-for="(l, k) in PROMPT_STYLES" :key="k" :value="k">{{ l }}</option></select></div>
          <div class="field"><label class="f">Átalakítás 16 kHz-re</label><select v-model="p.resample" class="inp"><option value="uj">új (szűrt)</option><option value="regi">régi (lineáris, v2.3)</option></select></div>
          <div class="field"><label class="f">Hasonlósági egyeztetés érzékenysége</label><select v-model="p.threshold" class="inp"><option value="strict">szigorú</option><option value="medium">közepes (ajánlott)</option><option value="loose">engedékeny</option></select></div>
        </div>
        <div v-if="dict.s.aiStats.runs" class="small"><b>AI hozzáadott értéke:</b> {{ dict.s.aiStats.runs }} diktálás, {{ dict.s.aiStats.diffs }} eltérés; az AI-nak {{ dict.s.aiStats.aiRight }}×, a szabálynak {{ dict.s.aiStats.ruleRight }}× volt igaza.</div>
      </template>
      <div class="hint" data-test="demo-felirat">Demó v2.4 – bemutató verzió: a diktálás pontos felismerése a Cloudflare Workers AI Whisper-modelljével működik (a böngésző felismerője a háttérben fut, és ha a Whisper nem ad használható szöveget, magától erre vált); az AI-értelmezés itt és a diktálás ablakban kapcsolható. API-kulcsot nem kell megadni. A hangfelvétel nem tárolódik.</div>
    </div>

    <div class="card" data-test="roviditeseim">
      <div class="row" style="margin-bottom:8px"><h2 style="margin:0">Rövidítéseim</h2><div class="spacer" /><button class="btn sm pri" @click="ui.open(MacroModal, {})">+ Új rövidítés</button></div>
      <p class="small muted" style="margin-top:0">Egy szóval előhívott tételcsoport: a nevét kimondva a diktálásban („szokásos kontroll a 36-osra, plusz két tampon, de polírozás nélkül”) a tételek normál sorként jelennek meg. A rövidítés személyes; a központi mentés ágak szerint történik, eszközcserénél nem vész el.</p>
      <div v-if="dict.s.macros.length" class="scroll-x"><table class="t ss"><thead><tr><th>Név</th><th>Elhangzó alakok</th><th>Tételek</th><th>Használat</th><th /></tr></thead>
        <tbody><tr v-for="m in dict.s.macros" :key="m.id" :style="m.active ? '' : 'opacity:.55'">
          <td><b>{{ m.name }}</b><span v-if="isBroken(m, ctx)" class="badge b-red" style="margin-left:4px" title="a rövidítés egyik tétele már nem létezik">hibás</span></td>
          <td class="small">{{ m.aliases.join(', ') || '–' }}</td>
          <td class="small">{{ lineTxt(m) }}</td>
          <td class="small nowrap">{{ m.uses }}×<div v-if="m.lastUsed" class="muted">{{ fmtDT(new Date(m.lastUsed)) }}</div></td>
          <td class="nowrap"><label class="switch" :class="{ on: m.active }" @click.prevent="m.active = !m.active"><i /></label> <button class="btn sm" @click="ui.open(MacroModal, { id: m.id })">Szerkesztés</button> <button class="btn sm danger" @click="delMacro(m)">×</button></td>
        </tr></tbody></table></div>
      <p v-else class="muted small">Még nincs rövidítés. A diktálás eredményéből a „Mentés rövidítésként” gombbal, vagy itt kézzel készíthető; ha egy kombinációt 30 napon belül háromszor mentesz, a program felajánlja.</p>
    </div>

    <div class="card" data-test="tanult-javitasok">
      <div class="row" style="margin-bottom:8px"><h2 style="margin:0">Tanult javítások</h2><div class="spacer" /><button v-if="DEV_TOOLS" class="btn sm" @click="exportLearned">Export (JSON)</button></div>
      <p class="small muted" style="margin-top:0">A javítás maga a jóváhagyás: ha egyszer kijavítasz egy félreértett szót („Nem ezt mondtam”, vagy a ⚠ sor választása), a program a következő diktálástól magától javítja. A kiejtési javítás csak rád vonatkozik, a szakmai a rendelő minden felhasználójára. A main ágon tanultak a teszt ágon is érvényesek, fordítva nem.</p>
      <div v-if="rules.length" class="scroll-x"><table class="t ss"><thead><tr><th>Hallott</th><th>Helyes</th><th class="hide-m">Kinek</th><th class="hide-m">Forrás</th><th>Lefutott</th><th /></tr></thead>
        <tbody><tr v-for="r in rules" :key="r.id" :style="r.active ? '' : 'opacity:.55'">
          <td>„{{ r.from }}”</td><td><b>„{{ r.to }}”</b><span v-if="r.cat" class="small muted"> · {{ r.cat }}</span></td>
          <td class="small hide-m">{{ r.scope === 'rendelo' ? 'a rendelőnek' : 'személyes' }}</td>
          <td class="small hide-m">{{ SRC[r.source] || r.source }}<span v-if="r.branch" class="muted"> · {{ r.branch }}</span></td>
          <td class="small">{{ r.uses || 0 }}×</td>
          <td class="nowrap"><label class="switch" :class="{ on: r.active }" @click.prevent="r.active = !r.active"><i /></label> <button class="btn sm danger" @click="delRule(r.id)">×</button></td>
        </tr></tbody></table></div>
      <p v-else class="muted small">Még nincs tanult javítás.</p>
    </div>

    <div class="card">
      <h2>Így diktálj</h2>
      <ul class="small" style="line-height:1.8;margin:0 0 0 18px">
        <li>A <b>fogszámot előre</b> mondd, fogonként rövid mondatban: „Fog harminchat, extrakció. Fog huszonöt, MO kompozit tömés.”</li>
        <li>A <b>mennyiséget</b> az anyagnév mellé mondd: „Polírpaszta öt darab.”</li>
        <li>Tizedesnél mondd, hogy <b>„egész”</b>: „három egész hat ml öblítő oldat” (3,6 ml).</li>
        <li>Egyszerre legfeljebb 30 másodpercet rögzít a demó; hosszabb diktáláshoz nyomd meg újra a gombot.</li>
        <li>A gyakran diktált csoportra készíts <b>rövidítést</b>, és mondd a nevét: „szokásos kontroll”.</li>
        <li>Zajos környezetben: csiptetős vagy fejmikrofon, közel a szádhoz. A „Diktálás betanítása” megmutatja, mennyire jó az eszközöd.</li>
      </ul>
      <div style="margin-top:10px"><NuxtLink class="btn sm" to="/beallitasok?tab=train">Diktálás betanítása</NuxtLink></div>
    </div>
  </div>
</template>
