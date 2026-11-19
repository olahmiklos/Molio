<script setup lang="ts">
// Időpontok összevonása és tételek áthelyezése a páciens másik időpontjára (spec v2.2, 2. pont)
import { useDataStore } from '~/stores/data'
import { useAppointmentStore } from '~/stores/appointment'
import { useUiStore } from '~/stores/ui'
import { fmtDate } from '~/utils/dates'
import { doctorName, typeById } from '~/utils/logic'
import { patientFuture } from '~/utils/v22'

const props = defineProps<{ id: string; mode: 'merge' | 'move' }>()
const data = useDataStore()
const ap = useAppointmentStore()
const ui = useUiStore()
const db = computed(() => data.db)
const a = computed(() => ap.byId(props.id))
const others = computed(() => (a.value ? patientFuture(db.value, a.value.patientId, a.value.id) : []))
const other = ref(others.value[0]?.id || '')
const o = computed(() => ap.byId(other.value))
const picked = ref<number[]>([])
/** összevonásnál ez az időpont marad meg; ha az orvos eltér, a felhasználó dönti el, ki marad */
const keepDoc = ref(a.value?.doctorId || '')
const diffDoc = computed(() => !!a.value && !!o.value && a.value.doctorId !== o.value.doctorId)
const tn = (id: string) => typeById(db.value, id)?.name || id
function toggle(i: number) { picked.value = picked.value.includes(i) ? picked.value.filter(x => x !== i) : [...picked.value, i] }
function go() {
  if (!a.value || !o.value) return
  if (props.mode === 'merge') {
    ap.merge(a.value.id, o.value.id, diffDoc.value ? keepDoc.value : a.value.doctorId, 'asszisztens')
    ui.toast('Időpontok összevonva: ' + fmtDate(a.value.date) + ' ' + a.value.start)
  } else {
    if (!picked.value.length) { ui.toast('Jelölj ki legalább egy tételt'); return }
    ap.moveItems(a.value.id, o.value.id, picked.value)
    ui.toast(`${picked.value.length} tétel áthelyezve: ${fmtDate(o.value.date)} ${o.value.start}`)
  }
  ui.close(); ui.close()
}
</script>

<template>
  <ModalShell v-if="a" :title="mode === 'merge' ? 'Időpontok összevonása' : 'Tételek áthelyezése'">
    <div v-if="!others.length" class="warn">A páciensnek nincs másik jövőbeli időpontja.</div>
    <template v-else>
      <div v-if="mode === 'move'" class="field">
        <label class="f">Áthelyezendő tételek ({{ fmtDate(a.date) }} {{ a.start }})</label>
        <label v-for="(i, k) in a.items || []" :key="k" class="row" style="padding:3px 0"><input type="checkbox" :checked="picked.includes(k)" @change="toggle(k)">{{ i.tooth ? i.tooth + ' – ' : '' }}{{ tn(i.typeId) }}</label>
        <div v-if="!(a.items || []).length" class="muted small">Ennél az időpontnál nincsenek külön tételek.</div>
      </div>
      <div class="field">
        <label class="f">{{ mode === 'merge' ? 'Összevonás ezzel az időponttal' : 'Cél időpont' }}</label>
        <select v-model="other" class="inp"><option v-for="t in others" :key="t.id" :value="t.id">{{ fmtDate(t.date) }} {{ t.start }} · {{ doctorName(db, t.doctorId) }}</option></select>
        <div class="small muted" style="margin-top:4px">Egy időponthoz egy orvos tartozik: a tételek az időpont orvosához kerülnek.</div>
      </div>
      <div v-if="mode === 'merge' && diffDoc" class="warn">
        <b>A két időpont orvosa eltér.</b> Ki maradjon az összevont időpont orvosa?
        <select v-model="keepDoc" class="inp auto" style="margin-left:6px"><option :value="a.doctorId">{{ doctorName(db, a.doctorId) }}</option><option :value="o!.doctorId">{{ doctorName(db, o!.doctorId) }}</option></select>
      </div>
      <div v-if="mode === 'merge'" class="hint">Az összevont időpont a jelenlegi ({{ fmtDate(a.date) }} {{ a.start }}) lesz; a másik „összevonva” állapotban 30 napig visszaállítható marad.</div>
    </template>
    <template #foot>
      <button class="btn" @click="ui.close()">Mégse</button><div class="spacer" />
      <button class="btn pri" :disabled="!others.length" @click="go">{{ mode === 'merge' ? 'Összevonás' : 'Áthelyezés' }}</button>
    </template>
  </ModalShell>
</template>
