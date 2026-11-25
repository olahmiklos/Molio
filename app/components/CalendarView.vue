<script setup lang="ts">
// Naptár napi, heti és havi nézetben, két fogorvos, ráhagyási sávokkal (spec 2.1.1)
import { useDataStore } from '~/stores/data'
import { useAppointmentStore } from '~/stores/appointment'
import { useUiStore } from '~/stores/ui'
import { addDays, DAYS, dow, fmtDate, fmtLong, fmtShort, fromMin, fromYmd, MONTHS, nowMin, toMin, today } from '~/utils/dates'
import type { Appointment } from '~/utils/types'
import { docIdx, typeNames } from '~/utils/logic'
import { apptsOn, slotsList, usedSlots } from '~/utils/calendar'
import { conflictGroups, conflictsFor, laneLayout } from '~/utils/conflicts'
import { isWorking, notWorkingText, slotWorking } from '~/utils/schedule'
import { recordForAppt } from '~/utils/logic'
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
const slotRow = (t: string) => (toMin(t) - (slots.value[0] ?? db.value.settings.startHour * 60)) / 30 + 1
const isPast = (dd: string, m: number) => dd < t0.value || (dd === t0.value && m + 30 <= nowM.value)
const weekDays = computed(() => { const ws = addDays(d.value, 1 - dow(d.value)); return [0, 1, 2, 3, 4].map(i => addDays(ws, i)) })

