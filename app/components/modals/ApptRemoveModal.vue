<script setup lang="ts">
// Jövőbeli időpont törlése / lemondása (spec v2.2, 2. pont; v2.4 11. pont, B-012): megerősítés (páciens, időpont, tételek), ok, a tételek sorsa
// (másik időpontba / vissza az egyeztetendők közé / törlés a tételekkel együtt), értesítés kérdése, 30 napos visszaállítás, „Visszavonás”
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
const fate = ref<'back' | 'move' | 'drop'>('back')
const allItems = computed(() => a.value?.items?.length ? a.value.items : (a.value?.typeIds || []).map(t => ({ tooth: null, typeId: t, surfaces: [] })))
const iName = (i: { tooth: number | null; typeId: string }) => (i.tooth ? i.tooth + ': ' : '') + (db.value.types.find(t => t.id === i.typeId)?.name || i.typeId)
const target = ref('')
const msg = ref('')
const lateC = computed(() => !!a.value && props.kind === 'cancel' && ap.isLateCancel(a.value))
const label = computed(() => (props.kind === 'cancel' ? 'lemondása' : 'törlése'))
async function go() {
  if (!a.value || !p.value) return
  const rs = reason.value === 'Más ok' ? other.value.trim() : reason.value
  if (!rs) { msg.value = 'Add meg az okot.'; return }
  if (fate.value === 'move' && allItems.value.length && !target.value) { msg.value = 'Válaszd ki, melyik időpontra kerüljenek a tételek.'; return }
  const when = `${fmtDate(a.value.date)} ${a.value.start}`
  // v2.4 11. pont 7.: ha a páciens már kapott értesítést, a program rákérdez (a demóban tényleges küldés nélkül)
  const notified = a.value.sentAt ? await ui.confirm('A páciens erről az időpontról már kapott értesítést. Küldjünk értesítést a ' + (props.kind === 'cancel' ? 'lemondásról' : 'törlésről') + '? <span class="small">(Demó: tényleges küldés nélkül.)</span>', 'Értesítés küldése', false, 'Nem') : false
  const d = ap.remove(props.id, { kind: props.kind, reason: rs, by: 'asszisztens', moveTo: fate.value === 'move' && allItems.value.length ? target.value : null, drop: fate.value === 'drop', notified })
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
    <div v-if="allItems.length" class="field">
      <label class="f">Mi legyen az időpont tételeivel?</label>
      <div v-for="(i, k) in allItems" :key="k" class="small" style="padding:2px 0">• <b>{{ iName(i) }}</b></div>
      <div v-for="s in sugItems" :key="s.id" class="small muted" style="padding:2px 0 2px 12px">↳ {{ db.types.find(t => t.id === s.typeId)?.name }}: {{ sugSourceText(db, s) }}</div>
      <label class="row" style="margin-top:6px"><input v-model="fate" type="radio" value="back"> Vissza „javasolt – még nincs időpont” állapotba (Teendők → Egyeztetendő kezelések)</label>
      <label class="row"><input v-model="fate" type="radio" value="move" :disabled="!targets.length"> Átkerülnek a páciens másik jövőbeli időpontjára <span v-if="!targets.length" class="small muted">(nincs másik jövőbeli időpontja)</span></label>
      <label class="row"><input v-model="fate" type="radio" value="drop"> Törlés a tételekkel együtt</label>
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
