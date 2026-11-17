<script setup lang="ts">
// Sterilizációs napló (spec v2.0, 2.5): autokláv-ciklusok, Bowie–Dick-teszt, indikátorok, tétel-azonosító;
// a kezeléshez használt műszercsomag tételszáma a kartonba kerül, így sikertelen ciklusnál visszakövethető.
import { useDataStore } from '~/stores/data'
import { useOfficeStore } from '~/stores/office'
import { useUiStore } from '~/stores/ui'
import { addDays, fmtDate, nowMin, fromMin, today } from '~/utils/dates'
import { STER_DEVICES, STER_PROGRAMS } from '~/utils/office'
import { typeNames } from '~/utils/logic'

const data = useDataStore()
const office = useOfficeStore()
const ui = useUiStore()
const db = computed(() => data.db)
const showForm = ref(false)
const blank = () => ({ date: today(), time: fromMin(Math.floor(nowMin() / 5) * 5), device: STER_DEVICES[0]!, program: STER_PROGRAMS[0]!, operator: '', packs: 8, contents: 'Alapkészletek ×6, tömőkészlet ×2', chem: true, bowieDick: null as boolean | null, bio: null as boolean | null, note: '' })
const f = ref(blank())
const isTest = computed(() => /teszt/i.test(f.value.program))
watch(() => f.value.program, () => { if (/bowie/i.test(f.value.program)) { f.value.bowieDick = true; f.value.packs = 0; f.value.contents = 'Bowie–Dick tesztcsomag' } else f.value.bowieDick = null })
const ok = computed(() => f.value.chem && f.value.bowieDick !== false && f.value.bio !== false)
const msg = ref('')
function save() {
  msg.value = ''
  if (!f.value.operator.trim()) { msg.value = 'Add meg, ki indította a ciklust.'; return }
  const c = office.addCycle({ ...f.value, operator: f.value.operator.trim(), packs: Number(f.value.packs) || 0, ok: ok.value })
  showForm.value = false; f.value = blank()
  ui.toast(c.ok ? `Ciklus rögzítve – tétel: ${c.batch}` : `Sikertelen ciklus rögzítve (${c.batch}) – a csomagok nem adhatók ki`)
}
const from30 = addDays(today(), -30)
const failed30 = computed(() => office.cycles.filter(c => !c.ok && c.date >= from30))
const lastBio = computed(() => office.cycles.find(c => c.bio !== null))
const open = ref<string | null>(null)
const pname = (id: string) => db.value.patients.find(p => p.id === id)?.name || ''
const ind = (v: boolean | null) => (v === null ? '–' : v ? '✓' : '✗')
function exportCsv() {
  const head = ['Dátum', 'Idő', 'Tétel', 'Készülék', 'Program', 'Kezelő', 'Csomagok', 'Tartalom', 'Kémiai indikátor', 'Bowie–Dick', 'Biológiai indikátor', 'Eredmény', 'Megjegyzés']
  const rows = office.cycles.map(c => [c.date, c.time, c.batch, c.device, c.program, c.operator, c.packs, c.contents, ind(c.chem), ind(c.bowieDick), ind(c.bio), c.ok ? 'megfelelt' : 'NEM FELELT MEG', c.note])
  const csv = '﻿' + [head, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n')
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = `sterilizacios_naplo_${today()}.csv`
  document.body.appendChild(a); a.click(); a.remove(); ui.toast('Napló letöltve (CSV, Excelben megnyitható)')
}
</script>

<template>
  <div>
    <div class="pagehead">
      <h1>Sterilizációs napló</h1><span class="pill">Budai telephely</span>
      <div class="spacer" />
      <button class="btn" @click="exportCsv"><AppIcon name="download" :size="16" />Napló letöltése</button>
      <button class="btn pri" @click="showForm = !showForm"><AppIcon name="plus" :size="16" />Új ciklus</button>
    </div>
    <div v-if="!office.bdToday" class="warn row"><b>Ma még nincs Bowie–Dick-teszt.</b><span>A napi első ciklus előtt végezd el, és rögzítsd itt.</span><button class="btn sm" @click="showForm = true; f.program = STER_PROGRAMS[2]!">Teszt rögzítése</button></div>
    <div class="kpis k4">
      <div class="kpi"><div class="kv-v" style="color:var(--green)">{{ office.cycles.filter(c => c.date === today()).length }}</div><div class="kv-l">ciklus ma</div></div>
      <div class="kpi"><div class="kv-v" style="color:var(--blue)">{{ office.batches.length }}</div><div class="kv-l">felhasználható tétel (30 napon belüli)</div></div>
      <div class="kpi"><div class="kv-v" style="color:var(--teal)">{{ lastBio ? fmtDate(lastBio.date) : '–' }}</div><div class="kv-l">utolsó biológiai indikátor</div></div>
      <div class="kpi"><div class="kv-v" style="color:var(--red)">{{ failed30.length }}</div><div class="kv-l">sikertelen ciklus (30 nap)</div></div>
    </div>

    <div v-if="showForm" class="card" style="border-top:5px solid var(--green)">
      <h2>Új sterilizálási ciklus</h2>
      <div class="grid3">
        <div class="field"><label class="f">Dátum</label><input v-model="f.date" class="inp" type="date"></div>
        <div class="field"><label class="f">Indítás ideje</label><input v-model="f.time" class="inp" type="time"></div>
        <div class="field"><label class="f">Kezelő *</label><input v-model="f.operator" class="inp" placeholder="pl. Fehér Kata"></div>
        <div class="field"><label class="f">Készülék</label><select v-model="f.device" class="inp"><option v-for="d in STER_DEVICES" :key="d">{{ d }}</option></select></div>
        <div class="field"><label class="f">Program</label><select v-model="f.program" class="inp"><option v-for="p in STER_PROGRAMS" :key="p">{{ p }}</option></select></div>
        <div class="field"><label class="f">Csomagok száma</label><input v-model.number="f.packs" class="inp" type="number" min="0" :disabled="isTest"></div>
        <div class="field" style="grid-column:1 / -1"><label class="f">Tartalom</label><input v-model="f.contents" class="inp"></div>
      </div>
      <div class="row" style="margin-bottom:10px">
        <label class="switch" :class="{ on: f.chem }" @click.prevent="f.chem = !f.chem"><i />kémiai indikátor átváltott</label>
        <span v-if="/bowie/i.test(f.program)" class="seg"><button :class="{ on: f.bowieDick === true }" @click="f.bowieDick = true">Bowie–Dick ✓</button><button :class="{ on: f.bowieDick === false }" @click="f.bowieDick = false">✗</button></span>
        <span class="seg"><button :class="{ on: f.bio === null }" @click="f.bio = null">biol. indikátor: nincs</button><button :class="{ on: f.bio === true }" @click="f.bio = true">✓</button><button :class="{ on: f.bio === false }" @click="f.bio = false">✗</button></span>
      </div>
      <div class="field"><label class="f">Megjegyzés</label><input v-model="f.note" class="inp"></div>
      <div class="row">
        <span class="badge" :class="ok ? 'b-green' : 'b-red'">{{ ok ? 'Megfelelt – a csomagok kiadhatók' : 'Nem felelt meg – a csomagok nem adhatók ki' }}</span>
        <div class="spacer" /><button class="btn" @click="showForm = false">Mégse</button><button class="btn pri" @click="save">Rögzítés</button>
      </div>
      <div v-if="msg" class="err" style="margin-top:8px">{{ msg }}</div>
    </div>

    <div class="card flush scroll-x">
      <table class="t">
        <thead><tr><th>Idő</th><th>Tétel</th><th class="hide-m">Készülék / program</th><th class="hide-m">Kezelő</th><th>Csomag</th><th>Indikátorok</th><th>Eredmény</th><th>Felhasználva</th></tr></thead>
        <tbody>
          <template v-for="c in office.cycles" :key="c.id">
            <tr :class="{ click: office.recordsOfBatch(c.batch).length }" @click="office.recordsOfBatch(c.batch).length && (open = open === c.batch ? null : c.batch)">
              <td class="nowrap"><b>{{ fmtDate(c.date) }}</b> {{ c.time }}</td>
              <td class="nowrap"><b>{{ c.batch }}</b></td>
              <td class="small hide-m">{{ c.device }}<br><span class="muted">{{ c.program }}</span></td>
              <td class="small hide-m">{{ c.operator }}</td>
              <td class="small">{{ c.packs || '–' }}<div class="muted hide-m" style="max-width:260px">{{ c.contents }}</div></td>
              <td class="small nowrap">kémiai {{ ind(c.chem) }}<template v-if="c.bowieDick !== null"> · B–D {{ ind(c.bowieDick) }}</template><template v-if="c.bio !== null"> · biol. {{ ind(c.bio) }}</template></td>
              <td><span class="badge" :class="c.ok ? 'b-green' : 'b-red'">{{ c.ok ? 'megfelelt' : 'nem felelt meg' }}</span><div v-if="c.note" class="small muted" style="max-width:240px">{{ c.note }}</div></td>
              <td class="small nowrap">{{ office.recordsOfBatch(c.batch).length ? `${office.recordsOfBatch(c.batch).length} kezelés ▾` : '–' }}</td>
            </tr>
            <tr v-if="open === c.batch">
              <td colspan="8" style="background:#f7fafb">
                <div v-for="r in office.recordsOfBatch(c.batch)" :key="r.id" class="small" style="padding:3px 0">
                  {{ fmtDate(r.date) }} {{ r.time }} · <NuxtLink :to="`/paciensek/${r.patientId}`"><b>{{ pname(r.patientId) }}</b></NuxtLink> · {{ typeNames(db, r.typeIds) }}
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
    <p class="muted small">A napló a végleges rendszerben nem törölhető, csak kiegészíthető (megjegyzéssel javítható). A csomag a sterilizálástól számított {{ 30 }} napig adható ki. Kattints egy sorra: kiknél használták az adott tétel csomagjait.</p>
  </div>
</template>

<style scoped>
.kpis.k4 { grid-template-columns: repeat(4, 1fr) }
@media (max-width: 760px) { .kpis.k4 { grid-template-columns: 1fr 1fr } }
</style>
