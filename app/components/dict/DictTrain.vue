<script setup lang="ts">
// Diktálás betanítása (spec v2.3, 3. pont; v2.4 1., 3., 4., 19. pont).
// – v2.5 2. pont: „Hogyan használd?” összecsukható útmutató lépésekkel és hivatkozással a Súgó fejezetére; döntési kérdés minden javaslatnál;
//   tipp a „Tovább így is” mellett; „A tanult javítások ezen az eszközön érvényesek” jelzés.
// – Rövid, összecsukható használati útmutató a képernyő tetején; a bemutató-tájékoztató felirat itt nem jelenik meg (1. pont); AI-kapcsoló nincs (19/1).
// – Az összehasonlítás kapcsoló nélkül, mindig fut a háttérben (19. pont 1.); az eredménye csak a teszt ágon, a fejlesztői panelben látszik.
// – Minden felolvasott szakasz után egyértelmű visszajelzés: ✔ Jól felismertem / ⚠ Néhány szót másképp hallottam / ✖ Nem sikerült megérteni, és hogy mit tanult a program.
// – A mentés automatikus (szakaszonként, hang nélkül); a végén csak a javítási javaslatokat kell egyenként jóváhagyni (tömeges jóváhagyás nincs).
// – Szabályjavaslat csak megbízható eltérésből (hangzásra hasonló, vagy legalább 2-szer ismétlődő); nagyon eltérő szónál ismétlést kér.
// – Main ágon szavas minősítés (jó / közepes / gyenge), százalék nélkül; a teszt ágon a számszerű értékek felismerőnként.
import { useDataStore } from '~/stores/data'
import { useDictStore } from '~/stores/dict'
import { useTreatmentStore } from '~/stores/treatment'
import { useUiStore } from '~/stores/ui'
import { useVoiceStore, type DictResult } from '~/stores/voice'
import { buildVocab } from '~/utils/dict/vocab'
import { CATS, TRAIN_SECTIONS, facts, pct, sameWrong, score, wrongTerms, type Wrong } from '~/utils/dict/train'
import { canonTokens, rating, reliableSuggestion, sameWord, veryDifferent, wordAccuracy } from '~/utils/dict/quality'
import { DEV_TOOLS } from '~/utils/meta'
import { fmtDT, norm } from '~/utils/dates'
const DevDiag = __MOLIO_DEV__ ? defineAsyncComponent(() => import('~/components/dev/DevDiag.vue')) : null

const data = useDataStore(), dict = useDictStore(), voice = useVoiceStore(), tx = useTreatmentStore(), ui = useUiStore()
onMounted(() => { dict.init(); void voice.probe() })
onBeforeUnmount(() => { if (voice.recording) voice.stop() })
const db = computed(() => data.db)
const vocab = computed(() => buildVocab({ items: db.value.items, types: db.value.types, statusDict: db.value.settings.statusDict }))
const ctx = () => ({ items: db.value.items, types: db.value.types, vocab: vocab.value })
// v2.5 2. pont 7.: iOS-en (keskeny képernyőn) az útmutató alapból összecsukott; asztali gépen az első betanításnál nyitva
const guide = ref(!dict.trained && typeof window !== 'undefined' && window.innerWidth >= 700 && !/iPhone|iPad|iPod/.test(navigator.userAgent))

interface Part { id: string; text: string; live: string; browserFinal: string; whisper: string; recognizer: string; seconds: number; noSpeech: boolean; fallback: boolean; quiet: boolean; loud: boolean; none: boolean }
const parts = reactive<Record<string, Part>>({})
const cur = ref(''), active = ref('')
const worst = ref<'ok' | 'quiet' | 'loud' | 'none'>('ok')
const rank = { ok: 0, quiet: 1, loud: 1, none: 2 }
watch(() => voice.lvl, l => { if (voice.recording && rank[l as keyof typeof rank] > rank[worst.value]) worst.value = l as typeof worst.value })
const runId = ref('t' + Date.now().toString(36))
const step = ref(0)

