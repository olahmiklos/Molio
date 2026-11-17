<script setup lang="ts">
// Havi nézet: naponta a foglaltság százalékban (a ráhagyás is beleszámít)
import { useDataStore } from '~/stores/data'
import { useAppointmentStore } from '~/stores/appointment'
import { addDays, DAYS, dow, fmtLong, fromYmd, shortName, today, ymd } from '~/utils/dates'
import type { Appointment } from '~/utils/types'
import { docIdx, typeNames } from '~/utils/logic'
import { apptsOn, slotsList } from '~/utils/calendar'

const props = defineProps<{ date: string }>()
const emit = defineEmits<{ 'open-day': [d: string]; 'open-appt': [a: Appointment] }>()
const data = useDataStore()
const ap = useAppointmentStore()
const db = computed(() => data.db)
const t0 = today()

const cells = computed(() => {
  const f = fromYmd(props.date); f.setDate(1)
  const first = ymd(f), mo = f.getMonth(), start = addDays(first, 1 - dow(first))
  const tot = slotsList(db.value).length * db.value.doctors.length
  const out = []
  for (let k = 0; k < 42; k++) {
    const dd = addDays(start, k), inM = fromYmd(dd).getMonth() === mo, we = dow(dd) > 5
    if (k === 35 && !inM) break
    const list = apptsOn(db.value, dd).sort((a, b) => a.start.localeCompare(b.start))
    const usedT = list.reduce((s, a) => s + a.dur / 30, 0), usedB = list.reduce((s, a) => s + (a.buffer || 0) / 30, 0)
    const pct = tot ? Math.round((usedT + usedB) / tot * 100) : 0
    const lvl = pct >= 80 ? 'full' : pct >= 50 ? 'mid' : 'low'
    out.push({ dd, inM, we, list, pct, lvl, tPct: tot ? usedT / tot * 100 : 0, bPct: tot ? usedB / tot * 100 : 0 })
  }
  return out
})
const pname = (a: Appointment) => db.value.patients.find(p => p.id === a.patientId)?.name || ''
</script>

<template>
  <div>
    <div class="month">
      <div v-for="(n, i) in DAYS" :key="n" class="mh-d" :class="{ we: i > 4 }">{{ n }}</div>
      <div v-for="c in cells" :key="c.dd" class="mc" :class="{ out: !c.inM, we: c.we, today: c.dd === t0 }" :title="fmtLong(c.dd)" @click="emit('open-day', c.dd)">
        <div class="mc-h">
          <span class="mc-n">{{ fromYmd(c.dd).getDate() }}</span>
          <span v-if="!c.we && c.list.length" class="mc-p" :class="c.lvl">{{ c.pct >= 80 ? 'betelt · ' : '' }}{{ c.pct }}%</span>
        </div>
        <div v-if="c.we" class="small muted">zárva</div>
        <div v-else class="mc-bar"><i :class="c.lvl" :style="`width:${Math.min(100, c.tPct)}%`" /><i class="bufp" :style="`width:${Math.min(100 - c.tPct, c.bPct)}%`" /></div>
        <div v-for="a in c.list.slice(0, 4)" :key="a.id" class="mc-a" :class="`d${docIdx(db, a.doctorId)}`" :title="`${pname(a)} – ${typeNames(db, a.typeIds)}${a.buffer ? ` · ráhagyás ${a.buffer} perc` : ''}`" @click.stop="emit('open-appt', a)">
          {{ ap.isDone(a) ? '✓ ' : a.status === 'noshow' ? '✗ ' : a.date >= t0 && ap.risk(a).level === 'high' ? '⚠ ' : '' }}{{ a.start }} {{ shortName(pname(a)) }}<i v-if="a.buffer" class="bdot" />
        </div>
        <div v-if="c.list.length > 4" class="small muted">+{{ c.list.length - 4 }} további</div>
      </div>
    </div>
    <p class="muted small" style="line-height:1.8">
      A százalék a nap foglaltsága a két orvos összes sávjához képest, a ráhagyással együtt
      (<span class="mc-p low">0–49%</span> <span class="mc-p mid">50–79%</span> <span class="mc-p full">80% felett: betelt</span>).
      <span class="leg buf-leg">Ráhagyás</span> a sáv csíkozott része; a névnél a ▫ jelzi a ráhagyást. Egy napra kattintva megnyílik a napi nézet.
    </p>
  </div>
</template>
