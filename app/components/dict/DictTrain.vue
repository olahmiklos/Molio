<script setup lang="ts">
// Diktálás betanítása (spec v2.3, 3. pont): felolvasás szakaszonként, pontosság kategóriánként, rosszul hallott kifejezések,
// mikrofon- és környezetjelzés, személyes javítási szabályok javaslata (egyenként jóváhagyható), előzmények, összehasonlító mód.
import { useDataStore } from '~/stores/data'
import { useDictStore } from '~/stores/dict'
import { useTreatmentStore } from '~/stores/treatment'
import { useUiStore } from '~/stores/ui'
import { useVoiceStore, type DictResult } from '~/stores/voice'
import { buildVocab } from '~/utils/dict/vocab'
import { CATS, TRAIN_SECTIONS, facts, pct, score, wrongTerms, type Wrong } from '~/utils/dict/train'
import { fmtDT } from '~/utils/dates'

const data = useDataStore(), dict = useDictStore(), voice = useVoiceStore(), tx = useTreatmentStore(), ui = useUiStore()
onMounted(() => { dict.init(); void voice.probe() })
const db = computed(() => data.db)
const vocab = computed(() => buildVocab({ items: db.value.items, types: db.value.types, statusDict: db.value.settings.statusDict }))
const ctx = () => ({ items: db.value.items, types: db.value.types, vocab: vocab.value })

interface Part { id: string; text: string; live: string; recognizer: string; seconds: number; hint: string }
const parts = reactive<Record<string, Part>>({})
const cur = ref(''), active = ref('')
const compare = ref(false)
const worst = ref<'ok' | 'quiet' | 'loud' | 'none'>('ok')
const rank = { ok: 0, quiet: 1, loud: 1, none: 2 }
watch(() => voice.lvl, l => { if (voice.recording && rank[l as keyof typeof rank] > rank[worst.value]) worst.value = l as typeof worst.value })

async function rec(id: string) {
  if (voice.recording && active.value === id) { voice.stop(); return }
  if (voice.recording || voice.processing) return
  active.value = id; cur.value = ''; worst.value = 'ok'
  await voice.start({ get: () => cur.value, set: v => { cur.value = v } }, { prompt: () => tx.promptText(), onDone: (r: DictResult) => {
    const hint = r.noSpeech ? 'Nem érkezett beszéd.' : worst.value === 'quiet' ? 'Halk volt a hang' : worst.value === 'loud' ? 'Túl hangos volt a hang' : worst.value === 'none' ? 'Nem érkezett hang' : ''
    parts[id] = { id, text: r.text, live: r.live, recognizer: r.recognizer, seconds: r.seconds, hint }
  } })
}

const ref_ = (id: string) => TRAIN_SECTIONS.find(s => s.id === id)!.text
const personalNow = computed(() => dict.activePersonal)
// a mérés a javítások NÉLKÜL fut (különben a már elfogadott szabályok elfednék a felismerő hibáit)
const evalOf = (id: string, heard: string) => score(facts(ref_(id), ctx()), facts(heard, ctx()))
const catOfWord = (w: string) => { const s = ctx(); return /\d|tiz|husz|harmin|negyven|otven|hatvan|het|nyolc|kilenc|egy|ket|ket|harom|negy|hat|oto?s|ketto/.test(w) ? 'mennyiség / fogszám' : s.items.some(i => i.kw?.some(k => k.replace('*', '') && w.startsWith(k.replace('*', '')))) ? 'anyag' : 'szöveg' }
const done = computed(() => TRAIN_SECTIONS.filter(s => parts[s.id]))
const totals = computed(() => {
  const per = (pick: (p: Part) => string) => {
    const by = Object.fromEntries(CATS.map(c => [c, { total: 0, ok: 0 }])) as Record<string, { total: number; ok: number }>
    let total = 0, ok = 0; const wrong: Wrong[] = []
    for (const s of done.value) { const p = parts[s.id]!; const h = pick(p); const sc = evalOf(s.id, h); total += sc.total; ok += sc.ok; CATS.forEach(c => { by[c]!.total += sc.byCat[c].total; by[c]!.ok += sc.byCat[c].ok }); wrong.push(...wrongTerms(s.text, h, catOfWord)) }
    return { total, ok, by, wrong }
  }
  return { main: per(p => p.text), alt: compare.value ? per(p => p.live) : null }
})
const hints = computed(() => {
  const h = new Set(done.value.map(s => parts[s.id]!.hint).filter(Boolean)); const m: string[] = []
  if ([...h].some(x => /Halk/.test(x))) m.push('Több szakasz halk volt: használj csiptetős vagy fejmikrofont, vagy ülj közelebb a mikrofonhoz.')
  if ([...h].some(x => /hangos/.test(x))) m.push('Túl hangos felvétel: tartsd távolabb a mikrofont.')
  if ([...h].some(x => /Nem érkezett/.test(x))) m.push('Egyes szakaszoknál nem jött hang: ellenőrizd a mikrofon engedélyét és a kiválasztott bemenetet.')
  const miss = totals.value.main.wrong.filter(w => w.heard === '(kimaradt)').length
  if (done.value.length && miss / Math.max(1, totals.value.main.wrong.length) > 0.4) m.push('Sok szó kimaradt: a háttérzaj vagy a mikrofon távolsága okozhatja – zajszűréssel és közelebbi mikrofonnal próbáld újra.')
  return m
})
// javaslatok: rosszul hallott -> felolvasott, egyenként jóváhagyható
const sugg = computed(() => totals.value.main.wrong.filter(w => w.heard !== '(kimaradt)' && !dict.s.personal.some(p => p.from.toLowerCase() === w.heard)))
const edit = reactive<Record<string, string>>({})
const sugKey = (w: Wrong) => w.heard + '→' + w.said
const gone = ref<string[]>([])
const sugShown = computed(() => sugg.value.filter(w => !gone.value.includes(sugKey(w))))
const accept = (w: Wrong) => { dict.addPersonal(w.heard, edit[sugKey(w)] || w.said, 'betanitas', dict.s.prefs.recognizer); gone.value.push(sugKey(w)); ui.toast('Személyes javítás elmentve') }
const reject = (w: Wrong) => { gone.value.push(sugKey(w)) }