async function rec(id: string) {
  if (voice.recording && active.value === id) { voice.stop(); return }
  if (voice.recording || voice.processing) return
  active.value = id; cur.value = ''; worst.value = 'ok'
  await voice.start({ get: () => cur.value, set: v => { cur.value = v } }, { prompt: (st) => tx.promptText(st), onDone: (r: DictResult) => {
    parts[id] = { id, text: r.text, live: r.live, browserFinal: r.browserFinal || '', whisper: r.whisper || '', recognizer: r.recognizer, seconds: r.seconds, noSpeech: r.noSpeech || !!r.netFail || !r.text.trim(), fallback: r.fallback, quiet: worst.value === 'quiet', loud: worst.value === 'loud', none: worst.value === 'none' }
    autoSave()
  } })
}

const ref_ = (id: string) => TRAIN_SECTIONS.find(s => s.id === id)!.text
// a mérés a javítások NÉLKÜL fut (különben a már elfogadott szabályok elfednék a felismerő hibáit)
const evalOf = (id: string, heard: string) => score(facts(ref_(id), ctx()), facts(heard, ctx()))
const pctOf = (id: string, heard: string) => { const e = evalOf(id, heard); return pct(e.ok, e.total) }
const catOfWord = (w: string) => { const s = ctx(); return /^\d+$/.test(canonTokens(w).join('')) ? 'mennyiség / fogszám' : s.items.some(i => i.kw?.some(k => k.replace('*', '') && w.startsWith(k.replace('*', '')))) ? 'anyag' : 'szöveg' }
/** rosszul hallott kifejezések: a számnévvel / számjeggyel kimondott azonos érték nem hiba („harminchat” = 36) */
const wrongOf = (id: string, heard: string): Wrong[] => wrongTerms(ref_(id), heard, catOfWord).filter(w => w.heard === '(kimaradt)' || !canonTokens(w.said).every((x, i) => sameWord(x, canonTokens(w.heard)[i] || '')))
/** a szakasz értékelése: értelmezhető beszéd nem érkezett → nem számít bele az összesítésbe */
type Verdict = 'ok' | 'some' | 'bad'
function verdict(p: Part): Verdict {
  if (p.noSpeech) return 'bad'
  const acc = wordAccuracy(ref_(p.id), p.text).ratio
  const pc = pctOf(p.id, p.text)
  if (acc < 0.3 && pc < 50) return 'bad'
  return pc >= 90 && !wrongOf(p.id, p.text).filter(w => w.heard !== '(kimaradt)').length ? 'ok' : 'some'
}
const valid = computed(() => TRAIN_SECTIONS.filter(s => parts[s.id] && !parts[s.id]!.noSpeech))
const done = computed(() => TRAIN_SECTIONS.filter(s => parts[s.id]))
const reason = (p: Part) => (p.none ? 'Nem érkezett hang – ellenőrizze a mikrofont.' : p.quiet ? 'Halk volt a hang – beszéljen közelebb a mikrofonhoz.' : p.loud ? 'Túl hangos volt – tartsa távolabb a mikrofont.' : p.noSpeech ? 'Nem érkezett értelmezhető beszéd – ismételje meg.' : 'A felismerő nem értette a szöveget – beszéljen lassabban, közelebb a mikrofonhoz.')

