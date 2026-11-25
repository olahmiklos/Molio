<script setup lang="ts">
// „Fejlesztői részletek” (spec v2.4 4. és 12. pont D): csak a teszt / fejlesztői buildben létezik (a main buildből a kód kimarad).
// A feldolgozás menete: hang (hossz, hangerő, beszéd-arány, a küldött WAV és a Worker által ellenőrzött fejléc), felismerők (nyers Whisper szöveg,
// a böngésző élő és végső szövege, modell, válaszidő, tartalékra váltás oka, szakszó-szöveg), a feldolgozási lánc lépésenként, értelmezések,
// AI-modell és keret, build és környezet. Másolás gombbal egy szövegként átadható; a legutóbbi felvétel visszahallgatható és WAV-ként letölthető.
import { useVoiceStore } from '~/stores/voice'
import { useDictStore } from '~/stores/dict'
import { useUiStore } from '~/stores/ui'
import { buildInfo, VERSION_LINE } from '~/utils/meta'
import { uncertainWords } from '~/utils/dict/quality'

const props = defineProps<{ extra?: Record<string, unknown>; title?: string; pipe?: { steps: { kind: string; from: string; to: string }[]; text: string; cleaned: string; filteredOut: string[] } | null; interp?: Record<string, unknown> | null }>()
const voice = useVoiceStore(), dict = useDictStore(), ui = useUiStore()
const d = computed(() => voice.diag)
const b = buildInfo()
const pct = (x: number | null | undefined) => (x === null || x === undefined ? '–' : Math.round(x * 100) + '%')
const hasWords = computed(() => ((d.value?.worker?.segments || []) as { words?: unknown[] }[]).some(x => !!x.words))
const unc = computed(() => (d.value ? uncertainWords(d.value.whisper, d.value.browserFinal || d.value.browserLive) : []))
const report = computed(() => {
  const x = d.value
  const L: string[] = [`== Molio – fejlesztői részletek (${props.title || 'diktálás'}) ==`, `${VERSION_LINE} · ${b.env} · ág: ${b.branch || '?'} · commit: ${b.short || '?'}`]
  if (x) {
    L.push(`Időpont: ${x.at}`, `Beállítás: felismerő=${x.opts.recognizer}, zajszűrés=${x.opts.noise ? 'be' : 'ki'}, átalakítás=${x.opts.resample}, szakszó-szöveg=${x.opts.promptStyle}, beszédészlelés (vad)=${x.opts.vad ? 'be' : 'ki'}`)
    if (x.audio) L.push(`Hang: ${x.audio.seconds.toFixed(1)} s, bemenet ${x.audio.inRate} Hz, RMS átlag ${x.audio.avgRms.toFixed(4)}, csúcs ${x.audio.peak.toFixed(3)}, beszéd-arány ${pct(x.audio.speechRatio)}, szintjelzés: ${x.audio.level}`)
    if (x.wav) L.push(`Küldött WAV: ${x.wav.rate} Hz, ${x.wav.channels} csatorna, ${x.wav.bytes} bájt, ${x.wav.seconds.toFixed(2)} s`)
    if (x.worker?.wav) L.push(`A Worker szerint: ${x.worker.wav.rate} Hz, ${x.worker.wav.channels} csatorna, ${x.worker.wav.bits} bit, ${x.worker.wav.seconds.toFixed(2)} s – fejléc = tényleges adat: ${x.worker.wav.headerMatches ? 'igen' : 'NEM'}${x.worker.wav.note ? ' (' + x.worker.wav.note + ')' : ''}`)
    L.push(`Válaszidő: ${x.worker?.ms ?? '–'} ms · próbálkozás: ${x.attempts} · modell: ${x.model || '–'} · használt: ${x.used}`)
    L.push(`Nyers Whisper: ${x.whisper || '–'}`, `Böngésző (élő): ${x.browserLive || '–'}`, `Böngésző (végső): ${x.browserFinal || '–'}`, `Egyezés (Whisper ↔ böngésző): ${pct(x.ratio)} · döntés: ${x.fallbackReason || '–'}`)
    if (unc.value.length) L.push(`Eltérő szavak (bizonytalan, csak mérés): ${unc.value.join(', ')}`)
    L.push(`Szakszó-szöveg (${x.prompt.length} karakter): ${x.prompt || '–'}`)
    if (x.worker?.keys?.length) L.push(`A modell válaszának mezői: ${x.worker.keys.join(', ')}${x.worker.segments ? ' (szakaszonkénti adat érkezett)' : ''}`)
    if (x.error) L.push(`Hiba: ${x.error}`)
  } else L.push('Még nincs felvétel ebben a munkamenetben.')
  if (props.pipe) {
    L.push('-- Feldolgozási lánc --', `Kiszűrve: ${props.pipe.filteredOut.join(' · ') || '–'}`)
    props.pipe.steps.forEach(s => L.push(`  [${s.kind}] ${s.from}${s.to ? ' → ' + s.to : ''}`))
    L.push(`Értelmezett szöveg: ${props.pipe.text}`)
  }
  if (props.interp) L.push('-- Értelmezések --', JSON.stringify(props.interp, null, 1))
  if (props.extra) L.push('-- Egyéb --', JSON.stringify(props.extra, null, 1))
  L.push(`AI: ${dict.s.prefs.ai ? 'be' : 'ki'} · modell: ${dict.aiInfo.model || '–'} · mai keret: ${dict.aiInfo.leftPct === null ? 'nem ismert' : 'kb. ' + dict.aiInfo.leftPct + '%'}`)
  return L.join('\n')
})
async function copy() { try { await navigator.clipboard.writeText(report.value); ui.toast('A diagnosztika a vágólapra másolva') } catch { ui.toast('A másolás nem sikerült – jelöld ki a szöveget kézzel') } }
function download() { if (!voice.lastWavUrl) return; const a = document.createElement('a'); a.href = voice.lastWavUrl; a.download = `molio-felvetel-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.wav`; a.click() }
</script>

<template>
  <details class="dev-panel" open data-test="fejlesztoi-reszletek">
    <summary>Fejlesztői részletek <span class="badge b-yellow">{{ b.env }}</span></summary>
    <div class="row" style="margin:6px 0">
      <button class="btn sm" type="button" @click="copy">Másolás</button>
      <template v-if="voice.lastWavUrl">
        <audio :src="voice.lastWavUrl" controls preload="none" style="height:32px;max-width:100%" />
        <button class="btn sm" type="button" @click="download">WAV letöltése</button>
        <span class="small muted">a felvétel csak a munkamenet alatt, a böngésző memóriájában van – a program nem menti el</span>
      </template>
    </div>
    <div v-if="d?.worker?.segments" class="small"><b>Megbízhatósági adat a modelltől:</b> szakaszonként{{ hasWords ? ' és szavanként' : '' }} érkezett.</div>
    <pre>{{ report }}</pre>
  </details>
</template>
