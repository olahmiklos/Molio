<script setup lang="ts">
// Rövidítés (makró) létrehozása és szerkesztése (spec v2.4 15. pont): a diktálás eredményéből („Mentés rövidítésként”), kézzel a katalógusból,
// vagy a program ajánlásából. A név gépeléssel vagy ennek az ablaknak a saját diktálás gombjával is megadható.
import { useDataStore } from '~/stores/data'
import { useDictStore } from '~/stores/dict'
import { useTreatmentStore } from '~/stores/treatment'
import { useUiStore } from '~/stores/ui'
import { useVoiceStore } from '~/stores/voice'
import { nameConflict, type Macro, type MacroLine } from '~/utils/dict/macro'
import { uid } from '~/utils/dates'

const props = defineProps<{ id?: string; fromResult?: boolean; preset?: { typeIds: string[]; mats: { item: string; qty: number }[]; sig?: string } }>()
const data = useDataStore(), dict = useDictStore(), tx = useTreatmentStore(), ui = useUiStore(), voice = useVoiceStore()
dict.init()
const db = computed(() => data.db)
const ed = props.id ? dict.s.macros.find(m => m.id === props.id) : undefined
const name = ref(ed?.name || '')
const aliases = ref(ed?.aliases.join(', ') || '')
type L = MacroLine & { on: boolean }
const initial = (): L[] => {
  if (ed) return ed.lines.map(l => ({ ...l, on: true }))
  if (props.preset) return [...props.preset.typeIds.map(id => ({ kind: 'type' as const, id, on: true })), ...props.preset.mats.map(m => ({ kind: 'mat' as const, id: m.item, qty: m.qty, on: true }))]
  if (props.fromResult && tx.s) return [...new Set(tx.doneItems.map(i => i.typeId))].map(id => ({ kind: 'type' as const, id, on: true })).concat(tx.rows.filter(r => r.checked && r.qty > 0).map(r => ({ kind: 'mat' as const, id: r.id, qty: r.qty, on: true })) as never)
  return []
}
const lines = ref<L[]>(initial())
const msg = ref('')
const addType = ref(''), addMat = ref('')
const label = (l: MacroLine) => (l.kind === 'type' ? db.value.types.find(t => t.id === l.id)?.name : db.value.items.find(i => i.id === l.id)?.name) || `${l.id} (már nem létezik)`
const unit = (id: string) => db.value.items.find(i => i.id === id)?.unit || ''
const bound = (id: string) => !!db.value.types.find(t => t.id === id)?.toothBound
function add(kind: 'type' | 'mat') {
  const id = kind === 'type' ? addType.value : addMat.value; if (!id) return
  if (!lines.value.some(l => l.kind === kind && l.id === id)) lines.value.push({ kind, id, qty: kind === 'mat' ? 1 : undefined, on: true })
  addType.value = ''; addMat.value = ''
}
async function dictateName() {
  if (voice.recording) { voice.stop(); return }
  name.value = ''
  await voice.start({ get: () => name.value, set: v => { name.value = v.replace(/[.!?]+$/g, '').trim().toLowerCase() } }, { prompt: () => '' })
}
onBeforeUnmount(() => { if (voice.recording) voice.stop() })
function save() {
  msg.value = ''
  const nm = name.value.trim()
  const ctx = { types: db.value.types, items: db.value.items }
  const err = nameConflict(nm, ctx, dict.s.macros, ed?.id); if (err) { msg.value = err; return }
  const al = aliases.value.split(',').map(x => x.trim()).filter(Boolean)
  for (const a of al) { const e = nameConflict(a, ctx, dict.s.macros, ed?.id); if (e) { msg.value = `„${a}”: ${e}`; return } }
  const ls = lines.value.filter(l => l.on).map(({ on: _on, ...l }) => l)
  if (!ls.length) { msg.value = 'Jelölj ki legalább egy tételt vagy anyagot.'; return }
  if (ed) { Object.assign(ed, { name: nm, aliases: al, lines: ls }); dict.s.learnQueue.push({ kind: 'macro', data: JSON.parse(JSON.stringify(ed)) }) }
  else {
    const m: Macro = { id: 'm' + uid(), name: nm, aliases: al, lines: ls, active: true, uses: 0, lastUsed: '', created: new Date().toISOString(), mods: {} }
    dict.s.macros.push(m); dict.s.learnQueue.push({ kind: 'macro', data: JSON.parse(JSON.stringify(m)) })
    if (props.preset?.sig) dict.s.dismissedCombos.push(props.preset.sig)
  }
  void dict.syncLearn()
  ui.toast(`Rövidítés mentve: „${nm}” – a következő diktálástól a név kimondásával előhívható`)
  ui.close()
}
</script>

