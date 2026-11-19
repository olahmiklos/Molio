<script setup lang="ts">
// Ügyfélkarton: alapadatok, egészségügyi figyelmeztetés, belső megjegyzés, fogazat, fogtérkép, kezelési előzmények
import { useDataStore } from '~/stores/data'
import { usePatientStore } from '~/stores/patient'
import { useTreatmentStore } from '~/stores/treatment'
import { useUiStore } from '~/stores/ui'
import { esc, fmtBirth, fmtDate, fmtFt, fmtLong, today } from '~/utils/dates'
import type { Dentition } from '~/utils/types'
import { doctorName, suggestBufferFlag, typeNames } from '~/utils/logic'
import { teethStr } from '~/utils/teeth'
import { STATUS_STYLE } from '~/utils/defaults'
import PatientFormModal from '~/components/modals/PatientFormModal.vue'
import BookingModal from '~/components/modals/BookingModal.vue'
import AttachmentViewer from '~/components/modals/AttachmentViewer.vue'
import PatientInfoModal from '~/components/modals/PatientInfoModal.vue'
import EesztModal from '~/components/modals/EesztModal.vue'
import InvoiceModal from '~/components/modals/InvoiceModal.vue'
import ConsentModal from '~/components/modals/ConsentModal.vue'
import { useOfficeStore } from '~/stores/office'
import { tracedFor } from '~/utils/stock'
import { nextRecall } from '~/utils/office'
import { useSuggestionStore } from '~/stores/suggestion'
import { useAppointmentStore } from '~/stores/appointment'
import AppointmentModal from '~/components/modals/AppointmentModal.vue'
import SuggestionModal from '~/components/modals/SuggestionModal.vue'
import { isOverdue, sugFee, sugTotal, SUG_STATUS, URGENCY } from '~/utils/suggest'
import { apptPrice } from '~/utils/logic'

const route = useRoute()
const data = useDataStore()
const patients = usePatientStore()
const tx = useTreatmentStore()
const ui = useUiStore()
const pdf = usePdf()
const office = useOfficeStore()
const sugs = useSuggestionStore()
const ap = useAppointmentStore()
const db = computed(() => data.db)
const id = computed(() => String(route.params.id))
const p = computed(() => patients.byId(id.value))
const recs = computed(() => patients.recordsOf(id.value))
/* ---------- Kezelések almenü: következő és korábbi (13. pont) ---------- */
const fText = ref(''), fType = ref(''), fDoc = ref(''), fFrom = ref(''), fTo = ref('')
const filtered = computed(() => recs.value.filter(r =>
  (!fType.value || r.typeIds.includes(fType.value) || r.items?.some(i => i.typeId === fType.value)) && (!fDoc.value || r.doctorId === fDoc.value) &&
  (!fFrom.value || r.date >= fFrom.value) && (!fTo.value || r.date <= fTo.value) &&
  (!fText.value.trim() || (r.text + ' ' + typeNames(db.value, r.typeIds) + ' ' + r.teeth.join(' ')).toLowerCase().includes(fText.value.trim().toLowerCase()))))
const pending = computed(() => sugs.pending(id.value))
const tname = (tid: string) => db.value.types.find(x => x.id === tid)?.name || tid
const plannedLine = (a: { items?: { tooth: number | null; typeId: string }[]; typeIds: string[] }) =>
  a.items?.length ? a.items.map(i => (i.tooth ? i.tooth + ': ' : '') + tname(i.typeId)).join(' · ') : typeNames(db.value, a.typeIds)
