<script setup lang="ts">
// Időpontfoglalás és -módosítás: ütközés, hétvége, rendelési időn kívüli időpont, ráhagyás, kockázatbecslés
import { useDataStore } from '~/stores/data'
import { useAppointmentStore } from '~/stores/appointment'
import { usePatientStore } from '~/stores/patient'
import { useUiStore } from '~/stores/ui'
import { DAYS, dow, esc, fmtBirth, fmtDate, fmtLong, fmtShort, fromMin, norm, toMin, today } from '~/utils/dates'
import type { Planned, PlannedItem, RemindChoice } from '~/utils/types'
import { useSuggestionStore } from '~/stores/suggestion'
import { bufferFor, feeFor, itemFee, riskFor, suggestBufferFlag } from '~/utils/logic'
import { freeSlots, overlaps, slotsList } from '~/utils/calendar'
import { analyze } from '~/utils/parser'
import { allTeeth, teethStr } from '~/utils/teeth'
import type { PatientDraft } from '../PatientFields.vue'

const props = defineProps<{ editId?: string; patientId?: string; date?: string; start?: string; doctorId?: string; typeId?: string; suggestionIds?: string[] }>()
const data = useDataStore()
const ap = useAppointmentStore()
const patients = usePatientStore()
const ui = useUiStore()
const sugs = useSuggestionStore()
const db = computed(() => data.db)
const ed = props.editId ? ap.byId(props.editId) : undefined

const patientId = ref<string | null>(ed?.patientId || props.patientId || sugs.byId(props.suggestionIds?.[0] || '')?.patientId || null)
const q = ref('')
const newP = ref(false)
const draft = ref<PatientDraft>({ name: '', birth: '', taj: '', phone: '', email: '', address: '', healthWarning: '', internalNote: '', needsBuffer: false, dentition: 'permanent' })
const sgList = (props.suggestionIds || []).map(i => sugs.byId(i)).filter((x): x is NonNullable<typeof x> => !!x)
const types = ref<string[]>(ed ? [...ed.typeIds] : sgList.length ? [...new Set(sgList.map(g => g.typeId))] : props.typeId ? [props.typeId] : [])
const doctorId = ref(ed?.doctorId || props.doctorId || db.value.doctors[0]!.id)
const date = ref(ed?.date || props.date || ap.defaultBookingDate())
const start = ref(ed?.start || props.start || fromMin(db.value.settings.startHour * 60))
const dur = ref(ed?.dur || 30)
const durManual = ref(!!ed)
const buffer = ref(ed?.buffer || 0)
const bufManual = ref(!!ed)
const note = ref(ed?.note || '')
const plannedText = ref(ed?.planned ? teethStr(ed.planned.teeth, ed.planned.surfaces) : sgList.filter(g => g.tooth).map(g => g.tooth + ' ' + g.surfaces.join('')).join(', '))
const warnedKey = ref('')
const msgEl = ref<HTMLElement | null>(null)
const rem = ref<RemindChoice>(ed ? { ...ed.remind } : { sms: db.value.settings.notify.sms, email: db.value.settings.notify.email, timing: db.value.settings.notify.timing })
const msg = ref('')

const patient = computed(() => (patientId.value ? patients.byId(patientId.value) : null))
watch(patientId, id => { if (!id || ed) return; const p = patients.byId(id); if (p) rem.value = { ...p.remind, timing: db.value.settings.notify.timing } })
if (patientId.value && !ed) { const p = patients.byId(patientId.value); if (p) rem.value = { ...p.remind, timing: db.value.settings.notify.timing } }

const hits = computed(() => {
  const s = norm(q.value.trim()); if (s.length < 2) return []
  return db.value.patients.filter(p => norm(p.name).includes(s) || p.phone.replace(/\s/g, '').includes(s.replace(/\s/g, '')) || p.taj.replace(/\s/g, '').includes(s.replace(/\s/g, '')))
})
function startNew() { newP.value = true; draft.value.name = q.value.trim() }
const lastRec = (pid: string) => patients.lastRecord(pid)

