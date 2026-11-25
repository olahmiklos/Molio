<script setup lang="ts">
// Diktálás-labor (spec v2.4 12. pont D–E, 17. pont 3.): CSAK a teszt / fejlesztői buildben létezik (a main buildből a kód kimarad).
// – próbaszöveg: a betanítás szakaszai, saját beírt szöveg, vagy szabad diktálás próbaszöveg nélkül;
// – felolvasás után egymás mellett: a felolvasandó szöveg, a Whisper és a böngésző szövege, a szavas eltérések kiemelve, pontosság felismerőnként (számmal);
// – kapcsolható próbabeállítások: szakszó-szöveg (rövid mondatos / vesszős lista / nincs), beszédészlelés, zajszűrés, átalakítás (régi / új), felismerő;
// – újrafuttatás ugyanazzal a felvétellel más beállítással; hangerő- és minőségjelzés; visszahallgatás és WAV-letöltés (Fejlesztői részletek);
// – próbanapló a KV-ben (hang nélkül, 90 napig), összesítő beállítás-kombinációnként, export (CSV / JSON);
// – a bizonytalan szavak mérése: találati arány, lefedettség, a jelölt szavak aránya (a ⚠-vé emelés kérdése a mérés utánra halasztva).
import { useDictStore } from '~/stores/dict'
import { useTreatmentStore } from '~/stores/treatment'
import { useUiStore } from '~/stores/ui'
import { useVoiceStore, type DictOpts, type DictResult, type DictDiag } from '~/stores/voice'
import { TRAIN_SECTIONS } from '~/utils/dict/train'
import { PROMPT_STYLES, type PromptStyle } from '~/utils/dict/prompt'
import { canonTokens, uncertainWords, uncertaintyStats, whisperVerdict, wordAccuracy, wordDiff } from '~/utils/dict/quality'
import { correctionPairs } from '~/utils/dict/learn'
import { shortUA } from '~/utils/visit'
import { buildInfo } from '~/utils/meta'
import { scrub } from '~/stores/dict'
import DevDiag from './DevDiag.vue'

const dict = useDictStore(), voice = useVoiceStore(), tx = useTreatmentStore(), ui = useUiStore()
onMounted(() => dict.init())
onBeforeUnmount(() => { if (voice.recording) voice.stop() })
const mode = ref<'sec' | 'own' | 'free'>('sec')
const secId = ref(TRAIN_SECTIONS[0]!.id)
const own = ref('')
const refText = computed(() => (mode.value === 'sec' ? TRAIN_SECTIONS.find(s => s.id === secId.value)!.text : mode.value === 'own' ? own.value : ''))
const o = reactive<DictOpts>({ noise: dict.s.prefs.noise, resample: 'uj', promptStyle: 'mondat', vad: true, recognizer: 'whisper' })
const cur = ref('')

interface Trial { id: string; at: string; ref: string; opts: DictOpts; text: string; whisper: string; browser: string; used: string; fallback: boolean; reason: string; accW: number | null; accB: number | null; accUsed: number | null; garbage: boolean; level: string; speech: number; peak: number; seconds: number; unc: string[]; uncStats: ReturnType<typeof uncertaintyStats> | null; rerun: boolean; segments: boolean }
const trials = ref<Trial[]>([])
const last = computed(() => trials.value[0] || null)

