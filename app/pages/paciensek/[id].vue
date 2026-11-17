<script setup lang="ts">
// Ügyfélkarton: alapadatok, egészségügyi figyelmeztetés, belső megjegyzés, fogazat, fogtérkép, kezelési előzmények
import { useDataStore } from '~/stores/data'
import { usePatientStore } from '~/stores/patient'
import { useTreatmentStore } from '~/stores/treatment'
import { useUiStore } from '~/stores/ui'
import { esc, fmtBirth, fmtDate, fmtFt, fmtLong } from '~/utils/dates'
import type { Dentition } from '~/utils/types'
import { doctorName, suggestBufferFlag, typeNames } from '~/utils/logic'
import { teethStr } from '~/utils/teeth'
import { STATUS_STYLE } from '~/utils/defaults'
import PatientFormModal from '~/components/modals/PatientFormModal.vue'
import BookingModal from '~/components/modals/BookingModal.vue'
import AttachmentViewer from '~/components/modals/AttachmentViewer.vue'

const route = useRoute()
const data = useDataStore()
const patients = usePatientStore()
const tx = useTreatmentStore()
const ui = useUiStore()
const pdf = usePdf()
const db = computed(() => data.db)
const id = computed(() => String(route.params.id))
const p = computed(() => patients.byId(id.value))
const recs = computed(() => patients.recordsOf(id.value))
const byDay = computed(() => {
  const m: Record<string, typeof recs.value> = {}
  recs.value.forEach(r => { (m[r.date] = m[r.date] || []).push(r) })
  return Object.keys(m).sort().reverse().map(d => ({ d, list: m[d]!.sort((a, b) => a.time.localeCompare(b.time)) }))
})
const upcoming = computed(() => patients.upcoming(id.value))
const suggested = computed(() => (p.value ? patients.suggestedDentition(p.value.birth) : 'permanent'))
const statuses = computed(() => (p.value ? p.value.statuses.slice().sort((a, b) => b.date.localeCompare(a.date)) : []))
const sessHere = computed(() => tx.active && tx.s?.patientId === id.value)
const attsOf = (rid: string) => db.value.attachments.filter(a => a.recordId === rid)

async function setDent(d: Dentition) {
  if (!p.value || p.value.dentition === d) return
  const ok = await ui.confirm(`A fogtérkép ${d === 'primary' ? '<b>tejfogazatra</b> (20 fog)' : '<b>maradó fogazatra</b> (32 fog)'} vált. A váltás dátummal mentődik, a korábbi bejegyzések és státuszok megmaradnak.`, 'Váltás')
  if (!ok) return
  patients.setDentition(p.value.id, d); ui.toast('Fogazat átállítva')
}
async function newTreatment() {
  if (tx.active && !sessHere.value) {
    const ok = await ui.confirm(`Egy másik páciens kezelése (${esc(tx.patient?.name)}) még folyamatban van. Elveted, és újat indítasz?`, 'Új kezelés', true)
    if (!ok) return
    tx.cancel()
  }
  if (!sessHere.value) tx.startNew(id.value)
  navigateTo('/kezeles')
}
function edit(rid: string) { tx.editRecord(rid); navigateTo('/kezeles') }
const statusSummary = (teeth: Record<string, string[]>) => {
  const c: Record<string, number> = {}
  Object.values(teeth).forEach(st => st.forEach(s => { if (s !== 'ep') c[s] = (c[s] || 0) + 1 }))
  return Object.entries(c).map(([k, v]) => `${STATUS_STYLE[k]?.label || k}: ${v}`).join(' · ') || 'minden fog ép'
}
</script>

