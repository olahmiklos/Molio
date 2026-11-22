<script setup lang="ts">
// „Nem ezt mondtam” (spec v2.3, 5. pont, 10. alpont): a felismert szöveg előre beírva, csak a rossz szavakat kell javítani; a jelzés a javítási naplóba kerül (csak szöveg, hangfelvétel nincs)
import { useDictStore } from '~/stores/dict'
import { useTreatmentStore } from '~/stores/treatment'
import { useUiStore } from '~/stores/ui'
import { norm } from '~/utils/dates'
const tx = useTreatmentStore()
const dict = useDictStore()
const ui = useUiStore()
const orig = tx.s?.text || ''
const fixed = ref(orig)
const wrong = ref<'' | 'rosszul-hallotta' | 'rosszul-ertelmezte'>('')
const note = ref('')
/** szavankénti cserék a szabályjavaslathoz: ugyanannyi szavas szövegnél a különbözők */
function pairs(a: string, b: string): [string, string][] {
  const A = a.split(/\s+/).filter(Boolean), B = b.split(/\s+/).filter(Boolean)
  if (A.length !== B.length) return []
  const out: [string, string][] = []
  A.forEach((w, i) => { if (norm(w).replace(/[^a-z0-9]/g, '') !== norm(B[i]!).replace(/[^a-z0-9]/g, '')) out.push([w.replace(/[.,;:!?]+$/, ''), B[i]!.replace(/[.,;:!?]+$/, '')]) })
  return out
}
function save() {
  const x = tx.s; if (!x) return
  const textFixed = fixed.value.trim() !== orig.trim()
  const kind = wrong.value === 'rosszul-ertelmezte' ? 'jelzes-ertelmezes' : 'jelzes-szoveg'
  const ps = textFixed ? pairs(orig, fixed.value) : []
  if (ps.length) ps.forEach(([a, b]) => dict.addLog({ source: 'jelzes', kind, pattern: 'txt:' + norm(a), outcome: norm(b), raw: orig, interpreted: tx.pipe.text, final: fixed.value, live: x.dict.live || undefined, recognizer: x.dict.recognizer, wrong: wrong.value || undefined, note: note.value || undefined }))
  else dict.addLog({ source: 'jelzes', kind, raw: orig, interpreted: tx.pipe.text, final: fixed.value, live: x.dict.live || undefined, recognizer: x.dict.recognizer, wrong: wrong.value || undefined, note: note.value || undefined })
  ui.toast('Köszönjük – a jelzést rögzítettük.', textFixed ? { label: 'Feldolgozás újra', fn: () => { tx.setText(fixed.value, 0) } } : undefined)
  ui.close()
}
function reprocess() { tx.setText(fixed.value, 0); save() }
</script>

<template>
  <ModalShell title="Nem ezt mondtam">
    <p class="muted small" style="margin-top:0">A felismert szöveg előre be van írva – csak a rossz szavakat javítsd ki. Hangfelvétel nem kerül mentésre, csak a szöveg.</p>
    <textarea v-model="fixed" class="inp" rows="5" aria-label="Javított szöveg" />
    <div class="row" style="margin-top:10px">
      <button class="chip" :class="{ on: wrong === 'rosszul-hallotta' }" type="button" @click="wrong = wrong === 'rosszul-hallotta' ? '' : 'rosszul-hallotta'"><span v-if="wrong === 'rosszul-hallotta'">✓</span> Rosszul hallotta</button>
      <button class="chip" :class="{ on: wrong === 'rosszul-ertelmezte' }" type="button" @click="wrong = wrong === 'rosszul-ertelmezte' ? '' : 'rosszul-ertelmezte'"><span v-if="wrong === 'rosszul-ertelmezte'">✓</span> Rosszul értelmezte</button>
    </div>
    <div class="small muted" style="margin-top:4px">„Rosszul hallotta”: a szöveg rossz. „Rosszul értelmezte”: a szöveg jó, de rossz a tétel, anyag vagy mennyiség. (Nem kötelező.)</div>
    <input v-model="note" class="inp" style="margin-top:10px" placeholder="Rövid megjegyzés (nem kötelező)">
    <template #foot>
      <button class="btn" @click="ui.close()">Mégse</button><div class="spacer" />
      <button class="btn" @click="save">Mentés</button>
      <button class="btn pri" :disabled="fixed.trim() === orig.trim()" @click="reprocess">Mentés és feldolgozás újra</button>
    </template>
  </ModalShell>
</template>
