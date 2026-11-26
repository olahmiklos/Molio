<script setup lang="ts">
// A diktálás ellenőrzése (spec v2.3, 5., 9., 10., 13., 15., 17. pont; v2.4 2., 4., 6., 12., 13., 15. pont):
// a „Diktálás és jegyzet” kártyán belül, a diktált szöveg alatt – csak akkor jelenik meg valami, ha van ellenőrizendő (⚠) sor.
// ⚠ csak kockázatos eltérésnél (v2.4 2. pont); a kisebb AI-eltérés halvány jelzés a soron. A tanult javítás (fogszám / művelet / anyag) első
// alkalmazásakor jelölést kap és egy koppintással visszavonható. A nyers szöveg és a feldolgozás lépései csak a teszt ágon, a fejlesztői panelben.
import { useTreatmentStore } from '~/stores/treatment'
import { useDataStore } from '~/stores/data'
import { DEV_TOOLS } from '~/utils/meta'
import { allTeeth } from '~/utils/teeth'
const DevDiag = __MOLIO_DEV__ ? defineAsyncComponent(() => import('~/components/dev/DevDiag.vue')) : null
const tx = useTreatmentStore()
const data = useDataStore()
const s = computed(() => tx.s!)
const KIND: Record<string, string> = { similar: 'Szó-egyeztetés', ambig: 'Kétértelmű szó', repeat: 'Ismétlés', dense: 'Sűrű átirat', chart: 'Fogtérkép', prebooked: 'Előjegyzés', qty: 'Mennyiség', ai: 'AI-eltérés', life: 'Életszerűség', macro: 'Rövidítés' }
const done = (k: string) => s.value.resolved[k]
const ai = computed(() => s.value.ai)
const shown = computed(() => tx.pendingFlags)
const learned = computed(() => tx.learnedApplied.filter(l => l.risky && l.first))
const teeth = computed(() => allTeeth(tx.patient?.dentition || 'permanent'))
const omitted = computed(() => tx.macroHits.flatMap(h => h.lines.map((l, i) => ({ h, l, i })).filter(x => tx.lineOmitted(x.h, x.i))))
const interp = computed(() => ({ tanultSzabalyok: tx.learnedApplied.map(l => ({ fajta: l.interp ? 'értelmezési' : 'szó', mit: l.rule.from, mire: l.rule.to, kategoria: l.rule.cat, lefutott: l.rule.uses || 0, elsoAlkalmazas: l.first })), visszavonva: s.value.undoRules, szabaly: tx.doneItems.map(i => ({ fog: i.tooth, muvelet: i.typeId })), anyagok: tx.rows.filter(r => r.checked).map(r => ({ anyag: r.id, db: r.qty, allapot: r.st })), ai: ai.value.state === 'done' ? { tetelek: ai.value.items, anyagok: ai.value.materials, modell: ai.value.model } : ai.value.state, jelzesek: tx.flags.map(f => f.key), rovidites: tx.macroHits.map(h => ({ nev: h.name, fogak: h.teeth })) }))
const typeName = (id: string) => data.db.types.find(t => t.id === id)?.name || id
</script>

<template>
  <div>
    <div v-if="s.dict.noSpeech" class="warn">Nem sikerült megérteni – kérjük, mondja újra.</div>
    <div v-if="ai.state === 'err' && DEV_TOOLS" class="hint small">AI-értelmezés: {{ ai.error }} – a szabályalapú eredmény érvényes.</div>
    <!-- tanult javítás első alkalmazása (v2.4 6. pont, v2.5 4. pont 3.): jelölés „Korábbi javításod alapján” (a main ági egyszerű nézetben is)
         és egykoppintásos visszavonás; értelmezési szabálynál is (kifejezés → tétel / anyag / fogszám / mennyiség) -->
    <div v-for="l in learned" :key="l.rule.id" class="small row" style="gap:6px;margin:6px 0" data-test="tanult-javitas">
      <span class="learned-mark">Korábbi javításod alapján</span> „{{ l.rule.from }}” → <b>{{ l.interp ? l.rule.to : '„' + l.rule.to + '”' }}</b><span v-if="DEV_TOOLS" class="muted"> · {{ l.interp ? 'értelmezési szabály' : 'szószabály' }}, {{ l.rule.cat || '–' }}, első alkalmazás</span>
      <button class="btn sm" type="button" data-test="tanult-visszavonas" @click="tx.undoLearned(l.rule.id)">Visszavonás</button>
    </div>
    <!-- rövidítésből elhagyott sorok (v2.4 15. pont 4.): halványan, áthúzva megmaradnak, egy koppintással visszaállíthatók -->
    <div v-for="o in omitted" :key="o.h.key + o.i" class="small row" style="gap:6px;margin:4px 0;opacity:.7">
      <s>{{ tx.lineName(o.l) }}</s><span class="badge b-gray">elhagyva · „{{ o.h.name }}”</span>
      <button class="btn sm" type="button" @click="tx.restoreMacroLine(o.h, o.i)">Visszaállítás</button>
    </div>
    <div v-for="f in shown" :key="f.key" class="flagrow" :data-kind="f.kind">
      <div class="fr-h"><span class="badge b-yellow">⚠ {{ KIND[f.kind] }}</span><b>{{ f.title }}</b></div>
      <div v-if="f.detail" class="small muted">{{ f.detail }}</div>
      <div v-if="f.kind === 'macro' && f.data?.ask === 'tooth'" class="row" style="margin-top:6px">
        <select class="inp auto" aria-label="Melyik fog?" @change="tx.setMacroTooth(String(f.data!.hit), Number(($event.target as HTMLSelectElement).value))">
          <option value="">Melyik fog?</option><option v-for="n in teeth" :key="n" :value="n">{{ n }}</option>
        </select>
      </div>
      <div v-else-if="f.kind === 'macro'" class="row" style="margin-top:6px">
        <button v-for="c in f.choices" :key="c.id" class="btn sm" type="button" @click="tx.setMacroOmit(String(f.data!.hit), Number(c.id))">{{ c.label }}</button>
      </div>
      <div v-else class="row" style="margin-top:6px">
        <button v-for="c in f.choices" :key="c.id" class="btn sm" :class="{ go: f.suggested === c.id }" :title="c.hint" type="button" @click="tx.resolveFlag(f, c.id)">{{ c.label }}<span v-if="c.hint" class="small" style="opacity:.7"> · {{ c.hint }}</span></button>
      </div>
    </div>
    <div v-if="tx.macroHits.length" class="small muted" style="margin-top:4px">Rövidítés: {{ tx.macroHits.map(h => '„' + h.name + '”' + (h.teeth.length ? ' (' + h.teeth.join(', ') + ')' : '')).join(', ') }} – a tételek normál sorként szerkeszthetők.</div>
    <component :is="DevDiag" v-if="DevDiag" title="diktálás" :pipe="tx.pipe" :interp="interp" :extra="{ felismero: s.dict.recognizer, tartalek: s.dict.fallback, elterElonezettol: s.dict.differs, aiAllapot: ai.state, aiModell: ai.model, tervezett: s.planItems.map(p => (p.tooth ? p.tooth + ' ' : '') + typeName(p.typeId)) }" />
  </div>
</template>

<style scoped>
.flagrow { border: 1.5px solid #f0cf7a; background: #fffaf0; border-radius: 10px; padding: 10px 12px; margin: 8px 0 }
.fr-h { display: flex; gap: 8px; align-items: center; flex-wrap: wrap }
</style>