<template>
  <div v-if="p">
    <div class="pagehead">
      <NuxtLink to="/paciensek" class="btn">‹ Páciensek</NuxtLink>
      <h1>{{ p.name }}</h1>
      <HealthWarning :text="p.healthWarning" />
      <div class="spacer" />
      <button class="btn" @click="ui.open(PatientFormModal, { id: p.id })">Adatok szerkesztése</button>
      <button class="btn" @click="ui.open(BookingModal, { patientId: p.id })">Időpont foglalása</button>
      <button class="btn go" @click="newTreatment"><AppIcon name="tooth" :size="16" />{{ sessHere ? 'Folyamatban lévő kezelés' : 'Új kezelés' }}</button>
    </div>

    <div class="card sumcard">
      <div class="row" style="margin-bottom:8px"><h2 style="margin:0">✨ Gyors összefoglaló</h2><span class="badge b-gray">automatikusan összeállítva a kartonból</span></div>
      <PatientSummary :patient-id="p.id" />
    </div>

    <div v-if="suggestBufferFlag(db, p)" class="warn row">
      <span>A páciens az elmúlt 12 hónapban többször késett. Bekapcsolod a „ráhagyást igényel” jelölést? Ekkor az időpontjai után a naptár tartaléksávot hagy.</span>
      <button class="btn sm" @click="patients.update(p.id, { needsBuffer: true }); ui.toast('Bekapcsolva: ráhagyást igényel')">Bekapcsolom</button>
    </div>

    <div style="display:grid;grid-template-columns:minmax(0,380px) minmax(0,1fr);gap:18px;align-items:start" class="cardgrid">
      <div class="card">
        <h2>Alapadatok</h2>
        <div class="kv" style="grid-template-columns:128px 1fr">
          <div>Születési dátum</div><div>{{ fmtBirth(p.birth) }} <span class="muted">({{ patients.age(p) }} éves)</span></div>
          <div>TAJ-szám</div><div>{{ p.taj || '–' }}</div>
          <div>Telefon</div><div>{{ p.phone }}</div>
          <div>E-mail</div><div>{{ p.email || '–' }}</div>
          <div>Lakcím</div><div>{{ p.address || '–' }}</div>
          <div>Egészségügyi</div><div><b v-if="p.healthWarning" style="color:var(--red)">⚕ {{ p.healthWarning }}</b><span v-else class="muted">nincs</span></div>
          <div>Belső megjegyzés</div><div><InternalNote :text="p.internalNote" /></div>
          <div>Ráhagyás</div>
          <div><label class="switch" :class="{ on: p.needsBuffer }" @click.prevent="patients.update(p.id, { needsBuffer: !p.needsBuffer })"><i />{{ p.needsBuffer ? 'ráhagyást igényel' : 'nem igényel' }}</label></div>
          <div>Fogazat</div>
          <div>
            <div class="seg">
              <button :class="{ on: p.dentition === 'primary' }" @click="setDent('primary')">Tejfog</button>
              <button :class="{ on: p.dentition === 'permanent' }" @click="setDent('permanent')">Maradó</button>
            </div>
            <div v-if="suggested !== p.dentition" class="small" style="color:var(--orange);margin-top:4px">A születési dátum alapján {{ suggested === 'primary' ? 'tejfogazat' : 'maradó fogazat' }} javasolt.</div>
            <div v-if="p.dentitionHistory.length > 1" class="small muted" style="margin-top:4px">
              <div v-for="h in p.dentitionHistory" :key="h.date + h.to">{{ fmtDate(h.date) }}: {{ h.to === 'primary' ? 'tejfogazat' : 'maradó fogazat' }}</div>
            </div>
          </div>
          <div>Következő időpont</div>
          <div><template v-if="upcoming.length"><div v-for="a in upcoming.slice(0, 3)" :key="a.id">{{ fmtDate(a.date) }} {{ a.start }} · {{ doctorName(db, a.doctorId) }} · {{ typeNames(db, a.typeIds) }}<span v-if="a.buffer" class="badge b-buf" style="margin-left:4px">+{{ a.buffer }}'</span></div></template><span v-else>–</span></div>
        </div>
      </div>
      <div class="card">
        <h2>Fogtérkép</h2>
        <ChartPanel :patient-id="p.id" />
        <details v-if="statuses.length" style="margin-top:12px">
          <summary class="small" style="cursor:pointer;font-weight:700;color:var(--slate)">Fogazati státuszok ({{ statuses.length }})</summary>
          <div v-for="s in statuses" :key="s.id" class="small" style="padding:6px 0;border-bottom:1px solid #eef1f3">
            <b>{{ fmtDate(s.date) }}</b> · {{ s.dentition === 'primary' ? 'tejfogazat' : 'maradó fogazat' }} – {{ statusSummary(s.teeth) }}<span v-if="s.note" class="muted"> · {{ s.note }}</span>
          </div>
        </details>
      </div>
    </div>

    <div class="card">
      <h2>Kezelések</h2>
      <template v-if="byDay.length">
        <div v-for="g in byDay" :key="g.d" class="day-grp">
          <div class="dh">{{ fmtLong(g.d) }} <span class="muted small" style="font-weight:500">{{ g.list.length }} kezelés</span><div class="spacer" /><button class="btn sm" @click="pdf.download(p.id, g.d)"><AppIcon name="download" :size="14" />PDF ügyfélkarton</button></div>
          <div v-for="r in g.list" :key="r.id" class="rec">
            <div class="row">
              <b>{{ r.time }}</b><span>{{ doctorName(db, r.doctorId) }}</span>
              <span class="badge b-gray">{{ typeNames(db, r.typeIds) || 'kezelés' }}</span>
              <span v-for="t in r.teeth" :key="t" class="tchip">{{ teethStr([t], r.surfaces) }}</span>
              <span v-if="r.extended" class="badge b-yellow" :title="r.planned ? 'Tervezett: ' + teethStr(r.planned.teeth, r.planned.surfaces) : ''">kezelés közben bővítve</span>
              <div class="spacer" />
              <span v-if="r.fee" class="muted small">{{ fmtFt(r.fee) }}</span>
              <button class="btn sm" @click="edit(r.id)">Szerkesztés</button>
            </div>
            <div v-if="r.planned?.teeth.length" class="small muted" style="margin-top:4px">Tervezett: {{ teethStr(r.planned.teeth, r.planned.surfaces) }} · kezelt: {{ teethStr(r.teeth, r.surfaces) }}</div>
            <p>{{ r.text || '(nincs leírás)' }}</p>
            <div class="mats">Felhasznált anyagok: {{ r.materials.length ? r.materials.map(m => `${db.items.find(i => i.id === m.item)?.name || '?'} ${m.qty} ${db.items.find(i => i.id === m.item)?.unit || ''}`).join(' · ') : '–' }}</div>
            <div v-if="attsOf(r.id).length" class="att-list">
              <AttachmentCard v-for="a in attsOf(r.id)" :key="a.id" :a="a" @open="ui.open(AttachmentViewer, { id: a.id })" />
            </div>
          </div>
        </div>
      </template>
      <p v-else class="muted">Még nincs rögzített kezelés.</p>
    </div>
  </div>
  <div v-else class="card">Nincs ilyen páciens. <NuxtLink to="/paciensek">Vissza a páciensekhez</NuxtLink></div>
</template>

<style scoped>
@media (max-width: 1000px) { .cardgrid { grid-template-columns: 1fr !important } }
</style>
