<script setup lang="ts">
// Beállítások → Diktálás (spec v2.3, 7., 8., 14., 17. pont): felismerő-választó és állapotjelzés, élő előnézet, zajszűrés, hasonlósági küszöb, AI-értelmezés, „Így diktálj” súgó
import { useDictStore } from '~/stores/dict'
import { useVoiceStore } from '~/stores/voice'
const dict = useDictStore(), voice = useVoiceStore()
onMounted(() => { dict.init(); void voice.probe() })
const p = computed(() => dict.s.prefs)
const status = computed(() => voice.whisperOk ? 'elérhető' : 'jelenleg nem elérhető (a böngésző felismerője a tartalék)')
</script>

<template>
  <div>
    <div class="card">
      <h2>Diktálás</h2>
      <div class="field"><label class="f">Hangfelismerő</label>
        <select v-model="p.recognizer" class="inp" style="max-width:100%" data-test="felismero"><option value="whisper">Pontos felismerés (Whisper, szerver)</option><option value="browser">Alap felismerés (böngésző)</option></select>
        <div class="small muted" style="margin-top:4px">A pontos felismerő állapota: <b>{{ status }}</b>. Napi keret, időtúllépés (15 mp) és kéréskorlát (60 kérés/óra eszközönként) mellett működik; ha nem érhető el, a program automatikusan az alap felismerőre vált.</div></div>
      <div class="row" style="gap:10px 20px;margin:10px 0;flex-wrap:wrap">
        <label class="switch" :class="{ on: p.livePreview }" @click.prevent="p.livePreview = !p.livePreview"><i />Élő előnézet beszéd közben</label>
        <label class="switch" :class="{ on: p.noise }" @click.prevent="p.noise = !p.noise"><i />Zajszűrés (mélyzaj-szűrő, hangerő-kiegyenlítés)</label>
        <label class="switch" :class="{ on: p.ai }" @click.prevent="p.ai = !p.ai"><i />AI-értelmezés (kísérleti)</label>
      </div>
      <div class="field"><label class="f">Hasonlósági egyeztetés érzékenysége</label>
        <select v-model="p.threshold" class="inp" style="max-width:100%"><option value="strict">szigorú (kevesebb ⚠, több kihagyott egyezés)</option><option value="medium">közepes (ajánlott)</option><option value="loose">engedékeny (több ⚠ javaslat)</option></select></div>
      <div class="hint">Az AI-értelmezés a demóban kapcsolóval kapcsolható (Cloudflare Workers AI, kulcs nélkül, napi kerettel); a végleges változatban mindig fut a szabályalapú ellenőrzés mellett. A hangfelvétel nem tárolódik.</div>
      <div v-if="dict.s.aiStats.runs" class="small"><b>AI hozzáadott értéke:</b> {{ dict.s.aiStats.runs }} diktálás, {{ dict.s.aiStats.diffs }} eltérés; az AI-nak {{ dict.s.aiStats.aiRight }}×, a szabálynak {{ dict.s.aiStats.ruleRight }}× volt igaza.</div>
    </div>
    <div class="card">
      <h2>Így diktálj</h2>
      <ul class="small" style="line-height:1.8;margin:0 0 0 18px">
        <li>A <b>fogszámot előre</b> mondd, fogonként rövid mondatban: „Fog harminchat, extrakció. Fog huszonöt, MO kompozit tömés.”</li>
        <li>A <b>mennyiséget</b> az anyagnév mellé mondd: „Polírpaszta öt darab.”</li>
        <li>Tizedesnél mondd, hogy <b>„egész”</b>: „három egész hat ml öblítő oldat” (3,6 ml).</li>
        <li>Egyszerre legfeljebb 30 másodpercet rögzít a demó; hosszabb diktáláshoz nyomd meg újra a gombot.</li>
        <li>A kétértelmű kifejezéseknél („három hatos injekció”) a program rákérdez – a választásod megjegyzi.</li>
        <li>Zajos környezetben: csiptetős vagy fejmikrofon, közel a szádhoz. A „Diktálás betanítása” megmutatja, mennyire jó az eszközöd.</li>
      </ul>
      <div style="margin-top:10px"><NuxtLink class="btn sm" to="/beallitasok?tab=train">Diktálás betanítása</NuxtLink></div>
    </div>
  </div>
</template>