const DURS = [30, 60, 90, 120, 150, 180, 210, 240, 300]
const typeSum = computed(() => types.value.reduce((s, id) => s + (db.value.types.find(t => t.id === id)?.dur || 0), 0))
watch(types, () => {
  if (!durManual.value && typeSum.value) dur.value = DURS.find(x => x >= typeSum.value) || 300
  if (!bufManual.value) buffer.value = bufferFor(db.value, types.value, patient.value || (newP.value ? { needsBuffer: draft.value.needsBuffer } as never : null))
}, { deep: true })
watch([patient, () => draft.value.needsBuffer], () => { if (!bufManual.value) buffer.value = bufferFor(db.value, types.value, patient.value || (newP.value ? { needsBuffer: draft.value.needsBuffer } as never : null)) })
function toggleType(id: string) { types.value = types.value.includes(id) ? types.value.filter(t => t !== id) : [...types.value, id] }

const needsPlan = computed(() => types.value.some(id => db.value.types.find(t => t.id === id)?.needsSurface))
const planned = computed<Planned | null>(() => {
  if (!plannedText.value.trim()) return null
  const r = analyze(plannedText.value, db.value)
  return r.teeth.length ? { teeth: r.teeth, surfaces: r.surfaces } : null
})
/** előjegyzett tételek (2. pont): fog × művelet; a tervezett fogakból és a kezelésekből áll össze, kézzel szerkeszthető */
const items = ref<PlannedItem[]>(ed?.items ? ed.items.map(i => ({ ...i, surfaces: [...i.surfaces] })) : [])
const itemsManual = ref(!!ed?.items?.length)
const isBound = (id: string) => !!db.value.types.find(t => t.id === id)?.toothBound
function autoItems() {
  if (itemsManual.value) return
  const out: PlannedItem[] = []
  types.value.forEach(tid => {
    if (isBound(tid) && planned.value?.teeth.length) planned.value.teeth.forEach(n => out.push({ tooth: n, typeId: tid, surfaces: [...(planned.value!.surfaces[n] || [])] }))
    else out.push({ tooth: null, typeId: tid, surfaces: [] })
  })
  items.value = out
}
watch([types, planned], autoItems, { deep: true, immediate: true })
const newItemTooth = ref<number | ''>(''), newItemType = ref('')
function addItem() { if (!newItemType.value) return; itemsManual.value = true; items.value.push({ tooth: isBound(newItemType.value) && newItemTooth.value ? Number(newItemTooth.value) : null, typeId: newItemType.value, surfaces: [] }); if (!types.value.includes(newItemType.value)) types.value.push(newItemType.value); newItemType.value = '' }
function rmItem(i: number) { itemsManual.value = true; items.value.splice(i, 1) }
const tName = (id: string) => db.value.types.find(t => t.id === id)?.name || id
const fee = computed(() => (items.value.length ? items.value.reduce((s, i) => s + itemFee(db.value, i.typeId, i.surfaces), 0) : feeFor(db.value, types.value, planned.value?.teeth || [], planned.value?.surfaces)))
const slots = computed(() => slotsList(db.value))
const free = computed(() => freeSlots(db.value, doctorId.value, dur.value, buffer.value, 10, props.editId))
const ov = computed(() => (date.value && start.value ? overlaps(db.value, doctorId.value, date.value, start.value, dur.value, buffer.value, props.editId) : undefined))
const lateEnd = computed(() => toMin(start.value) + dur.value > db.value.settings.endHour * 60)
const bufOver = computed(() => !lateEnd.value && toMin(start.value) + dur.value + buffer.value > db.value.settings.endHour * 60)
const risk = computed(() => (patientId.value && date.value ? riskFor(db.value, { patientId: patientId.value, date: date.value, start: start.value, created: today(), remind: rem.value }) : null))
const suggestFlag = computed(() => (patient.value ? suggestBufferFlag(db.value, patient.value) : false))
const ovName = computed(() => (ov.value ? db.value.patients.find(p => p.id === ov.value!.patientId)?.name : ''))

watch(msg, v => { if (v) nextTick(() => msgEl.value?.scrollIntoView({ block: 'center', behavior: 'smooth' })) })
function pick(d: string, m: string) { date.value = d; start.value = m }
function flagPatient() { if (patient.value) { patients.update(patient.value.id, { needsBuffer: true }); bufManual.value = false; buffer.value = bufferFor(db.value, types.value, patient.value); ui.toast('A páciens kartonján bekapcsolva: ráhagyást igényel') } }

