<script setup lang="ts">
// „Nem szükséges” / „később” jelölés a kontroll-listán (8. pont)
import { useOfficeStore } from '~/stores/office'
import { useUiStore } from '~/stores/ui'
import { addDays, today } from '~/utils/dates'

const props = defineProps<{ patientId: string; typeId: string; last: string; name: string }>()
const office = useOfficeStore()
const ui = useUiStore()
const mode = ref<'later' | 'never'>('later')
const until = ref(addDays(today(), 30))
const reason = ref('')
function save() {
  office.snoozeRecall(props.patientId, props.typeId, props.last, mode.value === 'never' ? null : until.value, reason.value.trim())
  ui.close(); ui.toast(mode.value === 'never' ? 'Megjelölve: nem szükséges' : 'Elhalasztva a megadott napig')
}
</script>

<template>
  <ModalShell :title="`Kontroll elhalasztása – ${name}`">
    <div class="row" style="margin-bottom:10px">
      <label class="chip" :class="{ on: mode === 'later' }" @click.prevent="mode = 'later'">Később jelezzen újra</label>
      <label class="chip" :class="{ on: mode === 'never' }" @click.prevent="mode = 'never'">Nem szükséges</label>
    </div>
    <div v-if="mode === 'later'" class="field"><label class="f">Ekkor jelezzen újra</label><input v-model="until" type="date" class="inp" :min="today()"></div>
    <div class="field"><label class="f">Indok (nem kötelező)</label><input v-model="reason" class="inp" placeholder="pl. külföldön él, másik fogorvoshoz jár"></div>
    <div class="small muted">A „nem szükséges” jelölés csak erre az esedékességre vonatkozik: ha a páciens új kezelést kap, a következő kontroll újra megjelenik.</div>
    <template #foot><div class="spacer" /><button class="btn" @click="ui.close()">Mégse</button><button class="btn pri" @click="save">Mentés</button></template>
  </ModalShell>
</template>
