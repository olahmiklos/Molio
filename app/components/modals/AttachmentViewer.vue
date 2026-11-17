<script setup lang="ts">
import { useDataStore } from '~/stores/data'
import { useUiStore } from '~/stores/ui'
import { docTypeName } from '~/utils/defaults'
import { fmtDate, fmtSize } from '~/utils/dates'
const props = defineProps<{ id: string }>()
const data = useDataStore()
const ui = useUiStore()
const files = useFiles()
const a = computed(() => data.db.attachments.find(x => x.id === props.id)!)
const p = computed(() => data.db.patients.find(x => x.id === a.value.patientId))
const url = ref<string | null>(null)
const missing = ref(false)
onMounted(async () => { url.value = await files.urlOf(props.id); missing.value = !url.value })
const isImg = computed(() => (a.value.mime || '').startsWith('image/') && !/tiff?$/i.test(a.value.name))
const isPdf = computed(() => /\.pdf$/i.test(a.value.name) || a.value.mime === 'application/pdf')
</script>

<template>
  <ModalShell :title="docTypeName(a.type)" wide>
    <div class="small muted" style="margin-bottom:10px">{{ p?.name }} · {{ a.name }} · {{ fmtDate(a.date) }} · {{ fmtSize(a.size) }}<template v-if="a.note"> · {{ a.note }}</template></div>
    <div v-if="missing" class="warn">A fájl nem érhető el ebben a böngészőben.</div>
    <template v-else-if="url">
      <img v-if="isImg" :src="url" style="max-width:100%;max-height:70vh;display:block;margin:0 auto;border-radius:6px;background:#111">
      <iframe v-else-if="isPdf" :src="url" style="width:100%;height:70vh;border:1px solid var(--line);border-radius:6px" />
      <div v-else class="hint">Ezt a fájltípust ({{ (a.name.split('.').pop() || '').toUpperCase() }}) a böngésző nem tudja megjeleníteni. Töltsd le, és nyisd meg a megfelelő programmal{{ a.type === 'scan3d' ? ' (pl. 3D-megjelenítővel)' : a.type === 'cbct' ? ' (DICOM-megjelenítővel)' : '' }}.</div>
    </template>
    <template #foot>
      <a v-if="url" class="btn" :href="url" :download="a.name"><AppIcon name="download" :size="16" />Letöltés</a>
      <button class="btn pri" @click="ui.close()">Bezárás</button>
    </template>
  </ModalShell>
</template>