<template>
  <ModalShell :title="ed ? 'Rövidítés szerkesztése' : 'Mentés rövidítésként'" wide>
    <div class="hint small">A rövidítés egy szóval előhívott tételcsoport: a nevét kimondva a diktálásban a tételek normál sorként jelennek meg, és szerkeszthetők. Ugyanabban a mondatban módosítható: „… a 36-osra”, „…, plusz két tampon”, „…, érzéstelenítés két ampulla”, „…, de polírozás nélkül”. A rövidítés személyes, és nem tartalmaz betegadatot.</div>
    <div class="field"><label class="f">Név (amit kimondasz)</label>
      <div class="row"><input v-model="name" class="inp" style="max-width:320px" placeholder="pl. szokásos kontroll" data-test="rovidites-nev">
        <button class="mic" :class="{ rec: voice.recording }" type="button" :disabled="voice.processing" @click="dictateName"><AppIcon :name="voice.recording ? 'stop' : 'mic'" :size="16" />{{ voice.recording ? 'Leállítás' : 'Név diktálása' }}</button></div></div>
    <div class="field"><label class="f">További elhangzó alakok <span class="n">(vesszővel, pl. „sima kontroll”)</span></label><input v-model="aliases" class="inp"></div>
    <label class="f">Tételek és anyagok</label>
    <div v-for="(l, i) in lines" :key="l.kind + l.id" class="row" style="padding:4px 0;border-bottom:1px solid var(--line)">
      <input v-model="l.on" type="checkbox" :aria-label="label(l)">
      <span class="badge" :class="l.kind === 'type' ? 'b-blue' : 'b-gray'">{{ l.kind === 'type' ? 'művelet' : 'anyag' }}</span>
      <b>{{ label(l) }}</b>
      <span v-if="l.kind === 'type' && bound(l.id)" class="small muted">fogszámot kér („Melyik fog?”, ha nem hangzik el)</span>
      <template v-if="l.kind === 'mat'"><input v-model.number="l.qty" class="inp" type="number" min="0" step="1" style="width:80px"> {{ unit(l.id) }}</template>
      <div class="spacer" /><button class="btn sm" type="button" @click="lines.splice(i, 1)">×</button>
    </div>
    <div class="row" style="margin-top:8px">
      <select v-model="addType" class="inp auto" @change="add('type')"><option value="">+ művelet a katalógusból…</option><option v-for="t in db.types" :key="t.id" :value="t.id">{{ t.name }}</option></select>
      <select v-model="addMat" class="inp auto" @change="add('mat')"><option value="">+ anyag a raktárlistából…</option><option v-for="it in db.items" :key="it.id" :value="it.id">{{ it.name }} ({{ it.unit }})</option></select>
    </div>
    <div v-if="msg" class="err" style="margin-top:8px">{{ msg }}</div>
    <template #foot>
      <button class="btn" @click="ui.close()">Mégse</button><div class="spacer" />
      <button class="btn pri" data-test="rovidites-mentes" @click="save">Rövidítés mentése</button>
    </template>
  </ModalShell>
</template>
