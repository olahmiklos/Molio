<script setup lang="ts">
// Jövőbeli időpont törlése / lemondása (spec v2.2, 2. pont): kötelező ok, a tételek sorsa, 30 napos visszaállítás
import { useDataStore } from '~/stores/data'
import { useAppointmentStore } from '~/stores/appointment'
import { useUiStore } from '~/stores/ui'
import { esc, fmtDate, fmtLong } from '~/utils/dates'
import { doctorName, typeNames } from '~/utils/logic'
import { patientFuture, sugSourceText } from '~/utils/v22'
import { DELETE_RESTORE_DAYS } from '~/utils/v22'

const props = defineProps<{ id: string; kind: 'delete' | 'cancel' }>()
const data = useDataStore()
const ap = useAppointmentStore()
const ui = useUiStore()
const db = computed(() => data.db)
const a = computed(() => ap.byId(props.id))
const p = computed(() => db.value.patients.find(x => x.id === a.value?.patientId))
const REASONS = ['A páciens lemondta', 'A páciens kérésére áttesztük', 'Rendelői ok (orvos hiányzik, felszerelés)', 'Tévesen rögzített időpont', 'Más ok']
const reason = ref(props.kind === 'cancel' ? REASONS[0]! : REASONS[3]!)
const other = ref('')
const sugItems = computed(() => (a.value?.items || []).filter(i => i.suggestionId).map(i => db.value.suggestions.find(s => s.id === i.suggestionId)).filter((x): x is NonNullable<typeof x> => !!x))
const targets = computed(() => (a.value ? patientFuture(db.value, a.value.patientId, a.value.id) : []))
const fate = ref<'back' | 'move'>('back')
const target = ref('')
const msg = ref('')
const lateC = computed(() => !!a.value && props.kind === 'cancel' && ap.isLateCancel(a.value))
const label = computed(() => (props.kind === 'cancel' ? 'lemondása' : 'törlése'))
function go() {
  if (!a.value || !p.value) return
  const rs = reason.value === 'Más ok' ? other.value.trim() : reason.value
  if (!rs) { msg.value = 'Add meg az okot.'; return }
  if (fate.value === 'move' && sugItems.value.length && !target.value) { msg.value = 'Válaszd ki, melyik időpontra kerüljenek a tételek.'; return }
  const when = `${fmtDate(a.value.date)} ${a.value.start}`
  const d = ap.remove(props.id, { kind: props.kind, reason: rs, by: 'asszisztens', moveTo: fate.value === 'move' && sugItems.value.length ? target.value : null })
  ui.close(); ui.close()
  ui.toast(`Időpont ${props.kind === 'cancel' ? 'lemondva' : 'törölve'}: ${when}`, d ? { label: 'Visszavonás', fn: () => { const r = ap.restore(d.id); ui.toast(r.ok ? 'Időpont visszaállítva' : 'Nem állítható vissza: ' + r.why) } } : undefined)
}
</script>

<template>
  <ModalShell v-if="a && p" :title="`Időpont ${label}`">
    <p style="margin-top:0"><b>{{ p.name }}</b> · {{ fmtLong(a.date) }}, {{ a.start }} · {{ doctorName(db, a.doctorId) }} · {{ typeNames(db, a.typeIds) }}</p>
    <div class="hint">Az időpont nem tűnik el végleg: <b>törölt</b> állapotban {{ DELETE_RESTORE_DAYS }} napig megmarad a páciens kartonján, és visszaállítható.</div>
    <div v-if="lateC" class="warn">24 órán belüli lemondás: a program megjegyzi, és ez növeli a páciens következő időpontjainak meg nem jelenési kockázatát.</div>
    <div class="field">
      <label class="f">Ok *</label>
      <select v-model="reason" class="inp"><option v-for="r in REASONS" :key="r">{{ r }}</option></select>
      <input v-if="reason === 'Más ok'" v-model="other" class="inp" style="margin-top:6px" placeholder="Az ok rövid leírása">
    </div>
    <div v-if="sugItems.length" class="field">
      <label class="f">Mi legyen az időponthoz kötött javasolt kezelésekkel?</label>
      <div v-for="s in sugItems" :key="s.id" class="small" style="padding:2px 0">• <b>{{ db.types.find(t => t.id === s.typeId)?.name }}</b>{{ s.tooth ? ' · ' + s.tooth : '' }} <span class="muted">– {{ sugSourceText(db, s) }}</span></div>
      <label class="row" style="margin-top:6px"><input v-model="fate" type="radio" value="back"> Visszakerülnek a Teendők közé (időpontot kell egyeztetni)</label>
      <label class="row"><input v-model="fate" type="radio" value="move" :disabled="!targets.length"> Átkerülnek a páciens másik időpontjára <span v-if="!targets.length" class="small muted">(nincs másik jövőbeli időpontja)</span></label>
      <select v-if="fate === 'move'" v-model="target" class="inp" style="margin-top:6px"><option value="">– válassz időpontot –</option><option v-for="t in targets" :key="t.id" :value="t.id">{{ fmtDate(t.date) }} {{ t.start }} · {{ doctorName(db, t.doctorId) }} (a tételek az ő időpontjához kerülnek)</option></select>
    </div>
    <div v-if="msg" class="err">{{ esc(msg) }}</div>
    <template #foot>
      <button class="btn" @click="ui.close()">Mégse</button>
      <div class="spacer" />
      <button class="btn danger" @click="go">Időpont {{ label }}</button>
    </template>
  </ModalShell>
</template>
