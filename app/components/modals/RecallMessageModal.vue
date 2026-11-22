<script setup lang="ts">
// Kontroll-üzenet küldése (spec v2.1, 8. pont): sablon választás, csatorna (e-mail / SMS), szerkeszthető szöveg. A demóban a küldés szimulált.
import { useDataStore } from '~/stores/data'
import { useOfficeStore } from '~/stores/office'
import { useUiStore } from '~/stores/ui'
import { fmtDate } from '~/utils/dates'
import { recallText } from '~/utils/office'

const props = defineProps<{ patientId: string; typeId: string }>()
const data = useDataStore()
const office = useOfficeStore()
const ui = useUiStore()
const db = computed(() => data.db)
const row = computed(() => office.recalls.find(r => r.patient.id === props.patientId && r.typeId === props.typeId))
const tpls = computed(() => db.value.settings.recallTemplates)
const tplId = ref(tpls.value[0]?.id || '')
const text = ref('')
const edited = ref(false)
watch([tplId, row], () => { if (row.value && !edited.value) text.value = recallText(db.value, row.value, tplId.value) }, { immediate: true })
const p = computed(() => row.value?.patient)
const useMail = ref(!!p.value?.email), useSms = ref(!!p.value?.phone)
const chans = computed(() => [useSms.value && 'SMS', useMail.value && 'e-mail'].filter(Boolean) as string[])
function send() {
  if (!row.value || !chans.value.length) return
  office.invite(props.patientId, props.typeId, chans.value)
  ui.close(); ui.toast(`Üzenet elküldve (szimulált, ${chans.value.join(' + ')}): ${row.value.patient.name}`)
}
</script>

<template>
  <ModalShell v-if="row && p" :title="`Kontroll-üzenet – ${p.name}`" wide>
    <div class="kv">
      <div>Legutóbbi kezelés</div><div><b>{{ fmtDate(row.last) }}</b> · {{ row.typeName }}</div>
      <div>Felülvizsgálat esedékes</div><div><b>{{ fmtDate(row.due) }}</b></div>
      <div>Elérhetőség</div><div>{{ p.phone || 'nincs telefonszám' }} · {{ p.email || 'nincs e-mail-cím' }}</div>
    </div>
    <div v-if="row.noContact" class="err">Nincs elérhetőség (sem e-mail, sem telefon), ezért az üzenet nem küldhető. Rögzítsd az adatot a páciens kartonján.</div>
    <div class="field" style="margin-top:12px">
      <label class="f">Üzenetsablon <span class="n">(a Beállításokban szerkeszthető)</span></label>
      <select v-model="tplId" class="inp" @change="edited = false"><option v-for="t in tpls" :key="t.id" :value="t.id">{{ t.name }}</option></select>
    </div>
    <div class="field">
      <label class="f">Csatorna</label>
      <ChannelPicker v-model:sms="useSms" v-model:email="useMail" :phone="p.phone" :mail="p.email" />
    </div>
    <div class="field"><label class="f">Üzenet szövege <span class="n">(küldés előtt javítható)</span></label><textarea v-model="text" class="inp" rows="5" @input="edited = true" /></div>
    <div class="hint">Demó: az üzenet ténylegesen nem megy ki, csak a kiküldés ténye és időpontja rögzül a listán.</div>
    <template #foot>
      <div class="spacer" />
      <button class="btn" @click="ui.close()">Mégse</button>
      <button class="btn pri" :disabled="row.noContact || !chans.length" :title="chans.length ? '' : 'Válasszon csatornát'" @click="send">Küldés (demó)</button>
    </template>
  </ModalShell>
</template>
