<script setup lang="ts">
// Ívelt, röntgenszerű fogtérkép: valósághű fogforma (korona és gyökér), korábbi kezelések színjelöléssel,
// kezelt felszínek kiemelése, fogankénti előzmény egérrel (érintőképernyőn hosszú nyomásra) – spec 2.2.5
import type { Dentition, Surface, SurfaceMap } from '~/utils/types'
import type { ToothView } from '~/stores/dentalChart'
import { CHART_H, CHART_W, chartGeometry, type ToothGeo } from '~/utils/toothShapes'
import { STATUS_STYLE } from '~/utils/defaults'
import { fmtDate } from '~/utils/dates'
import { surfaceCode, toothLabel } from '~/utils/teeth'

const props = defineProps<{
  dentition: Dentition
  model: Record<number, ToothView>
  selected?: number[]
  focus?: number | null
  current?: SurfaceMap
  draft?: Record<string, string[]> | null
  flags?: Record<string, string>
  /** tétel-jelölés: tervezett (kék), kezelés közben hozzáadott (borostyán), elhalasztott (szürke) */
  marks?: Record<number, 'planned' | 'added' | 'postponed'>
  hl?: number | null
  clickable?: boolean
}>()
const emit = defineEmits<{ tooth: [n: number]; hover: [n: number | null] }>()
const uid = useId()
const geo = computed(() => chartGeometry(props.dentition))
const sel = computed(() => new Set(props.selected || []))
const wrap = ref<HTMLElement | null>(null)
const tip = ref<{ n: number; x: number; y: number } | null>(null)

const zone = (g: ToothGeo, s: Surface) => {
  const { w, ch } = g
  const side = (right: boolean) => (right ? { x: w * 0.18, y: -ch - 2, width: w * 0.4, height: ch + 6 } : { x: -w * 0.58, y: -ch - 2, width: w * 0.4, height: ch + 6 })
  if (s === 'O') return { x: -w, y: -ch * 0.3, width: w * 2, height: ch * 0.3 + 6 }
  if (s === 'M') return side(g.mesialRight)
  if (s === 'D') return side(!g.mesialRight)
  return { cx: 0, cy: -ch * 0.55, rx: w * 0.19, ry: ch * 0.2 }
}
const isRect = (s: string) => s === 'O' || s === 'M' || s === 'D'
const tf = (g: ToothGeo) => `translate(${g.x.toFixed(1)} ${g.y.toFixed(1)}) rotate(${g.angle.toFixed(2)})${g.upper ? '' : ' scale(1 -1)'}`
const view = (n: number) => props.model[n]
const draftOf = (n: number) => props.draft?.[n]

// tooltip: egérrel fölé víve, érintőképernyőn hosszú nyomásra
let pressTimer: ReturnType<typeof setTimeout> | null = null
let longPressed = false
function place(n: number, e: PointerEvent) {
  const r = wrap.value?.getBoundingClientRect(); if (!r) return
  const x = Math.min(Math.max(8, e.clientX - r.left + 14), r.width - 240)
  const y = e.clientY - r.top + 14 > r.height - 150 ? e.clientY - r.top - 170 : e.clientY - r.top + 14
  tip.value = { n, x, y: Math.max(6, y) }
}
function enter(n: number, e: PointerEvent) { if (e.pointerType === 'mouse') { place(n, e); emit('hover', n) } }
function move(n: number, e: PointerEvent) { if (e.pointerType === 'mouse') place(n, e) }
function leave(e: PointerEvent) { if (e.pointerType === 'mouse') { tip.value = null; emit('hover', null) } }
function down(n: number, e: PointerEvent) {
  longPressed = false
  if (e.pointerType === 'mouse') return
  tip.value = null
  if (pressTimer) clearTimeout(pressTimer)
  pressTimer = setTimeout(() => { longPressed = true; place(n, e) }, 480)
}
function up() { if (pressTimer) clearTimeout(pressTimer) }
function click(n: number) {
  if (longPressed) { longPressed = false; return }
  if (props.clickable) emit('tooth', n)
}
function outside() { if (tip.value && !longPressed) tip.value = null }
const tipView = computed(() => (tip.value ? view(tip.value.n) : null))
const statusLabels = (st: string[]) => st.filter(s => s !== 'ep').map(s => STATUS_STYLE[s]?.label || s)
</script>

