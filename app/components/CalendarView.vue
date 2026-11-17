<script setup lang="ts">
// Naptár napi, heti és havi nézetben, két fogorvos, ráhagyási sávokkal (spec 2.1.1)
import { useDataStore } from '~/stores/data'
import { useAppointmentStore } from '~/stores/appointment'
import { useUiStore } from '~/stores/ui'
import { addDays, DAYS, dow, fmtDate, fmtLong, fmtShort, fromMin, fromYmd, MONTHS, nowMin, toMin, today } from '~/utils/dates'
import type { Appointment } from '~/utils/types'
import { docIdx, typeNames } from '~/utils/logic'
import { apptsOn, slotsList, usedSlots } from '~/utils/calendar'
import AppointmentModal from './modals/AppointmentModal.vue'
import BookingModal from './modals/BookingModal.vue'

const data = useDataStore()
const ap = useAppointmentStore()
const ui = useUiStore()
const db = computed(() => data.db)
const t0 = computed(() => today())
const slots = computed(() => slotsList(db.value))
const d = computed(() => ap.calDate)
const docs = computed(() => db.value.doctors)
const nowM = ref(nowMin())
onMounted(() => { const i = setInterval(() => { nowM.value = nowMin() }, 60000); onBeforeUnmount(() => clearInterval(i)) })

const title = computed(() => {
  if (ap.calMode === 'day') return fmtLong(d.value)
  if (ap.calMode === 'week') return 'Hét: ' + fmtDate(addDays(d.value, 1 - dow(d.value))) + ' – ' + fmtShort(addDays(d.value, 5 - dow(d.value)))
  const f = fromYmd(d.value); return f.getFullYear() + '. ' + MONTHS[f.getMonth()]
})
const slotRow = (t: string) => (toMin(t) - db.value.settings.startHour * 60) / 30 + 1
const isPast = (dd: string, m: number) => dd < t0.value || (dd === t0.value && m + 30 <= nowM.value)
const weekDays = computed(() => { const ws = addDays(d.value, 1 - dow(d.value)); return [0, 1, 2, 3, 4].map(i => addDays(ws, i)) })

const pname = (a: Appointment) => db.value.patients.find(p => p.id === a.patientId)?.name || '?'
const mark = (a: Appointment) => (ap.isDone(a) ? '✓ ' : a.status === 'noshow' ? '✗ ' : a.date >= t0.value && ap.risk(a).level === 'high' ? '⚠ ' : '')
const clip = (a: Appointment) => {
  // a rendelési időn túllógó rész nem jelenik meg
  const end = db.value.settings.endHour * 60, s = toMin(a.start)
  const dur = Math.max(30, Math.min(a.dur, end - s)), buf = Math.max(0, Math.min(a.buffer || 0, end - s - dur))
  return { dur, buf }
}
function openAppt(a: Appointment) { ui.open(AppointmentModal, { id: a.id }) }
function book(o: Record<string, string>) { ui.open(BookingModal, o) }
</script>