async function save() {
  msg.value = ''
  let pid = patientId.value
  if (!pid) {
    if (!newP.value) { msg.value = 'Válassz pácienst, vagy vedd fel újként.'; return }
    const d = draft.value
    if (!d.name.trim() || !d.birth || !d.phone.trim()) { msg.value = 'Az új páciensnél a név, a születési dátum és a telefonszám kötelező.'; return }
    const dup = patients.findDuplicate(d.name, d.birth)
    if (dup) { msg.value = `Már van ilyen páciens: ${dup.name} (szül. ${fmtBirth(dup.birth)}). Válaszd ki a keresőből.`; return }
    if (rem.value.email && !d.email.trim()) { msg.value = 'E-mail emlékeztetőhöz add meg az e-mail címet, vagy kapcsold ki az e-mailt.'; return }
    const np = patients.create({ ...d, name: d.name.trim(), phone: d.phone.trim(), email: d.email.trim(), remind: { sms: rem.value.sms, email: rem.value.email } })
    pid = np.id; patientId.value = pid; newP.value = false
  }
  const pp = patients.byId(pid)!
  if (rem.value.email && !pp.email) { msg.value = 'E-mail emlékeztetőhöz add meg a páciens e-mail címét (karton → Adatok szerkesztése), vagy kapcsold ki az e-mailt.'; return }
  pp.remind = { sms: rem.value.sms, email: rem.value.email }
  if (!types.value.length) { msg.value = 'Válassz legalább egy kezelést.'; return }
  if (!date.value) { msg.value = 'Add meg a dátumot.'; return }
  if (dow(date.value) > 5) { msg.value = 'Hétvégére nem lehet foglalni.'; return }
  if (lateEnd.value) { msg.value = 'A kezelés a rendelési idő után érne véget.'; return }
  if (bufOver.value) { msg.value = 'A ráhagyás a rendelési idő után érne véget – rövidítsd vagy hagyd el.'; return }
  const conflict = ov.value
  if (conflict) {
    // ütközésnél nem tiltjuk a mentést: egyszer figyelmeztetünk, aztán a döntés az asszisztensé (6. pont)
    const key = [doctorId.value, date.value, start.value, dur.value, buffer.value].join('|')
    const ok = await ui.confirm(`Ez az időpont ütközik: <b>${esc(ovName.value || '')}</b> ${conflict.start}–${fromMin(toMin(conflict.start) + conflict.dur)}. Mentsd így, vagy menj vissza és válassz másik időpontot.`, 'Mentés ütközéssel', false, 'Vissza')
    warnedKey.value = key
    if (!ok) return
  }
  const body = { patientId: pid, doctorId: doctorId.value, date: date.value, start: start.value, dur: dur.value, buffer: buffer.value, typeIds: [...types.value], note: note.value.trim(), remind: { ...rem.value }, planned: planned.value, items: items.value.map(i => ({ ...i, surfaces: [...i.surfaces] })) }
  let savedId = ed?.id || ''
  if (ed) { const old = `${fmtDate(ed.date)} ${ed.start}`; ap.update(ed.id, body); ui.toast(`Időpont módosítva: ${old} → ${fmtDate(date.value)} ${start.value}`) }
  else { const na = ap.create(body); savedId = na.id; ui.toast(`Időpont lefoglalva: ${fmtDate(date.value)} ${start.value}`) }
  if (sgList.length && savedId) sugs.book(sgList.map(g => g.id), savedId)
  if (conflict) ui.toast(`Mentve – ütközik: ${ovName.value} ${conflict.start}`)
  ap.calDate = date.value
  ui.close()
}
</script>

