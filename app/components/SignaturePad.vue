<script setup lang="ts">
// Aláírásmező ujjal, Apple Pencillel vagy egérrel (pointer események)
const emit = defineEmits<{ change: [empty: boolean] }>()
const cv = ref<HTMLCanvasElement | null>(null)
const empty = ref(true)
let drawing = false, last: { x: number; y: number } | null = null
const W = 900, H = 260
function pos(e: PointerEvent) { const r = cv.value!.getBoundingClientRect(); return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) } }
function down(e: PointerEvent) { drawing = true; last = pos(e); cv.value!.setPointerCapture(e.pointerId); dot(last, e.pressure) }
function move(e: PointerEvent) {
  if (!drawing || !last) return
  const p = pos(e), x = cv.value!.getContext('2d')!
  x.lineWidth = 2.2 + (e.pointerType === 'pen' ? (e.pressure || 0.5) * 3 : 1.6)
  x.beginPath(); x.moveTo(last.x, last.y); x.lineTo(p.x, p.y); x.stroke(); last = p
  if (empty.value) { empty.value = false; emit('change', false) }
}
function dot(p: { x: number; y: number }, pr: number) { const x = cv.value!.getContext('2d')!; x.beginPath(); x.arc(p.x, p.y, 1.4 + (pr || 0.5), 0, Math.PI * 2); x.fill() }
function up() { drawing = false; last = null }
function clear() {
  const x = cv.value!.getContext('2d')!
  x.clearRect(0, 0, W, H); empty.value = true; emit('change', true)
}
onMounted(() => { const x = cv.value!.getContext('2d')!; x.strokeStyle = '#0f2a4a'; x.fillStyle = '#0f2a4a'; x.lineCap = 'round'; x.lineJoin = 'round' })
defineExpose({ canvas: cv, clear, isEmpty: () => empty.value })
</script>

<template>
  <div class="sigwrap">
    <canvas ref="cv" :width="W" :height="H" class="sig" @pointerdown.prevent="down" @pointermove.prevent="move" @pointerup="up" @pointercancel="up" @pointerleave="up" />
    <div class="sigline"><span>Aláírás</span><button class="btn sm" type="button" @click="clear">Törlés</button></div>
  </div>
</template>

<style scoped>
.sigwrap { border: 2px dashed #b9c6d0; border-radius: 12px; background: #fbfdff; padding: 6px 10px 8px }
.sig { width: 100%; height: auto; aspect-ratio: 900 / 260; touch-action: none; display: block; cursor: crosshair }
.sigline { display: flex; align-items: center; justify-content: space-between; border-top: 1.5px solid #64748b; padding-top: 6px; color: var(--muted); font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase }
</style>