const pname = (a: Appointment) => db.value.patients.find(p => p.id === a.patientId)?.name || '?'
/* v2.4 7. pont (B-010): az ütköző időpontok egymás mellett, egyenlő szélességű sávokban; ‼ és piros keret, csak ráhagyás-ütközésnél szaggatott; szándékos átfedésnél halvány */
const isDoneA = (a: Appointment) => !!recordForAppt(db.value, a.id)
const confOf = (a: Appointment) => (ap.isDone(a) ? [] : conflictsFor(db.value, a, isDoneA))
const isConf = (a: Appointment) => confOf(a).some(c => c.hard && !c.ok)
const isBufConf = (a: Appointment) => !isConf(a) && confOf(a).some(c => !c.ok)
const isOkConf = (a: Appointment) => confOf(a).length > 0 && confOf(a).every(c => c.ok)
const confTitle = (a: Appointment) => 'ÜTKÖZIK: ' + confOf(a).map(c => `${pname(c.other)} ${c.other.start}${c.hard ? '' : ' (ráhagyás)'}${c.ok ? ' – szándékos átfedés' : ''}`).join(', ')
const lanes = computed(() => {
  const m = new Map<string, { lane: number; n: number }>()
  const days = ap.calMode === 'week' ? weekDays.value : [d.value]
  days.forEach(dd => docs.value.forEach(dc => laneLayout(apptsOn(db.value, dd, dc.id).filter(a => a.status !== 'noshow')).forEach((v, k) => m.set(k, v))))
  return m
})
const laneStyle = (a: Appointment) => { const l = lanes.value.get(a.id); if (!l || l.n <= 1) return ''; return `;justify-self:start;width:calc(${100 / l.n}% - 4px);margin-left:calc(${(100 * l.lane) / l.n}% + 2px);margin-right:0` }
const docStyle = (a: Appointment) => { const i = docIdx(db.value, a.doctorId); if (i < 2) return ''; const c = db.value.doctors.find(x => x.id === a.doctorId)?.color || '#2a8ccc'; return `;background:${c}` }
const working = (dd: string, docId: string, m: number) => slotWorking(db.value, docId, dd, m)
const offTitle = (dd: string, docId: string) => notWorkingText(db.value, docId, dd)
const openConf = computed(() => conflictGroups(db.value, { isDone: isDoneA }).filter(g => !g.ok))
const isHl = (a: Appointment) => ap.highlight.includes(a.id)
const offAppt = (a: Appointment) => !a.urgent && !ap.isDone(a) && a.date >= t0.value && !isWorking(db.value, a.doctorId, a.date, a.start, a.dur + (a.buffer || 0))
const mark = (a: Appointment) => (ap.isDone(a) ? '✓ ' : isConf(a) || isBufConf(a) ? '‼ ' : a.cancelSignal ? '✉ ' : a.status === 'noshow' ? '✗ ' : a.date >= t0.value && ap.risk(a).level === 'high' ? '⚠ ' : '')
const clip = (a: Appointment) => {
  // a rendelési időn túllógó rész nem jelenik meg
  const end = (slots.value[slots.value.length - 1] ?? db.value.settings.endHour * 60 - 30) + 30, s = toMin(a.start)
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
    <NuxtLink v-if="openConf.length" to="/emlekeztetok?tab=tasks&kind=conflict" class="conf-banner" data-test="utkozes-sav">‼ {{ openConf.length }} időpont-ütközés – kezelendő <span class="small" style="font-weight:600">· megnyitás a Teendők között →</span></NuxtLink>

    <!-- napi nézet -->
    <template v-if="ap.calMode === 'day'">
      <div v-if="dow(d) > 5" class="hint">Hétvégén nincs rendelés.</div>
      <div class="cal" :style="`grid-template-columns:60px repeat(${docs.length},minmax(0,1fr));grid-template-rows:auto repeat(${slots.length},34px)`">
        <div class="hd" style="border-left:0" />
        <div v-for="dc in docs" :key="dc.id" class="hd">{{ dc.name }} <span class="muted small">· {{ usedSlots(db, d, dc.id) }}/{{ slots.length }} sáv foglalt</span></div>
        <template v-for="(m, r) in slots" :key="m">
          <div class="tm" :style="`grid-row:${r + 2};grid-column:1`">{{ fromMin(m) }}</div>
          <div v-for="(dc, ci) in docs" :key="dc.id + m" class="slot" :class="!working(d, dc.id, m) ? 'offsched' : isPast(d, m) ? 'past' : ''" :title="!working(d, dc.id, m) ? offTitle(d, dc.id) : ''"
            :style="`grid-row:${r + 2};grid-column:${ci + 2}`" @click="working(d, dc.id, m) && book({ date: d, start: fromMin(m), doctorId: dc.id })" />
        </template>
        <template v-for="(dc, ci) in docs" :key="'a' + dc.id">
          <template v-for="a in apptsOn(db, d, dc.id)" :key="a.id">
            <div class="ap" :class="[`d${docIdx(db, a.doctorId)}`, { done: ap.isDone(a), noshow: a.status === 'noshow', 'has-buf': clip(a).buf > 0, short: clip(a).dur <= 30, conflict: isConf(a), 'conflict-buf': isBufConf(a), 'conflict-ok': isOkConf(a), signal: !!a.cancelSignal, 'offsched-ap': offAppt(a), hl: isHl(a) }]"
              :style="`grid-row:${slotRow(a.start) + 1} / span ${clip(a).dur / 30};grid-column:${ci + 2}${laneStyle(a)}${docStyle(a)}`" :title="`${pname(a)} – ${typeNames(db, a.typeIds)}${isConf(a) ? ' · ' + confTitle(a) : ''}${a.cancelSignal ? ' · lemondást jelzett' : ''}`" @click.stop="openAppt(a)">
              <b>{{ mark(a) }}{{ pname(a) }}</b>
              <span>{{ a.start }}–{{ fromMin(toMin(a.start) + a.dur) }} · {{ typeNames(db, a.typeIds) }}</span>
            </div>
            <div v-if="clip(a).buf > 0" class="buf" :style="`grid-row:${slotRow(a.start) + 1 + clip(a).dur / 30} / span ${clip(a).buf / 30};grid-column:${ci + 2}${laneStyle(a)}`"
              :title="`Ráhagyás ${a.buffer} perc – kattints a módosításhoz`" @click.stop="openAppt(a)">Ráhagyás · {{ a.buffer }}'</div>
          </template>
        </template>
      </div>
      <p class="muted small" style="line-height:1.8">
        Kattints egy üres sávra időpont foglalásához, vagy egy időpontra a részletekhez és a kezelés indításához.
        30 perces sávok; a csíkozott sáv az orvos beosztásán kívül esik (nem foglalható).<br>
        <span v-for="(dc, i) in docs" :key="dc.id" class="leg" :style="`background:${i === 0 ? 'var(--green)' : 'var(--pink)'};margin-right:6px`">{{ dc.name }}</span>
        <span class="leg buf-leg">Ráhagyás</span> = tartalék az elhúzódó kezelésre, foglaltnak számít. <span class="leg conf-leg">‼ Ütközés</span> = piros keretes időpont, a másikkal átfedésben van (egymás mellett látszanak; szaggatott keret: csak a ráhagyás fedi át) · ✉ = a páciens lemondást jelzett.
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
              <div v-for="(dc, j) in docs" :key="dd + dc.id + m" class="slot" :class="[!working(dd, dc.id, m) ? 'offsched' : isPast(dd, m) ? 'past' : '', j === 0 ? 'daystart' : '']" :title="!working(dd, dc.id, m) ? offTitle(dd, dc.id) : ''"
                :style="`grid-row:${r + 3};grid-column:${2 + i * docs.length + j};min-height:28px`" @click="working(dd, dc.id, m) && book({ date: dd, start: fromMin(m), doctorId: dc.id })" />
            </template>
          </template>
          <template v-for="(dd, i) in weekDays" :key="'wa' + dd">
            <template v-for="(dc, j) in docs" :key="'wa' + dd + dc.id">
              <template v-for="a in apptsOn(db, dd, dc.id)" :key="a.id">
                <div class="ap" :class="[`d${docIdx(db, a.doctorId)}`, { done: ap.isDone(a), noshow: a.status === 'noshow', 'has-buf': clip(a).buf > 0, conflict: isConf(a), 'conflict-buf': isBufConf(a), 'conflict-ok': isOkConf(a), signal: !!a.cancelSignal, 'offsched-ap': offAppt(a), hl: isHl(a) }]"
                  :style="`grid-row:${slotRow(a.start) + 2} / span ${clip(a).dur / 30};grid-column:${2 + i * docs.length + j}${laneStyle(a)}${docStyle(a)}`" :title="`${pname(a)} – ${typeNames(db, a.typeIds)}${isConf(a) ? ' · ' + confTitle(a) : ''}`" @click.stop="openAppt(a)">
                  <b>{{ mark(a) }}{{ pname(a) }}</b><span v-if="a.dur > 30">{{ typeNames(db, a.typeIds) }}</span>
                </div>
                <div v-if="clip(a).buf > 0" class="buf" :style="`grid-row:${slotRow(a.start) + 2 + clip(a).dur / 30} / span ${clip(a).buf / 30};grid-column:${2 + i * docs.length + j}${laneStyle(a)}`" @click.stop="openAppt(a)">Ráhagyás</div>
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