<template>
  <ModalShell :title="ed ? 'Időpont módosítása' : 'Új időpont'" wide>
    <div v-if="ed" class="hint">Eredeti időpont: <b>{{ fmtLong(ed.date) }}, {{ ed.start }}–{{ fromMin(toMin(ed.start) + ed.dur) }}</b>. Válassz új dátumot és kezdést, vagy kattints egy szabad időpontra lent.</div>
    <div class="field">
      <label class="f">Páciens</label>
      <div v-if="patient" class="row">
        <span class="chip static on">{{ patient.name }}</span>
        <span class="muted small">szül. {{ fmtBirth(patient.birth) }} · {{ patient.phone }}{{ lastRec(patient.id) ? ' · utolsó kezelés: ' + fmtDate(lastRec(patient.id)!.date) : '' }}</span>
        <HealthWarning :text="patient.healthWarning" compact />
        <button v-if="!ed" class="btn sm" @click="patientId = null">Másik páciens</button>
      </div>
      <template v-else-if="!newP">
        <input v-model="q" class="inp" placeholder="Kezdd el gépelni a nevet, telefonszámot vagy TAJ-t…" autocomplete="off">
        <div v-if="q.trim().length >= 2" class="sugg">
          <div v-for="p in hits" :key="p.id" @click="patientId = p.id"><b>Már volt nálunk:</b> {{ p.name }} <span class="muted">(szül. {{ fmtBirth(p.birth) }}){{ lastRec(p.id) ? ' – utolsó kezelés: ' + fmtDate(lastRec(p.id)!.date) : '' }}</span></div>
          <div style="color:var(--blue);font-weight:700" @click="startNew">+ Új páciensként veszem fel: „{{ q.trim() }}”</div>
        </div>
      </template>
      <div v-else class="card" style="margin:0;background:#fbfdfd;box-shadow:none;border:1px solid var(--line)">
        <PatientFields v-model="draft" is-new />
        <button class="btn sm" @click="newP = false">Mégse, keresek</button>
      </div>
    </div>
    <div v-if="suggestFlag" class="warn row">
      <span>{{ patient!.name }} az elmúlt 12 hónapban többször késett. Bekapcsolod a kartonján a „ráhagyást igényel” jelölést?</span>
      <button class="btn sm" @click="flagPatient">Bekapcsolom</button>
    </div>
    <div class="field">
      <label class="f">Emlékeztetőt kér? <span class="n">(kérdezd meg a pácienst)</span></label>
      <div class="row">
        <label class="chip" :class="{ on: rem.sms }" @click.prevent="rem.sms = !rem.sms">📱 SMS</label>
        <label class="chip" :class="{ on: rem.email }" @click.prevent="rem.email = !rem.email">✉ E-mail</label>
        <select v-model="rem.timing" class="inp auto">
          <option value="24">24 órával előtte</option><option value="48">48 órával előtte</option><option value="24+2">24 és 2 órával előtte</option>
        </select>
      </div>
    </div>
    <div class="field">
      <label class="f">Kezelés (több is választható)</label>
      <div class="row">
        <span v-for="t in db.types" :key="t.id" class="chip" :class="{ on: types.includes(t.id) }" @click="toggleType(t.id)">{{ t.name }} <span class="small" style="opacity:.7">{{ t.dur }}'{{ t.buffer ? ` +${t.buffer}'` : '' }}</span></span>
      </div>
    </div>
    <div v-if="needsPlan" class="field">
      <label class="f">Tervezett fog és felszín <span class="n">(pl. „36 M”, „46 MOD”, „jobb felső hatos meziális”)</span></label>
      <div class="row">
        <input v-model="plannedText" class="inp" style="max-width:320px" placeholder="36 M">
        <span v-if="planned" class="row" style="gap:4px"><span v-for="t in planned.teeth" :key="t" class="tchip">{{ teethStr([t], planned.surfaces) }}</span></span>
        <span v-else-if="plannedText.trim()" class="small" style="color:var(--orange)">nem ismerhető fel fogként</span>
      </div>
    </div>
    <div v-if="items.length || types.length" class="field">
      <label class="f">Előjegyzett tételek <span class="n">(fog × művelet; kezeléskor ezek jelennek meg kék jelöléssel)</span></label>
      <div v-for="(i, k) in items" :key="k" class="row" style="padding:4px 0">
        <span class="tchip" style="min-width:48px;text-align:center">{{ i.tooth ?? '–' }}</span><span>{{ tName(i.typeId) }}</span>
        <span v-if="i.surfaces.length" class="small muted">({{ i.surfaces.join('') }})</span>
        <button class="btn sm" @click="rmItem(k)">×</button>
      </div>
      <div class="row" style="margin-top:6px">
        <select v-model="newItemTooth" class="inp auto"><option value="">fog…</option><option v-for="n in allTeeth('permanent')" :key="n" :value="n">{{ n }}</option></select>
        <select v-model="newItemType" class="inp auto"><option value="">művelet…</option><option v-for="t in db.types" :key="t.id" :value="t.id">{{ t.name }}</option></select>
        <button class="btn sm" @click="addItem">+ Tétel</button>
      </div>
    </div>
    <div class="grid3">
      <div class="field"><label class="f">Orvos</label><select v-model="doctorId" class="inp"><option v-for="dc in db.doctors" :key="dc.id" :value="dc.id">{{ dc.name }}</option></select></div>
      <div class="field"><label class="f">Dátum</label><input v-model="date" class="inp" type="date"></div>
      <div class="field"><label class="f">Kezdés</label><select v-model="start" class="inp"><option v-for="m in slots" :key="m" :value="fromMin(m)">{{ fromMin(m) }}</option></select></div>
    </div>
    <div class="grid3">
      <div class="field">
        <label class="f">Időtartam</label>
        <select v-model.number="dur" class="inp" @change="durManual = true"><option v-for="m in DURS" :key="m" :value="m">{{ m }} perc</option></select>
        <div v-if="types.length > 1" class="small muted">összesen {{ typeSum }} perc – párhuzamos munkánál rövidebb is lehet</div>
      </div>
      <div class="field">
        <label class="f">Ráhagyás utána</label>
        <select v-model.number="buffer" class="inp" @change="bufManual = true"><option :value="0">nincs</option><option :value="30">30 perc</option><option :value="60">60 perc</option></select>
        <div class="small muted">kezeléstípus vagy páciens szerint; rövidíthető</div>
      </div>
      <div class="field"><label class="f">Megjegyzés az időponthoz</label><input v-model="note" class="inp" placeholder="pl. erős fájdalommal érkezik"></div>
    </div>
    <div class="field">
      <label class="f">Legközelebbi szabad időpontok ennél az orvosnál <span class="n">(a ráhagyással együtt)</span></label>
      <div class="free">
        <button v-for="[fd, fm] in free" :key="fd + fm" :class="{ on: fd === date && fm === start }" @click="pick(fd, fm)">{{ fmtShort(fd) }} {{ DAYS[dow(fd) - 1]!.slice(0, 3) }}. {{ fm }}</button>
        <span v-if="!free.length" class="muted">Nincs szabad időpont a következő 2 hónapban.</span>
      </div>
    </div>
    <div v-if="risk" :class="risk.level === 'high' ? 'err' : risk.level === 'mid' ? 'warn' : 'hint'">
      <b>Meg nem jelenés becsült kockázata:</b> <RiskBadge :risk="risk" /> <span class="small">{{ risk.factors.join(' · ') || 'nincs kockázati tényező' }}</span>
      <template v-if="risk.level === 'high'"><br>Javaslat: kérj SMS-t és e-mailt is, és jelezd, hogy egy nappal előtte telefonon is megerősítjük.</template>
    </div>
    <div v-if="ov" class="warn">Ez az időpont ütközik: {{ ovName }} {{ ov.start }}–{{ fromMin(toMin(ov.start) + ov.dur) }}{{ ov.buffer ? ` (+${ov.buffer}' ráhagyás)` : '' }}. Mentheted ütközéssel is, a naptárban jelölve marad.</div>
    <div v-else-if="lateEnd" class="warn">A kezelés a rendelési idő ({{ db.settings.endHour }}:00) után érne véget.</div>
    <div v-else-if="bufOver" class="warn">A ráhagyás a rendelési idő után érne véget.</div>
    <div v-else-if="date && dow(date) > 5" class="warn">Hétvégén nincs rendelés.</div>
    <div v-if="msg" ref="msgEl" class="err">{{ msg }}</div>
    <template #foot>
      <span class="muted small">Díj: <b>{{ fee.toLocaleString('hu-HU') }} Ft</b></span>
      <div class="spacer" />
      <button class="btn" @click="ui.close()">Mégse</button>
      <button class="btn pri" @click="save">{{ ed ? 'Módosítás mentése' : 'Foglalás' }}</button>
    </template>
  </ModalShell>
</template>