function save() {
  const t = totals.value.main
  dict.addTraining({ recognizer: dict.s.prefs.recognizer, noise: dict.s.prefs.noise, total: pct(t.ok, t.total), byCat: Object.fromEntries(CATS.map(c => [c, pct(t.by[c]!.ok, t.by[c]!.total)])), wrong: t.wrong.slice(0, 40).map(w => ({ said: w.said, heard: w.heard, cat: w.cat })) })
  ui.toast('A betanítás eredménye elmentve')
}
async function skip() { dict.s.skipped = true; ui.toast('Kihagyva – a Beállításokból bármikor elindítható') }
const reset = () => { Object.keys(parts).forEach(k => delete parts[k]); gone.value = [] }
const hist = computed(() => dict.s.training.slice().reverse())
</script>

<template>
  <div>
    <div class="hint">
      <b>Ez az eszköz hangjára és mikrofonjára mér.</b> A betanítás nem a hangfelismerőt tanítja: azt méri, milyen hibákat vét a felismerő ezen az eszközön, és ezekből <b>személyes javítási szabályokat</b> javasol – csak az általad jóváhagyottak lépnek életbe.
      A demóban az eredmény eszközönként (ebben a böngészőben) tárolódik; csak szöveg kerül mentésre, hangfelvétel nem, a szöveg nem tartalmaz betegadatot.
      Olvasd fel szakaszonként a szöveget (kb. 2 perc); egy felvétel legfeljebb 30 másodperces.
    </div>
    <div class="card">
      <div class="row" style="margin-bottom:8px"><h2 style="margin:0">Felolvasandó szöveg</h2><div class="spacer" />
        <label class="switch" :class="{ on: compare }" title="A felvételből a Whisper és a böngésző felismerője is kiértékelődik (csak a betanításban)" @click.prevent="compare = !compare"><i />Összehasonlító mód</label>
        <button class="btn sm" @click="reset">Újrakezdés</button></div>
      <p v-if="compare" class="muted small" style="margin-top:0">Összehasonlító mód: a böngésző élő előnézete is kiértékelődik – ehhez az élő előnézetnek be kell lennie kapcsolva (Beállítások → Diktálás).</p>
      <DictBar />
      <div v-for="s in TRAIN_SECTIONS" :key="s.id" class="train-sec" :class="{ done: parts[s.id] }">
        <div class="row"><b>{{ s.title }}</b><div class="spacer" />
          <span v-if="parts[s.id]" class="badge" :class="pct(evalOf(s.id, parts[s.id]!.text).ok, evalOf(s.id, parts[s.id]!.text).total) >= 90 ? 'b-green' : 'b-yellow'">{{ pct(evalOf(s.id, parts[s.id]!.text).ok, evalOf(s.id, parts[s.id]!.text).total) }}%</span>
          <button class="btn sm" :class="{ pri: !(voice.recording && active === s.id) }" :disabled="voice.processing || (voice.recording && active !== s.id)" :data-rec="s.id" @click="rec(s.id)">{{ voice.recording && active === s.id ? 'Leállítás' : parts[s.id] ? 'Újra' : 'Felolvasom' }}</button></div>
        <div class="train-text">{{ s.text }}</div>
        <div v-if="parts[s.id]" class="small" style="margin-top:4px"><span class="muted">Felismert ({{ parts[s.id]!.recognizer === 'whisper' ? 'Whisper' : 'böngésző' }}):</span> {{ parts[s.id]!.text || '–' }}
          <template v-if="compare && parts[s.id]!.live"><br><span class="muted">Böngésző (élő):</span> {{ parts[s.id]!.live }}</template>
          <template v-if="parts[s.id]!.hint"><br><span class="muted">{{ parts[s.id]!.hint }}</span></template></div>
      </div>
    </div>

    <div v-if="done.length" class="card" data-test="eredmeny">
      <h2>Kiértékelés – {{ done.length }}/{{ TRAIN_SECTIONS.length }} szakasz</h2>
      <div class="row" style="margin-bottom:8px"><span class="badge b-blue" style="font-size:15px">Összesen: {{ pct(totals.main.ok, totals.main.total) }}%</span>
        <span v-for="c in CATS" :key="c" class="badge b-gray">{{ c }}: {{ totals.main.by[c]!.total ? pct(totals.main.by[c]!.ok, totals.main.by[c]!.total) + '%' : '–' }}</span></div>
      <div v-if="totals.alt" class="row" style="margin-bottom:8px"><span class="badge b-gray">Böngésző (élő előnézet): {{ pct(totals.alt.ok, totals.alt.total) }}%</span><span class="small muted">a használt felismerő: {{ pct(totals.main.ok, totals.main.total) }}%</span></div>
      <div v-for="m in hints" :key="m" class="warn" style="margin:6px 0">{{ m }}</div>
      <h3 v-if="totals.main.wrong.length">Rosszul felismert kifejezések</h3>
      <div class="scroll-x" v-if="totals.main.wrong.length"><table class="t ss"><thead><tr><th>Mit kellett volna</th><th>Mit hallott a felismerő</th><th>Kategória</th></tr></thead>
        <tbody><tr v-for="(w, i) in totals.main.wrong" :key="i"><td><b>{{ w.said }}</b></td><td>{{ w.heard }}</td><td class="small muted">{{ w.cat }}</td></tr></tbody></table></div>
      <div v-else class="muted">Minden kifejezést helyesen ismert fel.</div>

      <h3 v-if="sugShown.length">Javasolt személyes javítások</h3>
      <div v-for="w in sugShown" :key="sugKey(w)" class="row" style="padding:6px 0;border-bottom:1px solid #eef1f3">
        <span>„<b>{{ w.heard }}</b>” →</span><input v-model="edit[sugKey(w)]" class="inp auto" style="width:170px" :placeholder="w.said">
        <button class="btn sm pri" @click="accept(w)">Jóváhagyom</button><button class="btn sm" @click="reject(w)">Elvetem</button>
      </div>
      <div class="row" style="margin-top:12px"><button class="btn pri" @click="save">Eredmény mentése</button><span class="small muted">zajszűrés: {{ dict.s.prefs.noise ? 'be' : 'ki' }} · felismerő: {{ dict.s.prefs.recognizer === 'whisper' ? 'Whisper' : 'böngésző' }}</span></div>
    </div>

    <div class="card">
      <div class="row" style="margin-bottom:8px"><h2 style="margin:0">Előzmények</h2><div class="spacer" /><button v-if="!dict.trained && !dict.s.skipped" class="btn sm" @click="skip">Kihagyom most</button></div>
      <div v-if="hist.length" class="scroll-x"><table class="t ss"><thead><tr><th>Mikor</th><th>Felismerő</th><th>Zajszűrés</th><th>Összesen</th><th v-for="c in CATS" :key="c" class="hide-m">{{ c }}</th></tr></thead>
        <tbody><tr v-for="h in hist" :key="h.id"><td class="small nowrap">{{ fmtDT(new Date(h.at)) }}</td><td>{{ h.recognizer === 'whisper' ? 'Whisper' : 'böngésző' }}</td><td>{{ h.noise ? 'be' : 'ki' }}</td><td><b>{{ h.total }}%</b></td><td v-for="c in CATS" :key="c" class="hide-m">{{ h.byCat[c] ?? '–' }}%</td></tr></tbody></table></div>
      <div v-else class="muted">Még nincs mentett betanítás. Az eredmények itt összevethetők (felismerőnként, zajszűréssel és anélkül).</div>
    </div>
  </div>
</template>

<style scoped>
.train-sec { border-top: 1px solid #eef1f3; padding: 10px 0 }
.train-sec.done { background: #f7fbf8 }
.train-text { font-size: 17px; line-height: 1.5; margin-top: 4px }
</style>