/* ---------- javaslatok: csak megbízható eltérésből (19. pont 6.) ---------- */
const seenTimes = (w: Wrong) => {
  const here = done.value.flatMap(s => wrongOf(s.id, parts[s.id]!.text)).filter(x => sameWrong(x, w)).length
  const before = dict.s.training.filter(t => t.id !== runId.value).flatMap(t => t.wrong).filter(x => sameWrong(x, w)).length
  return here + before
}
const allWrong = computed(() => valid.value.flatMap(s => wrongOf(s.id, parts[s.id]!.text)))
const proposals = computed(() => {
  const seen = new Set<string>()
  return allWrong.value.filter(w => w.heard !== '(kimaradt)' && !dict.s.personal.some(p => norm(p.from).trim() === norm(w.heard).trim()) && reliableSuggestion(w.said, w.heard, seenTimes(w)))
    .filter(w => { const k = sugKey(w); return seen.has(k) ? false : (seen.add(k), true) })
})
const sectionProposals = (id: string) => { const p = parts[id]; if (!p || p.noSpeech) return [] as Wrong[]; return wrongOf(id, p.text).filter(w => w.heard !== '(kimaradt)' && proposals.value.some(x => sameWrong(x, w))) }
const veryDiff = (id: string) => { const p = parts[id]; if (!p || p.noSpeech) return [] as Wrong[]; return wrongOf(id, p.text).filter(w => w.heard !== '(kimaradt)' && veryDifferent(w.said, w.heard) && seenTimes(w) < 2) }
const sugKey = (w: Wrong) => norm(w.heard) + '→' + norm(w.said)
const gone = ref<string[]>([])
const shown = computed(() => proposals.value.filter(w => !gone.value.includes(sugKey(w))))
const isNum = (w: Wrong) => canonTokens(w.said + ' ' + w.heard).some(x => /^\d+(\.\d+)?$/.test(x))
const accept = (w: Wrong) => { dict.addPersonal(w.heard, w.said, 'betanitas', dict.s.prefs.recognizer); gone.value.push(sugKey(w)); ui.toast('Jóváhagyva – a következő diktálásoknál magától lefut') }
const reject = (w: Wrong) => { gone.value.push(sugKey(w)) }

/* ---------- összesítés és automatikus mentés ---------- */
const totals = computed(() => {
  const per = (pick: (p: Part) => string) => {
    const by = Object.fromEntries(CATS.map(c => [c, { total: 0, ok: 0 }])) as Record<string, { total: number; ok: number }>
    let total = 0, ok = 0
    for (const s of valid.value) { const h = pick(parts[s.id]!); if (!h.trim()) continue; const sc = evalOf(s.id, h); total += sc.total; ok += sc.ok; CATS.forEach(c => { by[c]!.total += sc.byCat[c].total; by[c]!.ok += sc.byCat[c].ok }) }
    return { total, ok, by, pct: pct(ok, total) }
  }
  return { main: per(p => p.text), whisper: per(p => p.whisper), browser: per(p => p.browserFinal || p.live) }
})
const prev = computed(() => dict.s.training.filter(t => t.id !== runId.value).slice(-1)[0] || null)
const change = computed(() => { if (!prev.value || !valid.value.length) return ''; const d = totals.value.main.pct - prev.value.total; return d >= 5 ? 'javult' : d <= -5 ? 'romlott' : 'nagyjából változatlan' })
function autoSave() {
  if (!valid.value.length) return
  const t = totals.value.main
  const rec = { recognizer: dict.eff.recognizer, noise: dict.eff.noise, total: t.pct, byCat: Object.fromEntries(CATS.map(c => [c, pct(t.by[c]!.ok, t.by[c]!.total)])), wrong: allWrong.value.slice(0, 40).map(w => ({ said: w.said, heard: w.heard, cat: w.cat })) }
  const ex = dict.s.training.find(x => x.id === runId.value)
  if (ex) Object.assign(ex, rec, { at: new Date().toISOString() })
  else { dict.s.training.push({ id: runId.value, at: new Date().toISOString(), ...rec }); dict.s.skipped = false }
}
const finished = computed(() => done.value.length >= TRAIN_SECTIONS.length || step.value >= TRAIN_SECTIONS.length)
function next(id: string) { const i = TRAIN_SECTIONS.findIndex(s => s.id === id); step.value = Math.max(step.value, i + 1) }
async function skip() { dict.s.skipped = true; ui.toast('Kihagyva – a Beállításokból bármikor elindítható') }
const reset = () => { Object.keys(parts).forEach(k => delete parts[k]); gone.value = []; step.value = 0; runId.value = 't' + Date.now().toString(36) }
const hist = computed(() => dict.s.training.slice().reverse())
const ratingCls = (r: string) => (r === 'jó' ? 'b-green' : r === 'közepes' ? 'b-yellow' : 'b-red')
</script>

