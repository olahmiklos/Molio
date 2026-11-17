<script setup lang="ts">
import type { Attachment } from '~/utils/types'
import { docTypeName } from '~/utils/defaults'
import { fmtDate, fmtSize } from '~/utils/dates'
const props = defineProps<{ a: Attachment; removable?: boolean }>()
const emit = defineEmits<{ open: []; remove: [] }>()
const files = useFiles()
const isImg = computed(() => (props.a.mime || '').startsWith('image/') && !/tiff?$/i.test(props.a.name))
const icon = computed(() => { const ext = (props.a.name.split('.').pop() || '').toLowerCase(); return props.a.type === 'scan3d' ? '🦷' : props.a.type === 'cbct' ? '🩻' : ext === 'pdf' ? '📄' : '📎' })
</script>

<template>
  <div class="att" :title="a.name" @click="emit('open')">
    <div class="att-th" :class="{ img: isImg }" :style="isImg && files.url(a.id) ? `background-image:url('${files.url(a.id)}')` : ''"><span v-if="!isImg">{{ icon }}</span></div>
    <div class="att-b">
      <span class="badge b-blue">{{ docTypeName(a.type) }}</span>
      <div class="att-n">{{ a.name }}</div>
      <div class="small muted">{{ fmtDate(a.date) }} · {{ fmtSize(a.size) }}<template v-if="a.note"> · {{ a.note }}</template></div>
    </div>
    <button v-if="removable" class="x" title="Törlés" @click.stop="emit('remove')">×</button>
  </div>
</template>