<template>
  <div ref="wrap" class="xchart" :class="{ clickable }" @pointerdown.self="outside" @contextmenu.prevent>
    <svg :viewBox="`0 0 ${CHART_W} ${CHART_H}`" role="img" :aria-label="`Fogtérkép, ${dentition === 'primary' ? 'tejfogazat' : 'maradó fogazat'}`">
      <defs>
        <linearGradient :id="`${uid}en`" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#f7fafc" /><stop offset=".7" stop-color="#dfe7ee" /><stop offset="1" stop-color="#c9d4de" /></linearGradient>
        <linearGradient :id="`${uid}rt`" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#b9c4cf" /><stop offset="1" stop-color="#7c8a99" /></linearGradient>
        <linearGradient :id="`${uid}au`" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#ffe08a" /><stop offset=".5" stop-color="#f5b31f" /><stop offset="1" stop-color="#c98a07" /></linearGradient>
        <linearGradient :id="`${uid}im`" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8fe3dc" /><stop offset=".5" stop-color="#e8fffd" /><stop offset="1" stop-color="#13b0a5" /></linearGradient>
        <filter :id="`${uid}glow`" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5" /></filter>
        <filter :id="`${uid}soft`" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="0.6" /></filter>
        <filter :id="`${uid}bone`" x="-10%" y="-50%" width="120%" height="200%"><feGaussianBlur stdDeviation="22" /></filter>
        <clipPath v-for="g in geo" :id="`${uid}c${g.n}`" :key="'c' + g.n"><path :d="g.crown" /></clipPath>
      </defs>

      <!-- csont: halvány derengés a gyökerek körül -->
      <g :filter="`url(#${uid}bone)`" opacity=".55">
        <path :d="`M ${geo[0]!.x - 30} ${geo[0]!.y - 90} ${geo.filter(g => g.upper).map(g => `L ${g.x} ${g.y - g.ch - g.rl * 0.55}`).join(' ')}`" stroke="#5f7186" stroke-width="95" fill="none" stroke-linecap="round" />
        <path :d="`M ${geo.filter(g => !g.upper)[0]!.x - 30} ${geo.filter(g => !g.upper)[0]!.y + 90} ${geo.filter(g => !g.upper).map(g => `L ${g.x} ${g.y + g.ch + g.rl * 0.55}`).join(' ')}`" stroke="#5f7186" stroke-width="100" fill="none" stroke-linecap="round" />
      </g>
      <line :x1="CHART_W / 2" y1="70" :x2="CHART_W / 2" :y2="CHART_H - 50" stroke="#ffffff" stroke-opacity=".08" stroke-dasharray="4 6" />
      <text x="28" y="34" fill="#9fb1c4" font-size="15" font-weight="700" letter-spacing="2">JOBB</text>
      <text :x="CHART_W - 28" y="34" fill="#9fb1c4" font-size="15" font-weight="700" letter-spacing="2" text-anchor="end">BAL</text>
      <text :x="CHART_W / 2" y="30" fill="#9fb1c4" font-size="13" font-weight="600" text-anchor="middle" letter-spacing="1.5">FELSŐ ÁLLCSONT</text>
      <text :x="CHART_W / 2" :y="CHART_H - 14" fill="#9fb1c4" font-size="13" font-weight="600" text-anchor="middle" letter-spacing="1.5">ALSÓ ÁLLCSONT</text>

      <g v-for="g in geo" :key="g.n" class="tooth" @pointerenter="enter(g.n, $event)" @pointermove="move(g.n, $event)" @pointerleave="leave"
        @pointerdown="down(g.n, $event)" @pointerup="up" @pointercancel="up" @click="click(g.n)">
        <g :transform="tf(g)">
          <!-- kijelölés: ragyogás -->
          <g v-if="sel.has(g.n)" :filter="`url(#${uid}glow)`">
            <path :d="g.root" fill="#ec2f7b" opacity=".55" />
            <path :d="g.crown" fill="#ec2f7b" opacity=".9" />
          </g>
          <!-- kattintási felület -->
          <rect :x="-g.w / 2 - 2" :y="-g.ch - g.rl - 8" :width="g.w + 4" :height="g.ch + g.rl + 16" fill="transparent" />
          <template v-if="view(g.n)?.missing && !view(g.n)?.implant">
            <path :d="g.root" fill="none" stroke="#9fb1c4" stroke-opacity=".35" stroke-width="1.5" stroke-dasharray="4 4" />
            <path :d="g.crown" fill="none" stroke="#9fb1c4" stroke-opacity=".45" stroke-width="1.5" stroke-dasharray="4 4" />
          </template>
          <template v-else>
            <!-- gyökér / implantátum -->
            <template v-if="view(g.n)?.implant">
              <rect :x="-g.w * 0.17" :y="-g.ch - g.rl * 0.85" :width="g.w * 0.34" :height="g.rl * 0.85" rx="4" :fill="`url(#${uid}im)`" />
              <line v-for="k in 6" :key="k" :x1="-g.w * 0.2" :x2="g.w * 0.2" :y1="-g.ch - (g.rl * 0.85 * k) / 7" :y2="-g.ch - (g.rl * 0.85 * k) / 7 + 4" stroke="#0b6f68" stroke-width="2" />
            </template>
            <path v-else-if="view(g.n)?.pontic" :d="g.root" fill="none" stroke="#9fb1c4" stroke-opacity=".35" stroke-dasharray="4 4" />
            <path v-else :d="g.root" :fill="`url(#${uid}rt)`" :opacity="view(g.n)?.rootOnly ? 1 : 0.92" :stroke="view(g.n)?.rootOnly ? '#c08457' : 'none'" stroke-width="2" />
            <!-- csatorna -->
            <template v-if="!view(g.n)?.implant && !view(g.n)?.pontic">
              <template v-if="view(g.n)?.canal">
                <path v-for="(c, i) in g.canals" :key="i" :d="c" stroke="#8b4fe0" stroke-width="5" fill="none" stroke-linecap="round" />
                <path v-for="(c, i) in g.canals" :key="'w' + i" :d="c" stroke="#efe6ff" stroke-width="1.6" fill="none" stroke-linecap="round" />
              </template>
              <path v-for="(c, i) in g.canals" v-else :key="'p' + i" :d="c" stroke="#2b3949" stroke-opacity=".45" stroke-width="3" fill="none" stroke-linecap="round" />
            </template>
            <!-- korona -->
            <template v-if="!view(g.n)?.rootOnly">
              <path :d="g.crown" :fill="view(g.n)?.crown ? `url(#${uid}au)` : `url(#${uid}en)`" :filter="`url(#${uid}soft)`" />
              <g :clip-path="`url(#${uid}c${g.n})`">
                <template v-for="(color, s) in (view(g.n)?.surf || {})" :key="s">
                  <rect v-if="isRect(s as string)" v-bind="zone(g, s as Surface)" :fill="color" opacity=".88" />
                  <ellipse v-else-if="s === 'V'" v-bind="zone(g, s as Surface)" :fill="color" opacity=".88" />
                  <ellipse v-else v-bind="zone(g, s as Surface)" fill="none" :stroke="color" stroke-width="4" />
                </template>
                <template v-for="s in (current?.[g.n] || [])" :key="'cur' + s">
                  <rect v-if="isRect(s)" v-bind="zone(g, s)" fill="#ec2f7b" opacity=".92" />
                  <ellipse v-else-if="s === 'V'" v-bind="zone(g, s)" fill="#ec2f7b" opacity=".92" />
                  <ellipse v-else v-bind="zone(g, s)" fill="none" stroke="#ec2f7b" stroke-width="4.5" />
                </template>
                <circle v-if="view(g.n)?.caries" cx="0" :cy="-g.ch * 0.42" :r="g.w * 0.13" fill="#f5891f" stroke="#7a3d00" stroke-width="1.5" />
              </g>
              <path :d="g.crown" fill="none" :stroke="view(g.n)?.ring || (sel.has(g.n) ? '#ff7fb3' : '#ffffff')" :stroke-opacity="view(g.n)?.ring || sel.has(g.n) ? 1 : 0.35" :stroke-width="view(g.n)?.ring || sel.has(g.n) ? 2.5 : 1" />
            </template>
            <path v-else :d="g.crown" fill="none" stroke="#9fb1c4" stroke-opacity=".45" stroke-width="1.5" stroke-dasharray="4 4" />
          </template>
          <!-- vázlat (státuszfelvétel) -->
          <path v-if="draftOf(g.n)" :d="g.crown" fill="none" stroke="#c9b3ff" stroke-width="2" stroke-dasharray="3 3" transform="scale(1.12)" />
        </g>
        <!-- fogszám -->
        <g :transform="`translate(${g.labelX.toFixed(1)} ${g.labelY.toFixed(1)})`">
          <rect v-if="hl === g.n" x="-21" y="-19" width="42" height="29" rx="14" fill="none" stroke="#ec2f7b" stroke-width="2.5" />
          <rect v-if="sel.has(g.n) || focus === g.n" x="-17" y="-15" width="34" height="21" rx="10" :fill="focus === g.n ? '#ec2f7b' : 'rgba(236,47,123,.75)'" />
          <text x="0" y="1" text-anchor="middle" font-size="14" font-weight="700" :fill="sel.has(g.n) || focus === g.n ? '#fff' : '#b8c7d6'">{{ g.n }}</text>
          <g v-if="marks?.[g.n]" :title="marks[g.n]">
            <circle cx="-18" cy="-14" r="7" :fill="marks[g.n] === 'planned' ? '#2a8ccc' : marks[g.n] === 'added' ? '#f5b31f' : '#94a3b8'" stroke="#fff" stroke-width="1.5" />
          </g>
          <circle v-if="view(g.n)?.suggested" cx="0" cy="12" r="5" fill="none" stroke="#ec2f7b" stroke-width="2" stroke-dasharray="3 2" />
          <g v-if="flags?.[g.n]">
            <circle cx="17" cy="-14" r="8" fill="#f5891f" />
            <text x="17" y="-10" text-anchor="middle" font-size="12" font-weight="800" fill="#fff">!</text>
          </g>
        </g>
      </g>
    </svg>
    <div v-if="tip && tipView" class="tip" :style="`left:${tip.x}px;top:${tip.y}px`">
      <h4>{{ toothLabel(tip.n) }}<template v-if="statusLabels(draftOf(tip.n) || tipView.status).length"> · {{ statusLabels(draftOf(tip.n) || tipView.status).join(', ') }}</template></h4>
      <div v-if="flags?.[tip.n]" style="color:#b45f00;font-weight:700;margin-bottom:4px">⚠ {{ flags[tip.n] }}</div>
      <div v-for="(h, i) in tipView.history.slice(0, 6)" :key="i" class="hi">
        <i :style="`background:${h.color}`" />
        <div><b>{{ fmtDate(h.date) }}</b> · {{ h.typeName }}<template v-if="h.surfaces.length"> ({{ h.surfaces.map(s => surfaceCode(tip!.n, s)).join('') }})</template><br><span class="muted">{{ h.doctor }} – {{ h.text }}</span></div>
      </div>
      <div v-if="!tipView.history.length" class="muted">Nincs rögzített kezelés ezen a fogon.</div>
    </div>
  </div>
</template>