function toTrial(r: DictResult, d: DictDiag | null, rerun: boolean): Trial {
  const ref0 = refText.value.trim()
  const w = r.whisper ?? (r.recognizer === 'whisper' ? r.text : '')
  const b = r.browserFinal || r.live || ''
  const acc = (h: string) => (ref0 && h.trim() ? Math.round(wordAccuracy(ref0, h).ratio * 100) : null)
  const unc = uncertainWords(w, b)
  return { id: Math.random().toString(36).slice(2, 9), at: new Date().toISOString(), ref: ref0, opts: { ...(d?.opts || o) }, text: r.text, whisper: w, browser: b, used: r.recognizer, fallback: r.fallback, reason: d?.fallbackReason || '', accW: acc(w), accB: acc(b), accUsed: acc(r.text),
    garbage: !!w && !whisperVerdict(w, b, r.seconds).usable, level: d?.audio?.level || 'ok', speech: d?.audio?.speechRatio ?? 0, peak: d?.audio?.peak ?? 0, seconds: r.seconds, unc, uncStats: ref0 && w ? uncertaintyStats(ref0, w, unc) : null, rerun, segments: !!d?.worker?.segments }
}
async function record() {
  if (voice.recording) { voice.stop(); return }
  if (voice.processing) return
  cur.value = ''
  await voice.start({ get: () => cur.value, set: v => { cur.value = v } }, { prompt: (st?: PromptStyle) => tx.promptText(st), opts: { ...o }, onDone: r => { const t = toTrial(r, voice.diag, false); trials.value.unshift(t); void saveTrial(t) } })
}
async function rerun() {
  const res = await voice.rerun({ ...o }, (st?: PromptStyle) => tx.promptText(st))
  if (!res) { ui.toast('Előbb készíts felvételt'); return }
  const t = toTrial(res.res, res.diag, true); trials.value.unshift(t); void saveTrial(t)
}
const quality = (t: Trial) => (t.level === 'none' || t.peak < 0.01 ? 'nincs hang' : t.level === 'quiet' ? 'halk' : t.level === 'loud' || t.peak > 0.98 ? 'túlvezérelt' : 'megfelelő')
const pctTxt = (x: number | null) => (x === null ? '–' : x + '%')
const optTxt = (x: DictOpts) => `${x.recognizer} · ${PROMPT_STYLES[x.promptStyle]} · vad ${x.vad ? 'be' : 'ki'} · zajszűrés ${x.noise ? 'be' : 'ki'} · átalakítás ${x.resample}`

