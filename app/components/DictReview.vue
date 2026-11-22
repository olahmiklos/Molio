<script setup lang="ts">
// A diktálás ellenőrzése: egyetlen ⚠ lista a mentés előtt (spec v2.3, 5., 9., 10., 13., 15., 17. pont). A program soha nem dönt csendben.
import { useTreatmentStore } from '~/stores/treatment'
import { useUiStore } from '~/stores/ui'
import { useVoiceStore } from '~/stores/voice'
import NoSaidModal from '~/components/modals/NoSaidModal.vue'
const tx = useTreatmentStore()
const ui = useUiStore()
const voice = useVoiceStore()
const s = computed(() => tx.s!)
const showRaw = ref(false)
const KIND: Record<string, string> = { similar: 'Szó-egyeztetés', ambig: 'Kétértelmű szó', repeat: 'Ismétlés', dense: 'Sűrű átirat', chart: 'Fogtérkép', prebooked: 'Előjegyzés', qty: 'Mennyiség', ai: 'AI-eltérés', life: 'Életszerűség' }
const STEP: Record<string, string> = { filter: 'kiszűrve', repeat: 'ismétlés', personal: 'személyes javítás', base: 'szótár', similar: 'hasonlóság', pick: 'választás', filler: 'töltelékszó' }
const changes = computed(() => tx.pipe.steps.filter(x => x.kind !== 'filler' || x.from))
const done = (k: string) => s.value.resolved[k]
const ai = computed(() => s.value.ai)
</script>

<template>
  <div>
    <div v-if="s.dict.noSpeech" class="warn">Nem érkezett értelmezhető beszéd – kérjük, ismételje meg.</div>
    <div v-if="s.dict.recognizer !== 'kézi' && s.dict.recognizer !== 'nincs'" class="small muted" style="margin-bottom:6px" data-test="felismero">
      Felismerő: <b>{{ s.dict.recognizer === 'Whisper' ? 'Whisper large-v3-turbo (Cloudflare)' : 'böngésző' }}</b><span v-if="s.dict.fallback"> – alap felismerés (a pontos nem volt elérhető)</span>
      <span v-if="s.dict.differs" class="badge b-yellow swapflash" style="margin-left:6px">a végleges szöveg eltér az élő előnézettől – a végleges szöveget ellenőrizd</span>
    </div>
    <div v-if="ai.state === 'run'" class="hint">AI-értelmezés fut…</div>
    <div v-else-if="ai.state === 'err'" class="hint small">AI-értelmezés: {{ ai.error }} – a szabályalapú eredmény érvényes.</div>
    <div v-else-if="ai.state === 'done'" class="hint small">AI-értelmezés kész ({{ ai.model }}); az eltérések alább ⚠ sorként jelennek meg{{ tx.flags.some(f => f.kind === 'ai') ? '' : ' – nincs eltérés' }}.</div>
    <div v-if="!tx.flags.length" class="muted small">Nincs ellenőrizendő jelzés.</div>
    <div v-for="f in tx.flags" :key="f.key" class="flagrow" :class="{ ok: done(f.key) }" :data-kind="f.kind">
      <div class="fr-h"><span class="badge" :class="done(f.key) ? 'b-green' : 'b-yellow'">{{ done(f.key) ? '✓' : '⚠' }} {{ KIND[f.kind] }}</span><b>{{ f.title }}</b></div>
      <div v-if="f.detail" class="small muted">{{ f.detail }}</div>
      <div class="row" style="margin-top:6px">
        <button v-for="c in f.choices" :key="c.id" class="btn sm" :class="{ pri: done(f.key) === c.id, go: !done(f.key) && f.suggested === c.id }" :title="c.hint" @click="tx.resolveFlag(f, c.id)">{{ c.label }}<span v-if="c.hint" class="small" style="opacity:.7"> · {{ c.hint }}</span></button>
      </div>
    </div>
    <div v-if="changes.length || tx.pipe.filteredOut.length" class="small" style="margin-top:10px;line-height:1.7">
      <details>
        <summary style="cursor:pointer;font-weight:700">Feldolgozás: {{ changes.length }} módosítás a nyers szövegen</summary>
        <div v-for="(c, i) in changes" :key="i"><span class="badge b-gray">{{ STEP[c.kind] }}</span> <span :style="c.kind === 'filter' ? 'text-decoration:line-through' : ''">{{ c.from }}</span><template v-if="c.to"> → <b>{{ c.to }}</b></template></div>
      </details>
    </div>
    <div class="row" style="margin-top:10px">
      <button class="btn sm" @click="showRaw = !showRaw">{{ showRaw ? 'Nyers szöveg elrejtése' : 'Nyers szöveg megtekintése' }}</button>
      <button class="btn sm" data-test="nem-ezt" :disabled="!s.text.trim()" @click="ui.open(NoSaidModal)">Nem ezt mondtam</button>
    </div>
    <div v-if="showRaw" class="small" style="margin-top:8px;line-height:1.6">
      <div><b>Nyers (felismert) szöveg:</b> {{ s.dict.live && s.dict.recognizer === 'Whisper' ? s.text : s.text }}</div>
      <div v-if="s.dict.live"><b>Élő előnézet szövege:</b> {{ s.dict.live }}</div>
      <div v-if="tx.pipe.filteredOut.length"><b>Kiszűrt (nem hangzott el):</b> <s>{{ tx.pipe.filteredOut.join(' ') }}</s></div>
      <div><b>A szabályok által értelmezett szöveg:</b> {{ tx.pipe.text }}</div>
    </div>
  </div>
</template>

<style scoped>
.flagrow { border: 1.5px solid #f0cf7a; background: #fffaf0; border-radius: 10px; padding: 10px 12px; margin: 8px 0 }
.flagrow.ok { border-color: #bfe3cb; background: #f4fbf6 }
.fr-h { display: flex; gap: 8px; align-items: center; flex-wrap: wrap }
.swapflash { animation: flash 1.6s ease 2 }
@keyframes flash { 50% { background: #ffe58a } }
</style>