<template>
  <div>
    <div class="pagehead">
      <h1>{{ title }}</h1>
      <span v-if="d === t0 && ap.calMode === 'day'" class="badge b-green">ma</span>
      <div class="spacer" />
      <div class="row" style="gap:6px">
        <button class="btn" aria-label="Előző" @click="ap.calNav(-1)">‹</button>
        <button class="btn" @click="ap.calNav(0)">Ma</button>
        <button class="btn" aria-label="Következő" @click="ap.calNav(1)">›</button>
      </div>
      <div class="seg">
        <button :class="{ on: ap.calMode === 'day' }" @click="ap.calMode = 'day'">Napi</button>
        <button :class="{ on: ap.calMode === 'week' }" @click="ap.calMode = 'week'">Heti</button>
        <button :class="{ on: ap.calMode === 'month' }" @click="ap.calMode = 'month'">Havi</button>
      </div>
      <button class="btn pri" @click="book({})"><AppIcon name="plus" :size="16" />Új időpont</button>
    </div>

    <!-- napi nézet -->
    <template v-if="ap.calMode === 'day'">
      <div v-if="dow(d) > 5" class="hint">Hétvégén nincs rendelés.</div>
      <div class="cal" :style="`grid-template-columns:60px repeat(${docs.length},minmax(0,1fr));grid-template-rows:auto repeat(${slots.length},34px)`">
        <div class="hd" style="border-left:0" />
        <div v-for="dc in docs" :key="dc.id" class="hd">{{ dc.name }} <span class="muted small">· {{ usedSlots(db, d, dc.id) }}/{{ slots.length }} sáv foglalt</span></div>
        <template v-for="(m, r) in slots" :key="m">
          <div class="tm" :style="`grid-row:${r + 2};grid-column:1`">{{ fromMin(m) }}</div>
          <div v-for="(dc, ci) in docs" :key="dc.id + m" class="slot" :class="dow(d) > 5 ? 'closed' : isPast(d, m) ? 'past' : ''"
            :style="`grid-row:${r + 2};grid-column:${ci + 2}`" @click="dow(d) <= 5 && book({ date: d, start: fromMin(m), doctorId: dc.id })" />
        </template>
        <template v-for="(dc, ci) in docs" :key="'a' + dc.id">
          <template v-for="a in apptsOn(db, d, dc.id)" :key="a.id">
            <div class="ap" :class="[`d${docIdx(db, a.doctorId)}`, { done: ap.isDone(a), noshow: a.status === 'noshow', 'has-buf': clip(a).buf > 0 }]"
              :style="`grid-row:${slotRow(a.start) + 1} / span ${clip(a).dur / 30};grid-column:${ci + 2}`" :title="`${pname(a)} – ${typeNames(db, a.typeIds)}`" @click.stop="openAppt(a)">
              <b>{{ mark(a) }}{{ pname(a) }}</b>
              <span>{{ a.start }}–{{ fromMin(toMin(a.start) + a.dur) }} · {{ typeNames(db, a.typeIds) }}</span>
            </div>
            <div v-if="clip(a).buf > 0" class="buf" :style="`grid-row:${slotRow(a.start) + 1 + clip(a).dur / 30} / span ${clip(a).buf / 30};grid-column:${ci + 2}`"
              :title="`Ráhagyás ${a.buffer} perc – kattints a módosításhoz`" @click.stop="openAppt(a)">Ráhagyás · {{ a.buffer }}'</div>
          </template>
        </template>
      </div>
      <p class="muted small" style="line-height:1.8">
        Kattints egy üres sávra időpont foglalásához, vagy egy időpontra a részletekhez és a kezelés indításához.
        Rendelési idő: {{ db.settings.startHour }}:00–{{ db.settings.endHour }}:00, 30 perces sávok.<br>
        <span v-for="(dc, i) in docs" :key="dc.id" class="leg" :style="`background:${i === 0 ? 'var(--green)' : 'var(--pink)'};margin-right:6px`">{{ dc.name }}</span>
        <span class="leg buf-leg">Ráhagyás</span> = tartalék az elhúzódó kezelésre, foglaltnak számít.
      </p>
    </template>

    <!-- heti nézet -->
    <template v-else-if="ap.calMode === 'week'">
      <div class="scroll-x">
        <div class="cal week" :style="`min-width:900px;grid-template-columns:52px repeat(${weekDays.length * docs.length},minmax(0,1fr));grid-template-rows:auto auto repeat(${slots.length},28px)`">
          <div class="hd" style="border-left:0;grid-row:1 / span 2" />
          <template v-for="(dd, i) in weekDays" :key="dd">
            <div class="hd day" :class="{ today: dd === t0 }" :style="`grid-column:${2 + i * docs.length} / span ${docs.length};grid-row:1`" @click="ap.openDay(dd)">
              {{ DAYS[i] }} {{ fmtShort(dd) }}<br><span class="muted small">{{ usedSlots(db, dd) }}/{{ slots.length * docs.length }} sáv foglalt</span>
            </div>
            <div v-for="(dc, j) in docs" :key="dd + dc.id" class="hd small" :style="`grid-column:${2 + i * docs.length + j};grid-row:2;font-weight:600`">{{ dc.name }}</div>
          </template>
          <template v-for="(m, r) in slots" :key="'w' + m">
            <div class="tm" :style="`grid-row:${r + 3};grid-column:1`">{{ m % 60 === 0 ? fromMin(m) : '' }}</div>
            <template v-for="(dd, i) in weekDays" :key="dd + m">
              <div v-for="(dc, j) in docs" :key="dd + dc.id + m" class="slot" :class="[isPast(dd, m) ? 'past' : '', j === 0 ? 'daystart' : '']"
                :style="`grid-row:${r + 3};grid-column:${2 + i * docs.length + j};min-height:28px`" @click="book({ date: dd, start: fromMin(m), doctorId: dc.id })" />
            </template>
          </template>
          <template v-for="(dd, i) in weekDays" :key="'wa' + dd">
            <template v-for="(dc, j) in docs" :key="'wa' + dd + dc.id">
              <template v-for="a in apptsOn(db, dd, dc.id)" :key="a.id">
                <div class="ap" :class="[`d${docIdx(db, a.doctorId)}`, { done: ap.isDone(a), noshow: a.status === 'noshow', 'has-buf': clip(a).buf > 0 }]"
                  :style="`grid-row:${slotRow(a.start) + 2} / span ${clip(a).dur / 30};grid-column:${2 + i * docs.length + j}`" :title="`${pname(a)} – ${typeNames(db, a.typeIds)}`" @click.stop="openAppt(a)">
                  <b>{{ mark(a) }}{{ pname(a) }}</b><span v-if="a.dur > 30">{{ typeNames(db, a.typeIds) }}</span>
                </div>
                <div v-if="clip(a).buf > 0" class="buf" :style="`grid-row:${slotRow(a.start) + 2 + clip(a).dur / 30} / span ${clip(a).buf / 30};grid-column:${2 + i * docs.length + j}`" @click.stop="openAppt(a)">Ráhagyás</div>
              </template>
            </template>
          </template>
        </div>
      </div>
      <p class="muted small" style="line-height:1.8">
        A heti nézetben egy napra kattintva megnyílik a napi nézet.
        <span v-for="(dc, i) in docs" :key="dc.id" class="leg" :style="`background:${i === 0 ? 'var(--green)' : 'var(--pink)'};margin-right:6px`">{{ dc.name }}</span>
        <span class="leg buf-leg">Ráhagyás</span> · ✓ = a kezelés már rögzítve, ⚠ = magas meg nem jelenési kockázat.
      </p>
    </template>

    <CalendarMonth v-else :date="d" @open-day="ap.openDay" @open-appt="openAppt" />
  </div>
</template>