<template>
  <div>
    <!-- v2.5 2. pont 2.: összecsukható „Hogyan használd?” útmutató 4–5 lépéssel, hivatkozás a Súgó teljes fejezetére -->
    <details class="hint" :open="guide" data-test="betanitas-utmutato" @toggle="guide = ($event.target as HTMLDetailsElement).open">
      <summary style="cursor:pointer;font-weight:700">Hogyan használd?</summary>
      <ol style="margin:6px 0 0 18px;padding:0;line-height:1.6">
        <li>Nyomd meg a „Felolvasom” gombot, és olvasd fel a szakaszt természetes tempóban (szakaszonként kb. 30 másodperc).</li>
        <li>Nézd meg a visszajelzést: ✔ zöld – „Tovább”; ⚠ sárga – látod a másképp hallott szavakat, „Tovább így is” vagy „Mondja el újra”; ✖ piros – „Mondja el újra”.</li>
        <li>A „Tovább így is” csak továbblép: a szabályról a végén döntesz.</li>
        <li>A végén döntsd el a javaslatokat egyenként: ha a hallott szót a diktálásban sosem akarod valóban mondani, „Jóváhagyom”; ha előfordulhat, vagy bizonytalan vagy, „Nem”.</li>
        <li>A mentés automatikus (csak szöveg, hangfelvétel nem); a jóváhagyott javítás a következő diktálástól magától lefut.</li>
      </ol>
      <p class="small" style="margin:6px 0 0"><NuxtLink :to="{ path: '/sugo', query: { fejezet: 'betanitas' } }" data-test="betanitas-sugo-link">A teljes leírás a Súgóban: Diktálás betanítása – lépésről lépésre →</NuxtLink></p>
      <p class="small muted" style="margin:4px 0 0">Az AI-értelmezés a Diktálás lapon kapcsolható, a betanításhoz nem kell.</p>
    </details>
    <div class="small muted" style="margin:0 0 8px" data-test="tanult-eszkoz-betanitas">A tanult javítások ezen az eszközön érvényesek.</div>
    <div class="card">
      <div class="row" style="margin-bottom:8px"><h2 style="margin:0">Felolvasandó szöveg</h2><div class="spacer" /><button class="btn sm" @click="reset">Újrakezdés</button></div>
      <DictBar />
      <div v-for="(s, i) in TRAIN_SECTIONS" :key="s.id" class="train-sec" :class="{ done: parts[s.id] }">
        <div class="row"><b>{{ s.title }}</b><div class="spacer" />
          <span v-if="DEV_TOOLS && parts[s.id] && !parts[s.id]!.noSpeech" class="badge b-gray" data-test="szakasz-szazalek">{{ parts[s.id]!.recognizer === 'whisper' ? 'Whisper' : 'böngésző' }}: {{ pctOf(s.id, parts[s.id]!.text) }}%<template v-if="parts[s.id]!.whisper && parts[s.id]!.recognizer !== 'whisper'"> – Whisper: {{ pctOf(s.id, parts[s.id]!.whisper) }}%</template><template v-if="parts[s.id]!.browserFinal || parts[s.id]!.live"> – böngésző: {{ pctOf(s.id, parts[s.id]!.browserFinal || parts[s.id]!.live) }}%</template></span>
          <button class="btn sm" :class="{ pri: !(voice.recording && active === s.id) && !parts[s.id] }" :disabled="voice.processing || (voice.recording && active !== s.id)" :data-rec="s.id" @click="rec(s.id)">{{ voice.recording && active === s.id ? 'Leállítás' : parts[s.id] ? 'Mondja el újra' : 'Felolvasom' }}</button></div>
        <div class="train-text">{{ s.text }}</div>
        <!-- szakaszonkénti visszajelzés (19. pont 4.) -->
        <div v-if="parts[s.id] && !(voice.recording && active === s.id)" class="fb-card" :class="verdict(parts[s.id]!) === 'ok' ? 'ok' : verdict(parts[s.id]!) === 'some' ? 'warn' : 'bad'" data-test="szakasz-visszajelzes">
          <template v-if="verdict(parts[s.id]!) === 'ok'"><div class="fb-h">✔ Jól felismertem</div></template>
          <template v-else-if="verdict(parts[s.id]!) === 'some'">
            <div class="fb-h">⚠ Néhány szót másképp hallottam</div>
            <div v-for="(w, k) in wrongOf(s.id, parts[s.id]!.text)" :key="k" class="small">felolvasott: <b>{{ w.said }}</b> – hallott: {{ w.heard }}</div>
            <div v-if="veryDiff(s.id).length" class="small" style="margin-top:4px">Ez nagyon eltér a felolvasottól – ebből nem készítek szabályt, mert később a helyes diktálást rontaná el. Mondja el újra.</div>
          </template>
          <template v-else><div class="fb-h">✖ Nem sikerült megérteni</div><div class="small">{{ reason(parts[s.id]!) }}</div></template>
          <div v-if="parts[s.id]!.fallback && !parts[s.id]!.noSpeech" class="small muted">Most a tartalék felismerő dolgozott, az eredmény így is érvényes.</div>
          <div class="small" style="margin-top:4px">{{ sectionProposals(s.id).length ? `${sectionProposals(s.id).length} új javítási javaslat készült` : 'Nincs új javítás' }}</div>
          <div class="row" style="margin-top:8px">
            <button v-if="verdict(parts[s.id]!) !== 'ok'" class="btn sm" :class="{ pri: verdict(parts[s.id]!) === 'bad' }" @click="rec(s.id)">Mondja el újra</button>
            <button v-if="verdict(parts[s.id]!) !== 'bad' && i < TRAIN_SECTIONS.length - 1" class="btn sm" :class="{ pri: verdict(parts[s.id]!) === 'ok' }" @click="next(s.id)">{{ verdict(parts[s.id]!) === 'ok' ? 'Tovább' : 'Tovább így is' }}</button>
          </div>
          <!-- v2.5 2. pont 3.: a „Tovább így is” nem szabályelfogadás -->
          <div v-if="verdict(parts[s.id]!) === 'some' && i < TRAIN_SECTIONS.length - 1" class="small muted" style="margin-top:4px" data-test="tovabb-tipp">Tipp: a „Tovább így is” csak továbblép; a szabályról a végén döntesz.</div>
          <div v-if="DEV_TOOLS" class="small muted" style="margin-top:6px">Hallott ({{ parts[s.id]!.recognizer }}): {{ parts[s.id]!.text || '–' }}</div>
        </div>
      </div>
      <component :is="DevDiag" v-if="DevDiag && Object.keys(parts).length" title="betanítás" :extra="{ szakaszok: done.map(s => ({ szakasz: s.title, felolvasando: s.text, hallott: parts[s.id]!.text, whisper: parts[s.id]!.whisper, bongeszo: parts[s.id]!.browserFinal || parts[s.id]!.live, felismero: parts[s.id]!.recognizer, nemErtelmezheto: parts[s.id]!.noSpeech, pontossag: parts[s.id]!.noSpeech ? null : pctOf(s.id, parts[s.id]!.text) })), osszesen: { hasznalt: totals.main.pct, whisper: totals.whisper.pct, bongeszo: totals.browser.pct, kategoriak: totals.main.by } }" />
    </div>

    <div v-if="done.length" class="card" data-test="eredmeny">
      <h2>Összefoglaló – {{ done.length }}/{{ TRAIN_SECTIONS.length }} szakasz</h2>
      <template v-if="valid.length">
        <div class="row" style="margin-bottom:8px">
          <span class="badge" :class="ratingCls(rating(totals.main.pct))" style="font-size:15px">Minősítés: {{ rating(totals.main.pct) }}</span>
          <span v-if="change" class="small">Az előző betanításhoz képest: <b>{{ change }}</b><template v-if="DEV_TOOLS"> ({{ prev?.total }}% → {{ totals.main.pct }}%)</template></span>
        </div>
        <p style="margin:4px 0">{{ allWrong.length }} rosszul felismert kifejezés, {{ proposals.length }} javítási javaslat – a jóváhagyott javítások a következő diktálásoknál automatikusan lefutnak.</p>
        <div v-if="DEV_TOOLS" class="row small" style="margin-bottom:8px">
          <span class="badge b-blue">Használt felismerő: {{ totals.main.pct }}%</span><span class="badge b-gray">Whisper: {{ totals.whisper.total ? totals.whisper.pct + '%' : '–' }}</span><span class="badge b-gray">böngésző: {{ totals.browser.total ? totals.browser.pct + '%' : '–' }}</span>
          <span v-for="c in CATS" :key="c" class="badge b-gray">{{ c }}: {{ totals.main.by[c]!.total ? pct(totals.main.by[c]!.ok, totals.main.by[c]!.total) + '%' : '–' }}</span>
        </div>
      </template>
      <p v-else class="muted">Még nem érkezett értelmezhető beszéd – a szakaszok nem számítanak bele az értékelésbe.</p>
      <h3 v-if="shown.length">Javasolt javítások – egyenként hagyd jóvá</h3>
      <!-- v2.5 2. pont 3.: egyszerű döntési szabály minden javaslat mellett (Nem → Jóváhagyom; Igen vagy bizonytalan → Nem); tömeges jóváhagyás nincs -->
      <div v-for="w in shown" :key="sugKey(w)" style="padding:6px 0;border-bottom:1px solid #eef1f3" data-test="betanitas-javaslat">
        <div class="row">
          <span>ha ezt hallja: „<b>{{ w.heard }}</b>” → értse úgy: „<b>{{ w.said }}</b>”</span>
          <span v-if="isNum(w)" class="badge b-yellow">számot / fogszámot érint – légy óvatos</span>
          <div class="spacer" />
          <button class="btn sm pri" @click="accept(w)">Jóváhagyom</button><button class="btn sm" @click="reject(w)">Nem</button>
        </div>
        <div class="small muted" style="margin-top:2px" data-test="javaslat-kerdes">Előfordulhat, hogy a hallott szót („{{ w.heard }}”) valóban azt akartad mondani? <b>Nem</b> → Jóváhagyom; <b>igen vagy bizonytalan</b> → Nem.</div>
      </div>
      <p v-if="finished && !shown.length && valid.length" style="margin:8px 0 0"><b>Minden jól ment, nincs teendő.</b></p>
      <p class="small muted" style="margin:8px 0 0">Az eredmény magától mentődik (csak szöveg, hangfelvétel nem).</p>
    </div>

    <div class="card">
      <div class="row" style="margin-bottom:8px"><h2 style="margin:0">Előzmények</h2><div class="spacer" /><button v-if="!dict.trained && !dict.s.skipped" class="btn sm" @click="skip">Kihagyom most</button></div>
      <div v-if="hist.length" class="scroll-x"><table class="t ss"><thead><tr><th>Mikor</th><th>Minősítés</th><th v-if="DEV_TOOLS">Felismerő</th><th v-if="DEV_TOOLS">Összesen</th><th v-for="c in (DEV_TOOLS ? CATS : [])" :key="c" class="hide-m">{{ c }}</th></tr></thead>
        <tbody><tr v-for="h in hist" :key="h.id"><td class="small nowrap">{{ fmtDT(new Date(h.at)) }}</td><td><span class="badge" :class="ratingCls(rating(h.total))">{{ rating(h.total) }}</span></td><td v-if="DEV_TOOLS">{{ h.recognizer === 'whisper' ? 'Whisper' : 'böngésző' }} · zajszűrés {{ h.noise ? 'be' : 'ki' }}</td><td v-if="DEV_TOOLS"><b>{{ h.total }}%</b></td><td v-for="c in (DEV_TOOLS ? CATS : [])" :key="c" class="hide-m">{{ h.byCat[c] ?? '–' }}%</td></tr></tbody></table></div>
      <div v-else class="muted">Még nincs mentett betanítás.</div>
    </div>
  </div>
</template>

<style scoped>
.train-sec { border-top: 1px solid #eef1f3; padding: 10px 0 }
.train-sec.done { background: #f7fbf8 }
.train-text { font-size: 17px; line-height: 1.5; margin-top: 4px }
@media (max-width: 700px) { .fb-card .row { position: sticky; bottom: calc(64px + var(--safe-b, 0px)); background: inherit; padding: 6px 0 } }
</style>