const ORIGIN_B: Record<string, [string, string]> = { planned: ['előjegyzett', 'b-blue'], added: ['hozzáadva', 'b-yellow'], manual: ['', ''] }
const byDay = computed(() => {
  const m: Record<string, typeof recs.value> = {}
  filtered.value.forEach(r => { (m[r.date] = m[r.date] || []).push(r) })
  return Object.keys(m).sort().reverse().map(d => ({ d, list: m[d]!.sort((a, b) => a.time.localeCompare(b.time)) }))
})
const upcoming = computed(() => patients.upcoming(id.value))
const suggested = computed(() => (p.value ? patients.suggestedDentition(p.value.birth) : 'permanent'))
const statuses = computed(() => (p.value ? p.value.statuses.slice().sort((a, b) => b.date.localeCompare(a.date)) : []))
const sessHere = computed(() => tx.active && tx.s?.patientId === id.value)
const attsOf = (rid: string) => db.value.attachments.filter(a => a.recordId === rid)
const implants = computed(() => tracedFor(db.value, id.value, true))
const recall = computed(() => nextRecall(db.value, id.value))
const consents = computed(() => office.consentsOf(id.value))
const INFO: Record<string, [string, string]> = { draft: ['tájékoztató: jóváhagyásra vár', 'b-yellow'], approved: ['tájékoztató: jóváhagyva', 'b-green'], sent: ['tájékoztató elküldve', 'b-blue'] }
const lotsLine = (r: { materials: { item: string; lots?: { lot: string }[] }[] }) => r.materials.filter(m => m.lots?.length).map(m => `${db.value.items.find(i => i.id === m.item)?.name.split(' ')[0] || ''}: ${m.lots!.map(l => l.lot).join(', ')}`).join(' · ')

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
          <div>Kontroll</div>
          <div><template v-if="recall">{{ recall.typeName }}: <b :style="recall.due <= today() ? 'color:var(--red)' : ''">{{ fmtDate(recall.due) }}</b><span v-if="recall.due <= today()" class="badge b-red" style="margin-left:4px">esedékes</span></template><span v-else class="muted">–</span></div>
          <div>Következő időpont</div>
          <div><template v-if="upcoming.length"><div v-for="a in upcoming.slice(0, 3)" :key="a.id" style="cursor:pointer;color:var(--blue-d)" title="Megnyitás a Kezelések között" @click="ui.open(AppointmentModal, { id: a.id })">{{ fmtDate(a.date) }} {{ a.start }} · {{ doctorName(db, a.doctorId) }} · {{ typeNames(db, a.typeIds) }}<span v-if="a.buffer" class="badge b-buf" style="margin-left:4px">+{{ a.buffer }}'</span></div></template><span v-else>–</span></div>
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

    <div v-if="implants.length || consents.length" class="cardgrid2">
      <div v-if="implants.length" class="card">
        <h2>Beültetett implantátumok</h2>
        <table class="t"><thead><tr><th>Dátum</th><th>Fog</th><th>Implantátum</th><th>Gyártási szám (LOT)</th></tr></thead><tbody>
          <tr v-for="(m, i) in implants" :key="i"><td class="nowrap">{{ fmtDate(m.date) }}</td><td>{{ m.teeth.join(', ') }}</td><td>{{ m.item.name }}</td><td class="nowrap"><b>{{ m.lot }}</b></td></tr>
        </tbody></table>
        <p class="small muted" style="margin:6px 0 0">Gyártói visszahívásnál a Raktár → Lejárat és nyomon követés lapon a LOT-ra keresve megjelenik a páciens.</p>
      </div>
      <div v-if="consents.length" class="card">
        <h2>Aláírt nyilatkozatok</h2>
        <div v-for="c in consents" :key="c.id" class="row small" style="padding:6px 0;border-bottom:1px solid #eef1f3">
          <span class="badge b-green">✓</span><b>{{ c.title }}</b><span class="muted">{{ new Date(c.signedAt).toLocaleString('hu-HU') }}</span>
          <div class="spacer" /><button class="btn sm" @click="ui.open(AttachmentViewer, { id: c.attachmentId })">PDF</button>
        </div>
      </div>
    </div>

    <div class="card" id="kezelesek">
      <div class="row" style="margin-bottom:6px"><h2 style="margin:0">Kezelések</h2><div class="spacer" /><button class="btn pri sm" @click="ui.open(BookingModal, { patientId: p.id })"><AppIcon name="plus" :size="14" />Új időpont / kezelés előjegyzése</button></div>
      <h3>Következő kezelések</h3>
      <div v-for="a in upcoming" :key="a.id" class="rec" style="cursor:pointer" @click="ui.open(AppointmentModal, { id: a.id })">
        <div class="row">
          <b>{{ fmtDate(a.date) }} {{ a.start }}</b><span>{{ doctorName(db, a.doctorId) }}</span><span class="badge b-blue">előjegyzett</span>
          <span v-if="a.cancelSignal" class="badge b-red">lemondást jelzett</span>
          <div class="spacer" /><span class="muted small">becsült díj: {{ fmtFt(apptPrice(db, a)) }}</span>
          <button class="btn sm" @click.stop="ui.open(BookingModal, { editId: a.id })">Szerkesztés</button>
        </div>
        <div class="small" style="margin-top:4px">{{ plannedLine(a) }}</div>
      </div>
      <div v-for="g in pending" :key="g.id" class="rec" style="cursor:pointer;border-left:3px solid var(--orange)" @click="ui.open(SuggestionModal, { id: g.id })">
        <div class="row">
          <b>{{ tname(g.typeId) }}{{ g.tooth ? ' · ' + g.tooth + '-es fog' : '' }}</b><span class="badge" :class="URGENCY[g.urgency].cls">{{ URGENCY[g.urgency].label }}</span>
          <span class="badge" :class="SUG_STATUS[g.status].cls">{{ SUG_STATUS[g.status].label }}</span>
          <span v-if="g.due" class="small" :style="isOverdue(g) ? 'color:var(--red);font-weight:700' : ''">határidő: {{ fmtDate(g.due) }}</span>
          <div class="spacer" /><span class="muted small">becsült díj: {{ fmtFt(sugFee(db, g)) }}</span>
          <button class="btn sm go" @click.stop="ui.open(BookingModal, { suggestionIds: [g.id] })">Időpont</button>
        </div>
        <div class="small muted" style="margin-top:2px">javasolt kezelés – még nincs időpont{{ g.note ? ' · ' + g.note : '' }}</div>
      </div>
      <p v-if="!upcoming.length && !pending.length" class="muted small" style="margin-top:0">Nincs előjegyzett vagy javasolt kezelés.</p>
      <div v-if="pending.length" class="small muted" style="margin:0 0 8px">Javasolt, még be nem ütemezett kezelések becsült díja összesen: <b>{{ fmtFt(sugTotal(db, pending)) }}</b></div>
      <h3 style="margin-top:16px">Korábbi kezelések</h3>
      <div class="row" style="margin-bottom:10px">
        <input v-model="fText" class="inp" style="max-width:200px" placeholder="Keresés a leírásban…">
        <select v-model="fType" class="inp auto"><option value="">minden kezelés</option><option v-for="t in db.types" :key="t.id" :value="t.id">{{ t.name }}</option></select>
        <select v-model="fDoc" class="inp auto"><option value="">minden orvos</option><option v-for="d in db.doctors" :key="d.id" :value="d.id">{{ d.name }}</option></select>
        <input v-model="fFrom" class="inp auto" type="date" title="-tól"><input v-model="fTo" class="inp auto" type="date" title="-ig">
      </div>
      <template v-if="byDay.length">
        <div v-for="g in byDay" :key="g.d" class="day-grp">
          <div class="dh">{{ fmtLong(g.d) }} <span class="muted small" style="font-weight:500">{{ g.list.length }} kezelés</span><div class="spacer" />
            <button v-if="g.list.some(r => r.fee)" class="btn sm" :class="{ pri: !office.invoiceFor(p.id, g.d) }" @click="ui.open(InvoiceModal, { patientId: p.id, date: g.d })">{{ office.invoiceFor(p.id, g.d) ? '🧾 ' + office.invoiceFor(p.id, g.d)!.no : '🧾 Számla előkészítése' }}</button>
            <button class="btn sm" @click="pdf.download(p.id, g.d)"><AppIcon name="download" :size="14" />PDF ügyfélkarton</button></div>
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
            <div v-if="r.items?.length" class="small" style="margin-top:6px">
              <span v-for="i in r.items" :key="i.id" class="tchip" :style="i.state === 'postponed' ? 'opacity:.55;text-decoration:line-through' : ''" :title="i.state === 'postponed' ? 'elhalasztva' : ''">
                {{ i.tooth ? i.tooth + ': ' : '' }}{{ tname(i.typeId) }}<template v-if="ORIGIN_B[i.origin]![0]"> · {{ ORIGIN_B[i.origin]![0] }}</template><template v-if="i.fee && i.state === 'done'"> · {{ fmtFt(i.fee) }}</template>
              </span>
            </div>
            <div v-if="r.planned?.teeth.length" class="small muted" style="margin-top:4px">Tervezett: {{ teethStr(r.planned.teeth, r.planned.surfaces) }} · kezelt: {{ teethStr(r.teeth, r.surfaces) }}</div>
            <p>{{ r.text || '(nincs leírás)' }}</p>
            <div class="row small" style="margin:6px 0 2px;gap:6px">
              <button class="badge as-btn" :class="r.eeszt?.status === 'sent' ? 'b-green' : 'b-yellow'" @click="ui.open(EesztModal, { recordId: r.id })">EESZT: {{ r.eeszt?.status === 'sent' ? 'beküldve' : 'beküldésre vár' }}</button>
              <button class="badge as-btn" :class="INFO[r.patientInfo?.status || 'draft']![1]" @click="ui.open(PatientInfoModal, { recordId: r.id })">{{ r.patientInfo ? INFO[r.patientInfo.status]![0] : 'tájékoztató készítése' }}</button>
              <span v-if="r.sterBatch" class="badge b-gray" title="Sterilizálási tétel">♨ {{ r.sterBatch }}</span>
              <button v-if="!db.consents.some(c => c.recordId === r.id) && r.typeIds.some(t => ['tomes', 'gyoker', 'huzas', 'korona', 'implant'].includes(t))" class="badge as-btn b-gray" @click="ui.open(ConsentModal, { patientId: p.id, recordId: r.id, typeIds: r.typeIds, teeth: r.teeth, doctorId: r.doctorId })">✍ nyilatkozat aláíratása</button>
              <span v-if="r.materials.some(m => m.cost)" class="muted">anyagköltség: {{ fmtFt(r.materials.reduce((s, m) => s + (m.cost || 0), 0)) }}</span>
            </div>
            <div v-if="lotsLine(r)" class="small muted">LOT: {{ lotsLine(r) }}</div>
            <div v-if="r.editLog?.length" class="small muted">Utólag módosítva: {{ r.editLog.map(e => e.at + (e.by ? ' · ' + e.by : '')).join('; ') }}</div>
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
.cardgrid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 18px }
.as-btn { border: 0; cursor: pointer; font-family: inherit; line-height: 1.4 }
</style>
