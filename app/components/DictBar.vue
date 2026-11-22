<script setup lang="ts">
// Diktálás állapotsávja (spec v2.3, 7., 8., 11., 17. pont): felvétel- és hangerőjelző, élő előnézet, „Szöveg felismerése…”, tartalék jelzése, AI-kapcsoló
import { useDictStore } from '~/stores/dict'
import { useVoiceStore } from '~/stores/voice'
const voice = useVoiceStore()
const dict = useDictStore()
onMounted(() => { dict.init(); void voice.probe() })
const mmss = (n: number) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`
const tips: Record<string, string> = { quiet: 'Halk – beszéljen közelebb a mikrofonhoz', loud: 'Túl hangos', none: 'Nem érkezik hang – ellenőrizze a mikrofont' }
const tip = computed(() => tips[voice.lvl] || '')
const bars = 14
const lit = computed(() => Math.round(voice.level * bars))
const aiTitle = computed(() => `AI-értelmezés – modell: ${dict.aiInfo.model || 'Cloudflare Workers AI nyelvi modell'} · Mai keret: ${dict.aiInfo.leftPct === null ? 'nem ismert' : 'kb. ' + dict.aiInfo.leftPct + '% maradt (becslés)'} · A keret 01:00-kor (magyar idő) nullázódik · A keret a hangfelismeréssel (Whisper) közös.`)
const showTip = ref(false)
const aiOn = computed({ get: () => dict.s.prefs.ai && !dict.aiInfo.exhausted, set: v => { dict.s.prefs.ai = v } })
</script>

<template>
  <div class="dictbar">
    <div v-if="voice.recording" class="rec-bar" :class="'lv-' + voice.lvl" role="status" aria-live="polite">
      <span class="recdot" aria-hidden="true" /><b>Felvétel</b><span class="mono">{{ mmss(voice.remaining) }}</span>
      <span class="meter" aria-label="Hangerő"><i v-for="k in bars" :key="k" :class="{ on: k <= lit }" /></span>
      <span v-if="tip" class="lvtip">{{ voice.lvl === 'loud' ? '📢' : voice.lvl === 'none' ? '🚫' : '🔈' }} {{ tip }}</span>
    </div>
    <div v-else-if="voice.processing" class="rec-bar proc"><span class="spin" aria-hidden="true" /><b>Szöveg felismerése…</b></div>
    <div v-if="(voice.recording || voice.processing) && voice.previewOn" class="live"><span class="small muted" style="font-style:normal;font-weight:700">Élő előnézet</span> {{ voice.live || '…' }}</div>
    <div v-if="voice.previewNote && (voice.recording || voice.processing)" class="small muted">{{ voice.previewNote }}</div>
    <div v-if="!voice.recording && !voice.processing && voice.message" class="tx-live">{{ voice.message }}</div>
    <div v-if="voice.fallbackNote" class="warn row" style="margin:6px 0" data-test="tartalek">{{ voice.fallbackNote }}
      <button v-if="voice.canRetry" class="btn sm" :disabled="voice.processing" @click="voice.retry()">Újrapróbálás pontos felismeréssel</button></div>
    <div class="row dict-opts">
      <span class="small muted">Felismerő: <b>{{ dict.s.prefs.recognizer === 'whisper' ? 'Pontos (Whisper – szerver)' : 'Alap (böngésző)' }}</b></span>
      <span class="spacer" />
      <label class="switch" :class="{ on: aiOn, off: dict.aiInfo.exhausted }" :title="aiTitle" data-test="ai-kapcsolo" @mouseenter="showTip = true; void voice.probe()" @mouseleave="showTip = false" @click.prevent="!dict.aiInfo.exhausted && (aiOn = !aiOn)"><i />AI-értelmezés</label>
      <button class="btn sm ghost" type="button" aria-label="AI-értelmezés – tájékoztató" @click="showTip = !showTip">ⓘ</button>
    </div>
    <div v-if="showTip" class="hint small" role="note">{{ dict.aiInfo.exhausted ? 'A mai AI-keret elfogyott – a diktálás AI nélkül működik.' : aiTitle }}</div>
  </div>
</template>

<style scoped>
.dictbar { margin: 8px 0 }
.rec-bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; background: #fff1f3; border: 1.5px solid #f3b3bf; border-radius: 10px; padding: 8px 12px; font-size: 13px }
.rec-bar.lv-quiet, .rec-bar.lv-none { background: #fff8e6; border-color: #f0cf7a }
.rec-bar.lv-loud { background: #fff0e0; border-color: #f0a96a }
.rec-bar.proc { background: #eef6fb; border-color: #b9d9ee }
.recdot { width: 12px; height: 12px; border-radius: 50%; background: #e8344e; animation: pulse 1s infinite }
.lv-quiet .recdot, .lv-none .recdot { background: #d99a00 }
@keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1) } 50% { opacity: .35; transform: scale(.8) } }
.mono { font-variant-numeric: tabular-nums; font-weight: 700 }
.meter { display: inline-flex; gap: 2px; align-items: flex-end; height: 18px }
.meter i { width: 5px; height: 6px; background: #e1e6ea; border-radius: 1px }
.meter i:nth-child(n+4) { height: 9px } .meter i:nth-child(n+7) { height: 12px } .meter i:nth-child(n+10) { height: 15px } .meter i:nth-child(n+13) { height: 18px }
.meter i.on { background: var(--green) } .meter i.on:nth-child(n+12) { background: var(--orange) }
.lvtip { font-weight: 700 }
.spin { width: 14px; height: 14px; border: 2px solid #b9d9ee; border-top-color: var(--blue); border-radius: 50%; animation: sp .8s linear infinite }
@keyframes sp { to { transform: rotate(360deg) } }
.live { margin: 6px 0; padding: 8px 12px; border-left: 3px solid #cfd8df; color: #7b8794; font-style: italic; background: #fafbfc; border-radius: 4px; min-height: 22px }
.dict-opts { margin-top: 6px }
.ghost { background: transparent; border-color: transparent }
.switch.off { opacity: .5; cursor: not-allowed }
</style>
