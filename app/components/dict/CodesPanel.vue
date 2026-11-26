<script setup lang="ts">
// „Kódtáblák és szinonimák” (spec v2.1, 5. pont; v2.3, 2–5., 10., 13., 15. pont): szinonimák, kódtáblák, a fogazati státusz felismerési szótára (külön fül a Fogállapotok mellett),
// diktálási alapszótár, személyes javítások, kitaláció-szűrő, ismeretlen kifejezések, összeférhetőségi szabályok, tanult szabályok és napló.
import { useDataStore } from '~/stores/data'
import { useDictStore } from '~/stores/dict'
import { useUiStore } from '~/stores/ui'
import { BASE_ROWS, BASE_VERSION, rowActive } from '~/utils/dict/base'
import { HALLU_VERSION, DEFAULT_HALLU } from '~/utils/dict/filters'
import { codeTables, DEFAULT_SYNONYMS, setSynonyms } from '~/utils/codesets'
import { parseKw, uid, fmtDT } from '~/utils/dates'
import { STATUS_STYLE } from '~/utils/defaults'

const data = useDataStore(), dict = useDictStore(), ui = useUiStore()
const db = computed(() => data.db), st = computed(() => db.value.settings)
onMounted(() => dict.init())
const sub = ref<'syn' | 'tables' | 'status' | 'base' | 'personal' | 'hallu' | 'unknown' | 'compat' | 'learned' | 'log'>('syn')
const SUBS: [typeof sub.value, string][] = [['syn', 'Szinonimák'], ['tables', 'Kódtáblák'], ['status', 'Fogállapotok – felismerési szótár'], ['base', 'Alapszótár'], ['personal', 'Személyes javítások'], ['hallu', 'Kitaláció-szűrő'], ['unknown', 'Ismeretlen kifejezések'], ['compat', 'Összeférhetőség'], ['learned', 'Tanult szabályok'], ['log', 'Javítási napló']]
const saved = () => ui.toast('Mentve')

/* szinonimák */
const syn = computed(() => { if (!st.value.synonyms) st.value.synonyms = JSON.parse(JSON.stringify(DEFAULT_SYNONYMS)); return st.value.synonyms! })
const codes = computed(() => codeTables(db.value))
const codeOpen = ref('')
const synSaved = () => { setSynonyms(st.value.synonyms); saved() }
const addSyn = () => { syn.value.push({ id: uid(), from: '', to: '', group: 'egyéb' }) }
const delSyn = (id: string) => { st.value.synonyms = syn.value.filter(x => x.id !== id); synSaved() }
const resetSyn = () => { st.value.synonyms = JSON.parse(JSON.stringify(DEFAULT_SYNONYMS)); synSaved() }
/* fogállapotok */
const addStatusDef = () => { st.value.statusDict.push({ id: 's' + Date.now().toString(36), name: 'új állapot', kw: [] }) }
const setKw = (obj: { kw: string[] }, v: string) => { obj.kw = parseKw(v); saved() }
/* alapszótár */
const bq = ref(''), bcat = ref('')
const cats = [...new Set(BASE_ROWS.map(r => r.cat))]
const baseShown = computed(() => BASE_ROWS.filter(r => (!bcat.value || r.cat === bcat.value) && (!bq.value || (r.forms.join(' ') + r.official + r.id + r.code).toLowerCase().includes(bq.value.toLowerCase()))))
/* személyes javítások */
const nf = ref(''), nt = ref('')
function addP() { if (!dict.addPersonal(nf.value, nt.value)) { ui.toast('Add meg a hibás és a helyes alakot'); return } nf.value = ''; nt.value = ''; saved() }
/* szűrő */
const nh = ref('')
const addH = () => { if (nh.value.trim()) { dict.s.extraFilter.push(nh.value.trim()); nh.value = ''; saved() } }
/* ismeretlen kifejezések */
const assign = reactive<Record<string, string>>({})
function assignU(term: string) {
  const to = (assign[term] || '').trim(); if (!to) { ui.toast('Add meg a hivatalos elnevezést'); return }
  syn.value.push({ id: uid(), from: term, to, group: 'ismeretlen kifejezésből' }); synSaved(); dict.dropUnknown(term); ui.toast(`„${term}” → „${to}” bekerült a közös szótárba`)
}
/* összeférhetőség */
const STATES = computed(() => st.value.statusDict)
const tog = (typeId: string, stId: string) => { const a = dict.s.compat[typeId] || (dict.s.compat[typeId] = []); const i = a.indexOf(stId); if (i >= 0) a.splice(i, 1); else a.push(stId) }
const recent = computed(() => dict.s.log.slice(-60).reverse())
/** v2.5 4. pont 4.: a tanult szabályok mérése (szó- és értelmezési szabályok együtt) */
const measured = computed(() => [
  ...dict.s.personal.map(p => ({ id: p.id, from: p.from, to: '„' + p.to + '”', kind: 'szó', uses: p.uses || 0, corrected: p.corrected || 0 })),
  ...dict.s.interp.map(r => ({ id: r.id, from: r.from, to: r.to, kind: 'értelmezés · ' + r.cat, uses: r.uses || 0, corrected: r.corrected || 0 })),
].map(m => ({ ...m, rate: m.uses ? m.corrected / m.uses : null })).sort((a, b) => b.uses - a.uses))
</script>