/* ---------- próbanapló (KV, csak teszt) ---------- */
const central = ref<(Trial & { key?: string })[]>([])
const loading = ref(false)
async function saveTrial(t: Trial) {
  try {
    await fetch('/api/diktalas/proba', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...t, ref: scrub(t.ref), text: scrub(t.text), whisper: scrub(t.whisper), browser: scrub(t.browser), device: shortUA(navigator.userAgent), branch: buildInfo().branch, commit: buildInfo().short }) })
  } catch { /* a próbanapló hibája nem zavarja a labort */ }
}
async function load() {
  loading.value = true
  try { const r = await fetch('/api/diktalas/proba'); const j = await r.json() as { trials?: Trial[] }; central.value = (j.trials || []).filter(x => x && x.opts) } catch { ui.toast('A próbanapló nem érhető el (KV-kötés a teszt ágon?)') } finally { loading.value = false }
}
const all = computed(() => (central.value.length ? central.value : trials.value))
const summary = computed(() => {
  const g = new Map<string, Trial[]>()
  all.value.forEach(t => { const k = optTxt(t.opts); g.set(k, [...(g.get(k) || []), t]) })
  const avg = (l: (number | null)[]) => { const v = l.filter((x): x is number => x !== null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null }
  return [...g.entries()].map(([k, l]) => ({ k, n: l.length, w: avg(l.map(t => t.accW)), b: avg(l.map(t => t.accB)), garbage: Math.round(l.filter(t => t.garbage).length / l.length * 100), fb: l.filter(t => t.fallback).length,
    unc: (() => { const s = l.map(t => t.uncStats).filter((x): x is NonNullable<typeof x> => !!x); const p = s.map(x => x.precision).filter((x): x is number => x !== null), c = s.map(x => x.coverage).filter((x): x is number => x !== null); return { p: p.length ? Math.round(p.reduce((a, b) => a + b, 0) / p.length * 100) : null, c: c.length ? Math.round(c.reduce((a, b) => a + b, 0) / c.length * 100) : null, share: s.length ? Math.round(s.reduce((a, x) => a + x.share, 0) / s.length * 100) : null } })() })).sort((a, b) => (b.w ?? -1) - (a.w ?? -1))
})
const topWrong = computed(() => {
  const m = new Map<string, number>()
  all.value.forEach(t => { if (!t.ref) return; wordDiff(t.ref, t.whisper).filter(d => !d.ok).forEach(d => m.set(d.word, (m.get(d.word) || 0) + 1)) })
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)
})
function exportData(kind: 'csv' | 'json') {
  const rows = all.value
  const body = kind === 'json' ? JSON.stringify(rows, null, 1) : ['idő;beállítás;felolvasandó;whisper;böngésző;használt;whisper %;böngésző %;értelmetlen;tartalék;ok;hangerő;beszéd-arány'].concat(rows.map(t => [t.at, optTxt(t.opts), t.ref, t.whisper, t.browser, t.used, t.accW ?? '', t.accB ?? '', t.garbage ? 'igen' : 'nem', t.fallback ? 'igen' : 'nem', t.reason, t.level, Math.round(t.speech * 100)].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'))).join('\n')
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([kind === 'csv' ? '﻿' + body : body], { type: kind === 'csv' ? 'text/csv' : 'application/json' })); a.download = `molio-proba-naplo.${kind}`; a.click()
}
/* a labor javaslatai a betanítás mintájára jóváhagyhatók (nem lesznek automatikusan tanult szabályok) */
const props2 = computed(() => (last.value?.ref && last.value.whisper ? correctionPairs(last.value.whisper, last.value.ref).filter(([a, b]) => canonTokens(a).join() !== canonTokens(b).join()) : []))
function approve(a: string, b: string) { dict.addPersonal(a, b, 'betanitas', 'whisper'); ui.toast(`Javítás jóváhagyva: „${a}” → „${b}”`) }
</script>

<template>
  <div>
    <div class="hint"><b>Diktálás-labor (csak a teszt ágon).</b> Próbadiktálás a hibakereséshez: a felvétel a munkamenet alatt visszahallgatható és letölthető, a próba eredménye (szöveg és beállítások, hang nélkül) a próbanaplóba kerül. A labor próbái nem lesznek automatikusan tanult szabályok.</div>
    <div class="card">
      <h2>Próba</h2>
      <div class="row" style="margin-bottom:8px">
        <div class="seg"><button :class="{ on: mode === 'sec' }" @click="mode = 'sec'">Betanító szakasz</button><button :class="{ on: mode === 'own' }" @click="mode = 'own'">Saját szöveg</button><button :class="{ on: mode === 'free' }" @click="mode = 'free'">Szabad diktálás</button></div>
        <select v-if="mode === 'sec'" v-model="secId" class="inp auto"><option v-for="s in TRAIN_SECTIONS" :key="s.id" :value="s.id">{{ s.title }}</option></select>
      </div>
      <textarea v-if="mode === 'own'" v-model="own" class="inp" rows="2" placeholder="A felolvasandó próbaszöveg" />
      <div v-else-if="mode === 'sec'" class="train-text" style="font-size:17px">{{ refText }}</div>
      <div class="grid3" style="margin-top:10px">
        <div class="field"><label class="f">Felismerő</label><select v-model="o.recognizer" class="inp"><option value="whisper">Whisper (szerver)</option><option value="browser">böngésző</option></select></div>
        <div class="field"><label class="f">Szakszó-szöveg</label><select v-model="o.promptStyle" class="inp"><option v-for="(l, k) in PROMPT_STYLES" :key="k" :value="k">{{ l }}</option></select></div>
        <div class="field"><label class="f">Átalakítás</label><select v-model="o.resample" class="inp"><option value="uj">új (szűrt)</option><option value="regi">régi (lineáris)</option></select></div>
      </div>
      <div class="row" style="gap:10px 20px">
        <label class="switch" :class="{ on: o.vad }" @click.prevent="o.vad = !o.vad"><i />Beszédészlelés (vad)</label>
        <label class="switch" :class="{ on: o.noise }" @click.prevent="o.noise = !o.noise"><i />Zajszűrés</label>
        <div class="spacer" />
        <button class="mic" :class="{ rec: voice.recording }" :disabled="voice.processing" data-test="labor-felvetel" @click="record"><AppIcon :name="voice.recording ? 'stop' : 'mic'" :size="16" />{{ voice.recording ? `Leállítás (${voice.remaining} s)` : 'Felolvasás' }}</button>
        <button class="btn" :disabled="voice.processing || voice.recording || !voice.hasRecording()" title="Ugyanaz a felvétel, a fenti beállításokkal (a zajszűrés a mikrofon-beállítást nem változtatja meg, csak az előkészítést)" @click="rerun">Újrafuttatás ugyanazzal a felvétellel</button>
      </div>
      <DictBar />
    </div>

    <div v-if="last" class="card">
      <h2>Eredmény <span class="small muted">{{ optTxt(last.opts) }}{{ last.rerun ? ' · újrafuttatás' : '' }}</span></h2>
      <div class="row small" style="margin-bottom:6px">
        <span class="badge" :class="quality(last) === 'megfelelő' ? 'b-green' : 'b-yellow'">hangerő: {{ quality(last) }}</span>
        <span class="badge b-gray">beszéd-arány: {{ Math.round(last.speech * 100) }}%</span><span class="badge b-gray">csúcs: {{ last.peak.toFixed(2) }}</span><span class="badge b-gray">{{ last.seconds.toFixed(1) }} s</span>
        <span class="badge" :class="last.garbage ? 'b-red' : 'b-green'">{{ last.garbage ? 'Whisper: értelmetlen' : 'Whisper: használható' }}</span>
        <span v-if="last.fallback" class="badge b-yellow">tartalék: {{ last.reason }}</span>
        <span class="badge b-gray">megbízhatósági adat a modelltől: {{ last.segments ? 'van (szakaszonként)' : 'nincs' }}</span>
      </div>
      <div class="lab-grid">
        <div v-if="last.ref"><div class="f">Felolvasandó</div><div>{{ last.ref }}</div></div>
        <div><div class="f">Whisper <b>{{ pctTxt(last.accW) }}</b></div><div><span v-for="(w, i) in wordDiff(last.ref || last.browser, last.whisper)" :key="i" :class="{ 'wdiff-bad': last.ref && !w.ok, 'wdiff-unc': last.unc.includes(w.word) }">{{ w.word }} </span><span v-if="!last.whisper" class="muted">–</span></div></div>
        <div><div class="f">Böngésző <b>{{ pctTxt(last.accB) }}</b></div><div><span v-for="(w, i) in wordDiff(last.ref || last.whisper, last.browser)" :key="i" :class="{ 'wdiff-bad': last.ref && !w.ok }">{{ w.word }} </span><span v-if="!last.browser" class="muted">–</span></div></div>
      </div>
      <div class="small muted" style="margin-top:6px">Piros: eltér a felolvasott szövegtől · sárga, szaggatott: bizonytalan (a két felismerő eltér). <template v-if="last.uncStats">Bizonytalan-jelölés: találati arány {{ last.uncStats.precision === null ? '–' : Math.round(last.uncStats.precision * 100) + '%' }}, lefedettség {{ last.uncStats.coverage === null ? '–' : Math.round(last.uncStats.coverage * 100) + '%' }}, jelölt arány {{ Math.round(last.uncStats.share * 100) }}%.</template></div>
      <template v-if="props2.length">
        <h3>Javaslatok (egyenként jóváhagyhatók)</h3>
        <div v-for="([a, b], i) in props2" :key="i" class="row small" style="padding:3px 0">„{{ a }}” → „<b>{{ b }}</b>” <button class="btn sm" @click="approve(a, b)">Jóváhagyom</button></div>
      </template>
      <DevDiag title="labor" :extra="{ proba: last }" />
    </div>

    <div class="card">
      <div class="row" style="margin-bottom:8px"><h2 style="margin:0">Próbanapló és összesítő</h2><div class="spacer" />
        <button class="btn sm" :disabled="loading" @click="load">{{ loading ? 'Betöltés…' : 'Központi napló betöltése' }}</button>
        <button class="btn sm" @click="exportData('csv')">Export CSV</button><button class="btn sm" @click="exportData('json')">Export JSON</button></div>
      <p class="small muted" style="margin-top:0">{{ central.length ? `${central.length} próba a központi naplóból (90 napig őrizzük)` : `${trials.length} próba ebben a munkamenetben – a központi napló a gombbal tölthető be` }}. A main ágra csak olyan beállítás kerülhet, amely itt és a kiadás előtti tesztfelvételen nem rosszabb az előző változatnál.</p>
      <div class="scroll-x"><table class="t ss"><thead><tr><th>Beállítás</th><th>Próbák</th><th>Whisper</th><th>Böngésző</th><th>Értelmetlen Whisper</th><th>Tartalékra váltás</th><th class="hide-m">Bizonytalan: találat / lefedettség / arány</th></tr></thead>
        <tbody><tr v-for="r in summary" :key="r.k"><td class="small">{{ r.k }}</td><td>{{ r.n }}</td><td><b>{{ pctTxt(r.w) }}</b></td><td>{{ pctTxt(r.b) }}</td><td>{{ r.garbage }}%</td><td>{{ r.fb }}</td><td class="small hide-m">{{ pctTxt(r.unc.p) }} / {{ pctTxt(r.unc.c) }} / {{ pctTxt(r.unc.share) }}</td></tr>
          <tr v-if="!summary.length"><td colspan="7" class="muted">Még nincs próba.</td></tr></tbody></table></div>
      <div v-if="topWrong.length" class="small" style="margin-top:8px"><b>Leggyakrabban rosszul felismert (Whisper):</b> {{ topWrong.map(([w, n]) => `${w} (${n})`).join(', ') }}</div>
    </div>
  </div>
</template>

<style scoped>
.lab-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; line-height: 1.6 }
@media (max-width: 800px) { .lab-grid { grid-template-columns: 1fr } }
</style>
