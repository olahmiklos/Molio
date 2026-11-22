<script setup lang="ts">
// Páciens-tájékoztató (spec v2.2, 8. pont): rögzített időponthoz kötött tájékoztató; időpont nélkül udvarias „egyeztessen időpontot” kézi üzenet
import { useDataStore } from '~/stores/data'
import { useSuggestionStore } from '~/stores/suggestion'
import { useUiStore } from '~/stores/ui'
import { fmtDate, uid } from '~/utils/dates'
import { INFORM_TPL } from '~/utils/defaults'
import { coordText, fillInform, informContext } from '~/utils/v22'
import { isPendingSuggestion } from '~/utils/suggest'

const props = defineProps<{ patientId: string; apptIds?: string[] }>()
const data = useDataStore()
const sugs = useSuggestionStore()
const ui = useUiStore()
const db = computed(() => data.db)
const p = computed(() => db.value.patients.find(x => x.id === props.patientId)!)
const ctx = computed(() => informContext(db.value, props.patientId, props.apptIds))
/** tájékoztató csak rögzített időponthoz tartozó javasolt tételről megy ki; időpont nélkül a kézi egyeztetés-kérő üzenet él */
const hasAppt = computed(() => ctx.value.appts.some(a => ctx.value.suggestions.some(s => s.appointmentId === a.id && s.status === 'booked')))
const initial = () => (hasAppt.value ? fillInform(db.value, db.value.settings.informTemplate || INFORM_TPL, ctx.value) : coordText(db.value, props.patientId))
const text = ref(initial())
const useSms = ref(!!p.value.phone), useMail = ref(!!p.value.email && !p.value.phone)
const channel = computed(() => [useSms.value && 'SMS', useMail.value && 'e-mail'].filter(Boolean).join(' + '))
const reason = ref('')
const unresolved = computed(() => /\{[^}]+\}/.test(text.value))
function send() {
  if (!channel.value) { ui.toast('Válasszon csatornát'); return }
  if (unresolved.value) { ui.toast('A szövegben kitöltetlen mező maradt – javítsd'); return }
  if (hasAppt.value) {
    db.value.informs.push({ id: uid(), patientId: p.value.id, appointmentIds: ctx.value.appts.map(a => a.id), at: new Date().toISOString(), kind: 'sent', channel: channel.value, text: text.value })
    ui.toast('Tájékoztató elküldve (szimulált – ténylegesen nem ment ki)')
  } else {
    db.value.suggestions.filter(s => s.patientId === p.value.id && isPendingSuggestion(s)).forEach(s => sugs.contact(s.id, { channel: channel.value + ' (szimulált)', note: 'egyeztetést kérő üzenet kiküldve' }))
    ui.toast('Üzenet elküldve (szimulált) – a megkeresés rögzítve')
  }
  ui.close()
}
function skip() {
  if (!reason.value.trim()) { ui.toast('Add meg, miért nem szükséges'); return }
  db.value.informs.push({ id: uid(), patientId: p.value.id, appointmentIds: ctx.value.appts.map(a => a.id), at: new Date().toISOString(), kind: 'skipped', channel: '', text: '', reason: reason.value.trim() })
  ui.toast('Rögzítve: a tájékoztató nem szükséges'); ui.close()
}
</script>

<template>
  <ModalShell :title="hasAppt ? `Tájékoztató – ${p.name}` : `Egyeztetést kérő üzenet – ${p.name}`" wide>
    <div v-if="hasAppt" class="hint">Rögzített időpont: <b v-for="a in ctx.appts" :key="a.id">{{ fmtDate(a.date) }} {{ a.start }}&nbsp; </b>– a tájékoztató a közérthető kezelésneveket és az időpontot tartalmazza; diagnózis, ár vagy egyéb egészségügyi adat nem kerül bele.</div>
    <div v-else class="hint">Nincs rögzített időpont, ezért tájékoztató nem küldhető. Kézzel indítható udvarias üzenet kéri a pácienst, hogy egyeztessen időpontot (szimulált küldés).</div>
    <div class="field"><label class="f">Üzenet <span class="n">(szerkeszthető küldés előtt)</span></label><textarea v-model="text" class="inp" rows="7" /></div>
    <div v-if="unresolved" class="warn">Kitöltetlen mező maradt a szövegben (kapcsos zárójel) – javítsd küldés előtt.</div>
    <div class="field"><label class="f">Csatorna</label><ChannelPicker v-model:sms="useSms" v-model:email="useMail" :phone="p.phone" :mail="p.email" /></div>
    <div v-if="hasAppt" class="row" style="margin-top:10px"><input v-model="reason" class="inp" style="max-width:340px" placeholder="Ha nem szükséges: ok (pl. személyesen megbeszélték)"><button class="btn sm" @click="skip">Nem szükséges</button></div>
    <template #foot>
      <button class="btn" @click="ui.close()">Mégse</button><div class="spacer" />
      <button class="btn pri" :disabled="!channel" :title="channel ? '' : 'Válasszon csatornát'" @click="send">{{ hasAppt ? 'Küldés (demó)' : 'Üzenet küldése (demó)' }}</button>
    </template>
  </ModalShell>
</template>