<template>
  <div>
    <div class="hint">
      A fogak, felszínek, állapotok, kezelések és anyagok <b>kódtáblákban</b> vannak (éles rendszerben PostgreSQL-táblák: verziószám {{ codes.version }}, {{ codes.date }}), a diktálás értelmezése ezekre, a <b>szinonimatáblára</b> és a <b>diktálási alapszótárra</b> épül.
      A fogazati státusz felismerési szótára a <b>Fogállapotok</b> kódtábla mellett, külön fülön található.
    </div>
    <div class="seg scroll-x" style="max-width:100%;margin-bottom:12px">
      <button v-for="[k, l] in SUBS" :key="k" :class="{ on: sub === k }" :data-sub="k" @click="sub = k">{{ l }}</button>
    </div>

    <div v-if="sub === 'syn'" class="card">
      <div class="row" style="margin-bottom:10px"><h2 style="margin:0">Szinonimatábla</h2><span class="badge b-gray">{{ syn.length }} bejegyzés</span><div class="spacer" /><button class="btn sm" @click="addSyn">+ Új szinonima</button><button class="btn sm" @click="resetSyn">Alapértékek</button></div>
      <div class="scroll-x"><table class="t">
        <thead><tr><th>Ha ezt mondja…</th><th>…ezt értjük alatta</th><th>Csoport</th><th /></tr></thead>
        <tbody><tr v-for="s in syn" :key="s.id">
          <td><input v-model.lazy="s.from" class="inp" @change="synSaved"></td><td><input v-model.lazy="s.to" class="inp" @change="synSaved"></td>
          <td><input v-model.lazy="s.group" class="inp" style="width:120px" @change="synSaved"></td><td><button class="btn sm danger" @click="delSyn(s.id)">×</button></td>
        </tr></tbody>
      </table></div>
    </div>

    <div v-else-if="sub === 'tables'" class="card">
      <h2>Kódtáblák (csak megtekintés)</h2>
      <div v-for="[k, label, n] in ([['teeth', 'Fogak (FDI)', codes.teeth.length], ['surfaces', 'Felszínek', codes.surfaces.length], ['states', 'Fogállapotok', codes.states.length], ['procedures', 'Kezelések', codes.procedures.length], ['materials', 'Anyagok', codes.materials.length]] as [string, string, number][])" :key="k" style="border-top:1px solid #eef1f3;padding:6px 0">
        <div class="row" style="cursor:pointer" @click="codeOpen = codeOpen === k ? '' : k"><b>{{ label }}</b><span class="badge b-gray">{{ n }} tétel</span><div class="spacer" /><span>{{ codeOpen === k ? '▴' : '▾' }}</span></div>
        <div v-if="codeOpen === k" class="small" style="margin-top:6px;line-height:1.7;columns:2 260px">
          <div v-for="(r, i) in (codes as unknown as Record<string, Record<string, unknown>[]>)[k]" :key="i"><code>{{ r.code }}</code> {{ r.name ?? r.hu }}<template v-if="r.unit"> ({{ r.unit }})</template></div>
        </div>
      </div>
    </div>

    <div v-else-if="sub === 'status'" class="card">
      <div class="row" style="margin-bottom:10px"><h2 style="margin:0">Fogazati státusz – felismerési szótár</h2><div class="spacer" /><button class="btn sm" @click="addStatusDef">+ Új állapot</button></div>
      <p class="muted small" style="margin-top:0">A Fogállapotok kódtábla szótára: a státuszfelvétel üzemmódban és a diktálásból felismert fogállapot-változásnál ezek alapján ismeri fel a program a fog állapotát. A * végű szó minden ragozott alakra illik.</p>
      <div class="scroll-x"><table class="t">
        <thead><tr><th>Állapot</th><th>Kulcsszavak</th></tr></thead>
        <tbody><tr v-for="d in st.statusDict" :key="d.id">
          <td style="width:220px"><input v-model.lazy="d.name" class="inp" @change="saved"></td>
          <td><input class="inp" :value="d.kw.join(', ')" @change="setKw(d, ($event.target as HTMLInputElement).value)"></td>
        </tr></tbody>
      </table></div>
    </div>

    <div v-else-if="sub === 'base'" class="card">
      <div class="row" style="margin-bottom:8px"><h2 style="margin:0">Diktálási alapszótár</h2><span class="badge b-gray">{{ BASE_VERSION.version }} · {{ BASE_ROWS.length }} sor · {{ BASE_VERSION.date }}</span></div>
      <p class="muted small" style="margin-top:0">Szleng / köznyelvi kifejezés → hivatalos elnevezés. Forrás: Molio_alapszotar_diktalas (Drive: 03_Adatbazis). A demóban mind a 131 sor működik, ellenőrzés nélkül; a hiányzó vagy hibás elemeket a tesztelés tapasztalatai alapján a táblázatban javítjuk.</p>
      <div class="row" style="margin-bottom:8px"><input v-model="bq" class="inp" style="max-width:260px" placeholder="Keresés…"><select v-model="bcat" class="inp auto"><option value="">minden kategória</option><option v-for="c in cats" :key="c" :value="c">{{ c }}</option></select><span class="small muted">{{ baseShown.length }} sor</span></div>
      <div class="scroll-x" style="max-height:520px;overflow:auto"><table class="t ss">
        <thead><tr><th>Azonosító</th><th>Kategória</th><th>Elhangzó formák</th><th>Hivatalos elnevezés</th><th>Kód</th><th class="hide-m">Megjegyzés</th><th>Hatás</th></tr></thead>
        <tbody><tr v-for="r in baseShown" :key="r.id"><td><code>{{ r.id }}</code></td><td>{{ r.cat }}</td><td>{{ r.forms.join('; ') }}</td><td>{{ r.official }}</td><td><code>{{ r.code }}</code></td><td class="small muted hide-m">{{ r.note }}</td>
          <td><span class="badge" :class="rowActive(r) ? 'b-green' : 'b-gray'" :title="rowActive(r) ? 'Átírja az elhangzó alakot az értelmezőnek ismert alakra' : 'Ismert kifejezés (nem kerül az ismeretlenek közé); a demó katalógusában nincs hozzá tétel'">{{ rowActive(r) ? 'átírás' : 'ismert' }}</span></td></tr></tbody>
      </table></div>
    </div>

    <div v-else-if="sub === 'personal'" class="card">
      <div class="row" style="margin-bottom:8px"><h2 style="margin:0">Személyes javítások</h2><span class="badge b-gray">{{ dict.s.personal.length }} szabály</span></div>
      <p class="muted small" style="margin-top:0">Csak ezen az eszközön érvényesek (élesben a felhasználóra); ütközésnél a személyes szabály az erősebb a közös szinonimánál. A „Diktálás betanítása” és a javítási napló javaslataiból jönnek létre, jóváhagyással – de kézzel is felvehetők.</p>
      <div class="row" style="margin-bottom:10px"><input v-model="nf" class="inp" style="max-width:240px" placeholder="Ha ezt írja le… (pl. harminc hatos)"><input v-model="nt" class="inp" style="max-width:240px" placeholder="…ezt értse (pl. 36-os)" @keyup.enter="addP"><button class="btn sm pri" @click="addP">+ Hozzáadás</button></div>
      <div class="scroll-x"><table class="t"><thead><tr><th>Felismert alak</th><th>Helyes alak</th><th>Forrás</th><th>Felismerő</th><th>Aktív</th><th /></tr></thead>
        <tbody><tr v-for="r in dict.s.personal" :key="r.id"><td><input v-model.lazy="r.from" class="inp"></td><td><input v-model.lazy="r.to" class="inp"></td><td class="small">{{ r.source }}</td><td class="small">{{ r.recognizer || '–' }}</td>
          <td><label class="switch" :class="{ on: r.active }" @click.prevent="r.active = !r.active"><i /></label></td><td><button class="btn sm danger" @click="dict.removePersonal(r.id)">×</button></td></tr>
          <tr v-if="!dict.s.personal.length"><td colspan="6" class="muted">Még nincs személyes javítás.</td></tr></tbody></table></div>
    </div>

    <div v-else-if="sub === 'hallu'" class="card">
      <div class="row" style="margin-bottom:8px"><h2 style="margin:0">Kitaláció-szűrő</h2><span class="badge b-gray">v{{ HALLU_VERSION.version }} · {{ DEFAULT_HALLU.length + dict.s.extraFilter.length }} mondat</span></div>
      <p class="muted small" style="margin-top:0">A Whisper csendes vagy zajos részekre néha el nem hangzott mondatot „hall” (pl. köszönetnyilvánítás, feliratozási megjegyzés). Az itt szereplő mondatokat a program eltávolítja a szövegből; a kiszűrt rész a nyers szövegben látszik, és a javítási naplóba kerül.</p>
      <div class="row" style="margin-bottom:10px"><input v-model="nh" class="inp" style="max-width:340px" placeholder="Új szűrendő mondat (ékezet nélkül is jó)" @keyup.enter="addH"><button class="btn sm pri" @click="addH">+ Hozzáadás</button></div>
      <div v-for="(h, i) in dict.s.extraFilter" :key="'x' + i" class="row small" style="padding:3px 0"><span>{{ h }}</span><span class="badge b-blue">saját</span><button class="btn sm" @click="dict.s.extraFilter.splice(i, 1)">×</button></div>
      <div class="small muted" style="columns:2 280px;line-height:1.7;margin-top:6px"><div v-for="h in DEFAULT_HALLU" :key="h">{{ h }}</div></div>
    </div>

    <div v-else-if="sub === 'unknown'" class="card">
      <div class="row" style="margin-bottom:8px"><h2 style="margin:0">Ismeretlen kifejezések</h2><span class="badge b-gray">{{ dict.s.unknown.length }} kifejezés</span></div>
      <p class="muted small" style="margin-top:0">A diktált szövegben olyan szó, amelyet a szótár nem ismer: nem dobjuk el, ide gyűlik. Egy lépésben hozzárendelhető egy hivatalos elnevezéshez (új szinonima a közös szótárba), vagy elvethető. Betegadat a listába nem kerül.</p>
      <div class="scroll-x"><table class="t ss"><thead><tr><th>Kifejezés</th><th>Előfordulás</th><th class="hide-m">Első / utolsó</th><th class="hide-m">Példamondat</th><th>Hozzárendelés</th></tr></thead>
        <tbody><tr v-for="u in dict.s.unknown" :key="u.term"><td><b>{{ u.term }}</b></td><td>{{ u.count }}</td><td class="small hide-m">{{ fmtDT(new Date(u.first)) }}<br>{{ fmtDT(new Date(u.last)) }}</td><td class="small muted hide-m">{{ u.example }}</td>
          <td class="nowrap"><input v-model="assign[u.term]" class="inp auto" style="width:150px" placeholder="hivatalos elnevezés"> <button class="btn sm pri" @click="assignU(u.term)">Hozzárendel</button> <button class="btn sm" @click="dict.dropUnknown(u.term)">Elvet</button></td></tr>
          <tr v-if="!dict.s.unknown.length"><td colspan="5" class="muted">Még nincs ismeretlen kifejezés – diktálás után itt gyűlnek.</td></tr></tbody></table></div>
    </div>

    <div v-else-if="sub === 'compat'" class="card">
      <h2>Összeférhetőségi szabályok (ellenőrzés a fogtérképpel)</h2>
      <p class="muted small" style="margin-top:0">Melyik művelet nem szokásos az adott fogállapotú fogon. Ha a diktált tétel ellentmond a fog aktuális állapotának, a program ⚠ jelzést ad, és felajánlja a valószínű helyes fogat. A kezdő szabálytáblát a demó műveleteihez állítottuk össze; az éles szótár-átnézéskor a fogorvos ezt is ellenőrzi.</p>
      <div class="scroll-x"><table class="t ss"><thead><tr><th>Művelet</th><th v-for="d in STATES" :key="d.id" class="small">{{ d.name }}</th></tr></thead>
        <tbody><tr v-for="t in db.types.filter(x => x.toothBound)" :key="t.id"><td><b>{{ t.name }}</b></td><td v-for="d in STATES" :key="d.id" style="text-align:center"><input type="checkbox" :checked="(dict.s.compat[t.id] || []).includes(d.id)" :aria-label="t.name + ' – ' + d.name" @change="tog(t.id, d.id)"></td></tr></tbody></table></div>
      <div class="small muted" style="margin-top:6px">Jelölt = ezen az állapotú fogon a művelet szokatlan (⚠).</div>
    </div>

    <div v-else-if="sub === 'learned'" class="card">
      <h2>Tanult szabályok – javaslatok</h2>
      <p class="muted small" style="margin-top:0">A javítási naplóból: ha ugyanaz a minta rendszeresen ugyanúgy dől el (legalább {{ dict.s.prefs.sugMinCount }} eset, ebből legalább {{ Math.round(dict.s.prefs.sugMinRatio * 100) }}% azonos), a program javasolja a szabályt. Csak jóváhagyással lép életbe, és először csak erre az eszközre érvényes. A végleges változatban a több felhasználónál előforduló szabályokat az adminisztrátornak javasolja közös szótárba emelésre (a demóban – eszközönkénti tárolás – ez csak szemlélteti a lehetőséget).</p>
      <div class="row"><label class="small">Legalább</label><input v-model.number="dict.s.prefs.sugMinCount" type="number" min="2" max="50" class="inp" style="width:70px"><label class="small">eset, ebből legalább</label><input v-model.number="dict.s.prefs.sugMinRatio" type="number" min="0.5" max="1" step="0.05" class="inp" style="width:80px"><span class="small muted">(0,8 = 80%) – adminisztrátori beállítás</span></div>
      <div v-for="x in dict.suggestions" :key="x.pattern + x.outcome" class="flagrow-s"><b>{{ x.label }}</b> <span class="small muted">{{ x.n }}/{{ x.total }} eset ({{ Math.round(x.ratio * 100) }}%)</span>
        <button class="btn sm pri" @click="dict.acceptSuggestion(x)">Elfogadom</button><button class="btn sm" @click="dict.dismissSuggestion(x)">Elvet</button></div>
      <div v-if="!dict.suggestions.length" class="muted" style="margin-top:8px">Még nincs elég ismétlődő eset a szabályjavaslathoz.</div>
      <h3 style="margin-top:16px">Elfogadott mennyiségi szabályok</h3>
      <div v-for="(q, i) in dict.s.qtyRules" :key="q.pattern" class="row small">{{ q.label }} <button class="btn sm" @click="dict.s.qtyRules.splice(i, 1)">Visszavonás</button></div>
      <div v-if="!dict.s.qtyRules.length" class="small muted">nincs</div>
      <!-- v2.5 4. pont 4.: összesítő – lefutások és utólagos javítások aránya szabályonként -->
      <h3 style="margin-top:16px">Tanult szabályok mérése</h3>
      <p class="small muted" style="margin-top:0">Szabályonként: hányszor futott le egy mentett diktálásban, és hányszor kellett utána mégis javítani (visszavonás, vagy eltérő kézi érték). A magas arány rossz szabályra utal – kapcsold ki vagy töröld (Beállítások → Diktálás → Tanult javítások).</p>
      <div v-if="measured.length" class="scroll-x" data-test="szabaly-meres"><table class="t ss"><thead><tr><th>Szabály</th><th>Fajta</th><th>Lefutott</th><th>Utólag javítva</th><th>Arány</th></tr></thead>
        <tbody><tr v-for="m in measured" :key="m.id"><td class="small">„{{ m.from }}” → {{ m.to }}</td><td class="small">{{ m.kind }}</td><td class="small">{{ m.uses }}×</td><td class="small">{{ m.corrected }}×</td><td class="small"><b :style="m.rate !== null && m.rate >= 0.3 ? 'color:var(--red)' : ''">{{ m.rate === null ? '–' : Math.round(m.rate * 100) + '%' }}</b></td></tr></tbody></table></div>
      <div v-else class="small muted">Még nincs tanult szabály.</div>
      <h3 style="margin-top:16px">Javítási arány kategóriánként</h3>
      <div class="row"><span v-for="(n, k) in dict.rates" :key="k" class="badge b-gray">{{ k }}: {{ n }}</span><span v-if="!Object.keys(dict.rates).length" class="small muted">még nincs bejegyzés</span></div>
      <div v-if="dict.s.aiStats.runs || dict.s.aiStats.diffs" class="hint" style="margin-top:10px"><b>AI hozzáadott értéke:</b> {{ dict.s.aiStats.runs }} diktálásnál futott, {{ dict.s.aiStats.diffs }} eltérés; eltérésnél az AI-nak {{ dict.s.aiStats.aiRight }}×, a szabálynak {{ dict.s.aiStats.ruleRight }}× volt igaza.</div>
    </div>

    <div v-else-if="sub === 'log'" class="card">
      <div class="row" style="margin-bottom:8px"><h2 style="margin:0">Javítási napló</h2><span class="badge b-gray">{{ dict.s.log.length }} bejegyzés</span><span class="badge" :class="dict.s.queue.length ? 'b-yellow' : 'b-green'">{{ dict.s.queue.length ? dict.s.queue.length + ' központi küldésre vár' : 'központilag gyűjtve' }}</span><div class="spacer" /><button class="btn sm" @click="dict.flush()">Küldés most</button></div>
      <p class="muted small" style="margin-top:0">Minden kézi javítás, ⚠ választás és „Nem ezt mondtam” jelzés ide kerül (csak szöveg, hangfelvétel nincs; betegadat nélkül). A bejegyzések anonimizáltan a demó Workerén keresztül egy központi tárolóba is eljutnak, hogy minden tesztelő jelzése egy helyen látható legyen; hálózati hiba esetén az eszközön várakoznak.</p>
      <div class="scroll-x" style="max-height:420px;overflow:auto"><table class="t ss"><thead><tr><th>Idő</th><th>Forrás</th><th>Fajta</th><th>Nyers → javított</th><th class="hide-m">Felismerő</th></tr></thead>
        <tbody><tr v-for="l in recent" :key="l.id"><td class="small nowrap">{{ fmtDT(new Date(l.at)) }}</td><td class="small">{{ l.source === 'jelzes' ? 'jelzés' : 'automatikus' }}</td><td class="small">{{ l.kind }}</td><td class="small">{{ l.raw.slice(0, 80) }} → <b>{{ l.final.slice(0, 80) }}</b></td><td class="small hide-m">{{ l.recognizer }}{{ l.noise ? '' : ' (zajszűrés nélkül)' }}</td></tr>
          <tr v-if="!recent.length"><td colspan="5" class="muted">Még nincs bejegyzés.</td></tr></tbody></table></div>
    </div>
  </div>
</template>

<style scoped>
.flagrow-s { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; padding: 8px 0; border-bottom: 1px solid #eef1f3 }
</style>
