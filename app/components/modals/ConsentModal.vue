<script setup lang="ts">
// Digitális beleegyező nyilatkozat: a kezelésből előkészített szöveg, aláírás tableten, PDF a kartonba
import { useDataStore } from '~/stores/data'
import { useOfficeStore } from '~/stores/office'
import { useUiStore } from '~/stores/ui'
import { today } from '~/utils/dates'
import { consentFor, CONSENT_TPL } from '~/utils/office'
import { doctorName } from '~/utils/logic'
import { consentFileName, consentPdf } from '~/utils/consentPdf'
import SignaturePad from '~/components/SignaturePad.vue'
const props = defineProps<{ patientId: string; sessKey?: string | null; recordId?: string | null; typeIds: string[]; teeth: number[]; doctorId: string }>()
const data = useDataStore()
const office = useOfficeStore()
const ui = useUiStore()
const db = computed(() => data.db)
const p = computed(() => db.value.patients.find(x => x.id === props.patientId)!)
const base = consentFor(db.value, props.typeIds, props.teeth)
const tplKey = ref(base.key)
const title = ref(base.title)
const text = ref(base.text)
const doctorId = ref(props.doctorId)
watch(tplKey, k => {
  const t = CONSENT_TPL[k]; if (!t) return
  const c = consentFor({ ...db.value, types: db.value.types.map(x => (props.typeIds.includes(x.id) ? { ...x, consent: k } : x)) }, props.typeIds, props.teeth)
  title.value = t.title; text.value = c.text
})
const step = ref<'read' | 'sign'>('read')
const understood = ref(false)
const pad = ref<InstanceType<typeof SignaturePad> | null>(null)
const signed = ref(false)
const busy = ref(false)
async function save() {
  if (!pad.value || pad.value.isEmpty()) { ui.toast('Az aláírás hiányzik'); return }
  busy.value = true
  try {
    if (document.fonts?.ready) await document.fonts.ready
    const blob = consentPdf(db.value, { patientId: props.patientId, title: title.value, text: text.value, doctor: doctorName(db.value, doctorId.value), signedAt: new Date() }, pad.value.canvas!)
    const r = await office.saveConsent({ patientId: props.patientId, recordId: props.recordId || null, sessKey: props.recordId ? null : (props.sessKey || null), typeIds: [...props.typeIds], teeth: [...props.teeth], title: title.value, text: text.value, doctorId: doctorId.value }, blob, consentFileName(p.value.name, today()))
    ui.close(); ui.toast(r.memOnly ? 'Nyilatkozat aláírva – ez a böngésző csak bezárásig őrzi meg a PDF-et' : 'Nyilatkozat aláírva, a PDF a csatolmányok közé került')
  } finally { busy.value = false }
}
</script>

<template>
  <ModalShell :title="title" wide>
    <template v-if="step === 'read'">
      <div class="row" style="margin-bottom:10px">
        <select v-model="tplKey" class="inp auto"><option v-for="(t, k) in CONSENT_TPL" :key="k" :value="k">{{ t.title }}</option></select>
        <select v-model="doctorId" class="inp auto"><option v-for="d in db.doctors" :key="d.id" :value="d.id">Tájékoztatott: {{ d.name }}</option></select>
      </div>
      <div class="hint" style="margin-top:0">A szöveget a program a kezelésből készítette elő; aláírás előtt az orvos módosíthatja. <b>Demó: mintaszöveg</b> – éles használat előtt szakmai és jogi ellenőrzés szükséges.</div>
      <textarea v-model="text" class="inp consent" rows="14" />
      <p class="small muted" style="margin:6px 0 0">Ezután add át a tabletet a páciensnek: a következő lépésben nagy betűvel olvassa el, és ujjal vagy tollal aláírja.</p>
    </template>
    <template v-else>
      <div class="consent-read">
        <div class="small muted" style="font-weight:700;letter-spacing:.08em;text-transform:uppercase">{{ p.name }}</div>
        <div style="white-space:pre-line">{{ text }}</div>
      </div>
      <label class="switch" :class="{ on: understood }" style="margin:12px 0" @click.prevent="understood = !understood"><i />A tájékoztatást elolvastam és megértettem.</label>
      <SignaturePad v-if="understood" ref="pad" @change="signed = !$event" />
    </template>
    <template #foot>
      <button class="btn" @click="step === 'sign' ? (step = 'read') : ui.close()">{{ step === 'sign' ? '‹ Vissza' : 'Mégse' }}</button>
      <div class="spacer" />
      <button v-if="step === 'read'" class="btn pri" @click="step = 'sign'">Átadom aláírásra ›</button>
      <button v-else class="btn go" :disabled="!understood || !signed || busy" @click="save"><AppIcon name="check" :size="16" />Aláírás mentése</button>
    </template>
  </ModalShell>
</template>

<style scoped>
.consent { font-size: 14px; line-height: 1.55 }
.consent-read { background: #fff; border: 1px solid var(--line); border-radius: 10px; padding: 16px 18px; font-size: 17px; line-height: 1.6; max-height: 46vh; overflow: auto }
</style>
