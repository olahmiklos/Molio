<script setup lang="ts">
// Javasolt további kezelés követése (12. pont): üzenet, megkeresés rögzítése, halasztás, „nem kér”, időpontfoglalás, „elvetve” (csak orvos)
import { useDataStore } from '~/stores/data'
import { useSuggestionStore } from '~/stores/suggestion'
import { useUiStore } from '~/stores/ui'
import { addDays, fmtDate, today } from '~/utils/dates'
import { doctorName } from '~/utils/logic'
import { fillSuggest, SUG_STATUS, URGENCY } from '~/utils/suggest'
import BookingModal from './BookingModal.vue'

const props = defineProps<{ id: string }>()
const data = useDataStore()
const sugs = useSuggestionStore()
const ui = useUiStore()
const db = computed(() => data.db)
const g = computed(() => sugs.byId(props.id))
const p = computed(() => db.value.patients.find(x => x.id === g.value?.patientId))
const t = computed(() => db.value.types.find(x => x.id === g.value?.typeId))
const text = computed(() => (g.value ? fillSuggest(db.value, g.value) : ''))
const note = ref('')
const channel = ref('telefon')
const remind = ref(addDays(today(), 14))
const dropDoc = ref(db.value.doctors[0]?.id || '')
const noContact = computed(() => !p.value?.phone && !p.value?.email)
function log() { if (!g.value) return; sugs.contact(g.value.id, { channel: channel.value, note: note.value.trim() || 'megkeresve' }); note.value = ''; ui.toast('Megkeresés rögzítve') }
function sendMsg() { if (!g.value) return; sugs.contact(g.value.id, { channel: 'SMS/e-mail (szimulált)', note: 'üzenet kiküldve' }); ui.toast('Üzenet elküldve (szimulált)') }
function book() { ui.close(); ui.open(BookingModal, { suggestionIds: [props.id] }) }
function postpone() { if (!g.value) return; sugs.postpone(g.value.id, remind.value, note.value.trim()); ui.close(); ui.toast('Elhalasztva: ' + fmtDate(remind.value)) }
function decline() { if (!g.value) return; sugs.decline(g.value.id, note.value.trim() || 'a páciens nem kéri'); ui.close(); ui.toast('Lezárva: a páciens nem kéri') }
async function drop() {
  if (!g.value) return
  const nm = doctorName(db.value, dropDoc.value)
  if (!(await ui.confirm(`Az „elvetve” jelölést csak az orvos állíthatja be. Megerősíted: <b>${nm}</b> elveti ezt a javaslatot?`, 'Elvetve', true))) return
  sugs.drop(g.value.id, nm); ui.close(); ui.toast('Elvetve (' + nm + ')')
}
</script>

<template>
  <ModalShell v-if="g && p" :title="`Javasolt kezelés – ${p.name}`" wide>
    <div class="kv">
      <div>Kezelés</div><div><b>{{ t?.name }}</b>{{ g.tooth ? ` · ${g.tooth}-es fog` : '' }}{{ g.surfaces.length ? ` (${g.surfaces.join('')})` : '' }}</div>
      <div>Sürgősség</div><div><span class="badge" :class="URGENCY[g.urgency].cls">{{ URGENCY[g.urgency].label }}</span> <span v-if="g.due" class="muted">· javasolt határidő: {{ fmtDate(g.due) }}</span></div>
      <div>Állapot</div><div><span class="badge" :class="SUG_STATUS[g.status].cls">{{ SUG_STATUS[g.status].label }}</span><span v-if="g.remindAt" class="muted"> · újra jelez: {{ fmtDate(g.remindAt) }}</span><span v-if="g.droppedBy" class="muted"> · elvetette: {{ g.droppedBy }}</span></div>
      <template v-if="g.note"><div>Megjegyzés</div><div>{{ g.note }}</div></template>
      <div>Elérhetőség</div><div>{{ p.phone || '–' }} · {{ p.email || 'nincs e-mail-cím' }}</div>
    </div>
    <div v-if="g.contacts.length" class="small" style="margin:8px 0"><b>Megkeresések:</b>
      <div v-for="(c, i) in g.contacts" :key="i">{{ fmtDate(c.date) }} · {{ c.channel }} · {{ c.note }}</div>
    </div>
    <div class="sms" style="white-space:normal;margin:10px 0">{{ text }}</div>
    <div class="field"><label class="f">Megjegyzés / hívás eredménye</label><input v-model="note" class="inp" placeholder="pl. nem vette fel, visszahívást kért"></div>
    <div class="row">
      <select v-model="channel" class="inp auto"><option>telefon</option><option>SMS</option><option>e-mail</option><option>személyesen</option></select>
      <button class="btn sm" @click="log">Megkeresés rögzítése</button>
      <button class="btn sm" :disabled="noContact" @click="sendMsg">Üzenet küldése (demó)</button>
      <button class="btn sm" :class="{ pri: g.callback }" @click="sugs.toggleCallback(g.id)">{{ g.callback ? '✓ Visszahívást kért' : 'Visszahívást kért' }}</button>
    </div>
    <div class="row" style="margin-top:10px"><span class="small muted">Újra jelez ekkor:</span><input v-model="remind" type="date" class="inp auto" :min="today()"><button class="btn sm" @click="postpone">Elhalasztás</button><button class="btn sm" @click="decline">Nem kéri</button></div>
    <div class="row" style="margin-top:10px"><span class="small muted">Elvetés (csak orvos):</span><select v-model="dropDoc" class="inp auto"><option v-for="d in db.doctors" :key="d.id" :value="d.id">{{ d.name }}</option></select><button class="btn sm danger" @click="drop">Elvetve</button></div>
    <template #foot>
      <button v-if="['declined', 'dropped', 'postponed'].includes(g.status)" class="btn" @click="sugs.reopen(g.id); ui.toast('Újra nyitva')">Újranyitás</button>
      <div class="spacer" /><button class="btn" @click="ui.close()">Bezárás</button>
      <button v-if="g.status !== 'booked' && g.status !== 'done'" class="btn go" @click="book">Időpont foglalása</button>
    </template>
  </ModalShell>
</template>
