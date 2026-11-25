<script setup lang="ts">
// Beállítások → Klinika → Beosztás (spec v2.4 21. pont): vizuális, egyszerű beosztáskezelő pasztell színekkel.
// Három rész: Rendelő (alaprajz – a v2.4-ben kész minta: rendelőszoba íróasztallal és számítógéppel, fogorvosi székkel és röntgengéppel; váróterem; recepciós pult),
// Orvosok és asszisztensek (felvétel, szín, rendelő, hozzárendelt asszisztens, heti sablon, napi eltérés, asszisztens-beosztás), Recepció (recepciósok, sablon, eltérés, lefedettség).
// A foglalás a beosztáshoz kötött (a naptár és a foglaló ablak ellenőrzi); a beosztás módosítása a meglévő időpontokat nem törli és nem mozdítja el.
import { useDataStore } from '~/stores/data'
import { useUiStore } from '~/stores/ui'
import { addDays, DAYS, dow, esc, fmtShort, today, uid } from '~/utils/dates'
import { recordForAppt } from '~/utils/logic'
import type { Period, WeekTpl } from '~/utils/types'
import { affectedBy, assistantClashes, assistantsOn, defaultDoctorTpl, defaultReceptionTpl, doctorTpl, DOC_COLORS, GRID, hasOverride, PASTEL, periodsOn, periodsText, receptionGaps, receptionTpl, weekText } from '~/utils/schedule'
import WeekTplEditor from './WeekTplEditor.vue'

const data = useDataStore(), ui = useUiStore()
const db = computed(() => data.db)
const sch = computed(() => db.value.schedule!)
const staff = computed(() => db.value.staff!)
const part = ref<'plan' | 'docs' | 'rec'>('plan')
const date = ref(today())
const weekStart = computed(() => addDays(date.value, 1 - dow(date.value)))
const week = computed(() => Array.from({ length: 14 }, (_, i) => addDays(weekStart.value, i)))
const isDone = (a: { id: string }) => !!recordForAppt(db.value, a.id)
const docName = (id: string) => db.value.doctors.find(d => d.id === id)?.name || id
const asName = (id: string) => staff.value.assistants.find(a => a.id === id)?.name || id
const pastel = (i: number) => PASTEL[i % PASTEL.length]

/* ---------- módosítás az érintett időpontok jelzésével ---------- */
async function applyChange(apply: (s: NonNullable<typeof db.value.schedule>) => void, what: string): Promise<boolean> {
  const hit = affectedBy(db.value, apply, isDone)
  if (hit.length && !(await ui.confirm(`Ez <b>${hit.length} meglévő időpontot</b> érint (${hit.slice(0, 4).map(a => esc(fmtShort(a.date) + ' ' + a.start)).join(', ')}${hit.length > 4 ? '…' : ''}). Az időpontok megmaradnak, a naptárban jelölést kapnak, és „Időpont a beosztáson kívül” teendő keletkezik. Folytatod?`, 'Módosítás', false, 'Vissza'))) return false
  apply(sch.value); ui.toast(what + (hit.length ? ` – ${hit.length} időpont a beosztáson kívülre került` : '')); return true
}
const saveDocTpl = (id: string, tpl: WeekTpl) => applyChange(s => { s.doctor[id] = tpl }, 'Heti sablon mentve')
const resetDocTpl = (id: string) => applyChange(s => { s.doctor[id] = defaultDoctorTpl() }, 'Alapbeállítás visszaállítva')
const saveRecTpl = (id: string, tpl: WeekTpl) => { sch.value.reception[id] = tpl; ui.toast('Recepciós sablon mentve') }

/* ---------- napi eltérés ---------- */
const ovr = ref<{ kind: 'doctor' | 'reception'; personId: string; date: string; periods: Period[] } | null>(null)
function openDay(kind: 'doctor' | 'reception', personId: string, d: string) {
  if (d < today()) { ui.toast('A múltbeli napok beosztása nem szerkeszthető.'); return }
  ovr.value = { kind, personId, date: d, periods: JSON.parse(JSON.stringify(periodsOn(db.value, kind, personId, d))) }
}
async function saveDay(none = false) {
  const o = ovr.value; if (!o) return
  const periods = none ? [] : o.periods.filter(([a, b]) => a < b)
  const ok = await applyChange(s => { s.overrides = s.overrides.filter(x => !(x.kind === o.kind && x.personId === o.personId && x.date === o.date)); s.overrides.push({ kind: o.kind, personId: o.personId, date: o.date, periods, at: new Date().toISOString() }) }, none ? 'Nincs rendelés ezen a napon' : 'Napi eltérés mentve')
  if (ok) ovr.value = null
}
async function backToTpl() {
  const o = ovr.value; if (!o) return
  if (await applyChange(s => { s.overrides = s.overrides.filter(x => !(x.kind === o.kind && x.personId === o.personId && x.date === o.date)) }, 'Vissza az alapbeosztásra')) ovr.value = null
}

/* ---------- orvosok, asszisztensek, recepciósok, várótermek ---------- */
function addDoctor() {
  const i = db.value.doctors.length
  const id = 'dr-' + uid().slice(0, 6)
  db.value.doctors.push({ id, name: 'Dr. Új orvos', color: DOC_COLORS[i % DOC_COLORS.length], roomId: db.value.rooms[0]?.id, assistantIds: [], active: true })
  sch.value.doctor[id] = defaultDoctorTpl()
  ui.toast('Új orvos felvéve – a heti sablon kedd–péntek 10:00–20:00 (módosítható)')
}
const used = (id: string) => db.value.appointments.some(a => a.doctorId === id) || db.value.records.some(r => r.doctorId === id) || db.value.patients.some(p => p.doctorId === id)
async function delDoctor(id: string) {
  if (used(id)) { ui.toast('Az orvoshoz időpont, kezelés vagy páciens kapcsolódik – csak inaktiválható.'); return }
  if (db.value.doctors.length <= 1) return
  if (await ui.confirm(`Törlöd: <b>${esc(docName(id))}</b>?`, 'Törlés', true)) { db.value.doctors = db.value.doctors.filter(d => d.id !== id); delete sch.value.doctor[id] }
}
function toggleAs(docId: string, aid: string) { const d = db.value.doctors.find(x => x.id === docId); if (!d) return; d.assistantIds = (d.assistantIds || []).includes(aid) ? d.assistantIds!.filter(x => x !== aid) : [...(d.assistantIds || []), aid] }
function addPerson(kind: 'assistants' | 'receptionists') { staff.value[kind].push({ id: (kind === 'assistants' ? 'asz-' : 'rec-') + uid().slice(0, 6), name: kind === 'assistants' ? 'Új asszisztens' : 'Új recepciós', active: true }); if (kind === 'receptionists') sch.value.reception[staff.value.receptionists[staff.value.receptionists.length - 1]!.id] = defaultReceptionTpl() }
async function delPerson(kind: 'assistants' | 'receptionists', id: string) {
  const inUse = kind === 'assistants' ? db.value.doctors.some(d => d.assistantIds?.includes(id)) || sch.value.assistantDays.some(x => x.assistantId === id) : sch.value.overrides.some(x => x.personId === id)
  if (inUse) { ui.toast('Kapcsolódó beosztás van – csak inaktiválható.'); return }
  staff.value[kind] = staff.value[kind].filter(x => x.id !== id) as never
}
function addWaiting() { staff.value.waiting.push({ id: 'w-' + uid().slice(0, 6), name: `${staff.value.waiting.length + 1}. váró` }) }
function addRoom() { db.value.rooms.push({ id: 'room-' + uid().slice(0, 6), siteId: db.value.sites[0]?.id || 'site-1', name: `${db.value.rooms.length + 1}. rendelő` }) }

/* ---------- asszisztens napi beosztása ---------- */
const asDay = computed(() => assistantsOn(db.value, date.value))
const clashes = computed(() => assistantClashes(db.value, date.value))
function setAsDay(docId: string, aid: string) {
  const s = sch.value
  s.assistantDays = s.assistantDays.filter(x => !(x.date === date.value && x.doctorId === docId))
  if (aid) s.assistantDays.push({ assistantId: aid, doctorId: docId, date: date.value, periods: JSON.parse(JSON.stringify(periodsOn(db.value, 'doctor', docId, date.value))) })
}
const docAsToday = (docId: string) => asDay.value.filter(x => x.doctorId === docId)
const gaps = computed(() => receptionGaps(db.value, date.value))
const recToday = computed(() => staff.value.receptionists.filter(r => r.active).map(r => ({ r, p: periodsOn(db.value, 'reception', r.id, date.value) })).filter(x => x.p.length))

/* ---------- alaprajz ---------- */
const rooms = computed(() => db.value.rooms)
const roomDocs = (roomId: string) => db.value.doctors.filter(d => d.active !== false && d.roomId === roomId).map(d => ({ d, p: periodsOn(db.value, 'doctor', d.id, date.value), as: docAsToday(d.id).map(x => asName(x.assistantId)) }))
const W = 760
const roomW = computed(() => Math.max(180, Math.floor((W - 40 - 220) / Math.max(1, rooms.value.length))))
</script>

<template>
  <div class="card" data-test="beosztas">
    <div class="row" style="margin-bottom:10px">
      <h2 style="margin:0">Beosztás</h2>
      <div class="seg"><button :class="{ on: part === 'plan' }" @click="part = 'plan'">Rendelő (alaprajz)</button><button :class="{ on: part === 'docs' }" @click="part = 'docs'">Orvosok és asszisztensek</button><button :class="{ on: part === 'rec' }" @click="part = 'rec'">Recepció</button></div>
      <div class="spacer" />
      <label class="small muted">Nap: <input v-model="date" type="date" class="inp auto"></label>
    </div>
    <p class="small muted" style="margin-top:0">Időpont csak akkor foglalható, ha az orvos a beosztás szerint rendel. Alapbeállítás: kedd–péntek 10:00–20:00; ettől napra vagy időszakra el lehet térni. Az asszisztens- és recepciós-beosztás nem tilt, csak jelez. A demóban mindenki szerkesztheti.</p>

    <!-- alaprajz -->
    <template v-if="part === 'plan'">
      <div class="floor">
        <svg :viewBox="`0 0 ${W} 330`" role="img" aria-label="A rendelő felülnézeti képe (minta)">
          <rect x="4" y="4" :width="W - 8" height="322" rx="14" fill="#fbfaf7" stroke="#d9d4c7" stroke-width="2" />
          <g v-for="(r, i) in rooms" :key="r.id" :transform="`translate(${16 + i * (roomW + 10)},16)`">
            <rect :width="roomW" height="190" rx="10" :fill="pastel(i)" fill-opacity=".35" :stroke="pastel(i)" stroke-width="2" />
            <text x="10" y="20" font-size="13" font-weight="800" fill="#3d4a57">{{ r.name }}</text>
            <!-- íróasztal számítógéppel -->
            <rect x="10" y="32" width="70" height="28" rx="4" fill="#e8dcc6" stroke="#b9a988" /><rect x="30" y="36" width="30" height="16" rx="2" fill="#6b7a89" /><rect x="40" y="52" width="10" height="4" fill="#6b7a89" />
            <text x="12" y="72" font-size="9" fill="#6b7a89">íróasztal, számítógép</text>
            <!-- fogorvosi szék -->
            <path :d="`M ${roomW / 2 - 12} 90 q 0 -14 14 -14 h 22 q 10 0 10 10 v 36 q 0 8 -8 8 h -30 q -8 0 -8 -8 z`" fill="#cfe7f7" stroke="#6aa6cf" stroke-width="1.5" />
            <text :x="roomW / 2 - 20" y="146" font-size="9" fill="#3a6a8c">fogorvosi szék</text>
            <!-- röntgengép -->
            <circle :cx="roomW / 2 + 52" cy="86" r="9" fill="#f2e6f7" stroke="#a07cc0" /><line :x1="roomW / 2 + 52" y1="95" :x2="roomW / 2 + 52" y2="118" stroke="#a07cc0" stroke-width="3" />
            <text :x="roomW / 2 + 34" y="130" font-size="9" fill="#7a5698">röntgen</text>
            <g v-for="(x, k) in roomDocs(r.id)" :key="x.d.id" :transform="`translate(8,${154 + k * 16})`">
              <rect width="10" height="10" rx="2" :fill="x.d.color" /><text x="14" y="9" font-size="10.5" fill="#23313f"><tspan font-weight="700">{{ x.d.name }}</tspan> · {{ periodsText(x.p) }}{{ x.as.length ? ' · ' + x.as.join(', ') : '' }}</text>
            </g>
          </g>
          <!-- recepció -->
          <g :transform="`translate(${W - 214},16)`">
            <rect width="200" height="100" rx="10" fill="#ffd59e" fill-opacity=".45" stroke="#f0b45e" stroke-width="2" />
            <text x="10" y="20" font-size="13" font-weight="800" fill="#6a4a10">Recepciós pult</text>
            <path d="M 20 40 h 120 q 10 0 10 10 v 14 h -130 z" fill="#f3d6a6" stroke="#c99b50" />
            <text v-for="(x, k) in recToday" :key="x.r.id" x="10" :y="82 + k * 13" font-size="10.5" fill="#3d2f10">{{ x.r.name }} · {{ periodsText(x.p) }}</text>
            <text v-if="!recToday.length" x="10" y="84" font-size="10.5" fill="#a1241a">nincs recepciós</text>
          </g>
          <!-- váróterem -->
          <g :transform="`translate(${W - 214},126)`">
            <rect width="200" height="80" rx="10" fill="#a8e3dd" fill-opacity=".4" stroke="#5fc0b5" stroke-width="2" />
            <text x="10" y="20" font-size="13" font-weight="800" fill="#1d5c55">Váróterem</text>
            <text v-for="(w, k) in staff.waiting" :key="w.id" x="10" :y="38 + k * 13" font-size="10.5" fill="#1d5c55">{{ w.name }}</text>
            <g v-for="k in 6" :key="'s' + k"><rect :x="100 + ((k - 1) % 3) * 30" :y="32 + Math.floor((k - 1) / 3) * 22" width="20" height="14" rx="3" fill="#d9f3ef" stroke="#5fc0b5" /></g>
          </g>
          <text x="16" y="230" font-size="11" fill="#6b7a89">{{ DAYS[dow(date) - 1] }}, {{ fmtShort(date) }} – minta alaprajz (Cooldent Kft.); az egyedi, valósághű alaprajz egy későbbi verzióban, jogosultsághoz kötve készíthető.</text>
          <text v-if="gaps.length" x="16" y="248" font-size="11" fill="#a1241a">Nincs recepciós: {{ periodsText(gaps) }}</text>
          <text v-if="clashes.length" x="16" y="266" font-size="11" fill="#a1241a">⚠ Egy asszisztens egyszerre két helyen: {{ clashes.map(asName).join(', ') }}</text>
        </svg>
      </div>
      <div class="grid2" style="margin-top:10px">
        <div>
          <label class="f">Rendelőszobák</label>
          <div v-for="r in rooms" :key="r.id" class="row" style="padding:2px 0"><input v-model.lazy="r.name" class="inp" style="max-width:240px"></div>
          <button class="btn sm" @click="addRoom">+ Rendelőszoba</button>
        </div>
        <div>
          <label class="f">Várótermek (szám vagy név)</label>
          <div v-for="(w, i) in staff.waiting" :key="w.id" class="row" style="padding:2px 0"><input v-model.lazy="w.name" class="inp" style="max-width:240px"><button class="btn sm" @click="staff.waiting.splice(i, 1)">×</button></div>
          <button class="btn sm" @click="addWaiting">+ Váróterem</button>
          <div class="small muted" style="margin-top:4px">A v2.4-ben csak megnevezés és megjelenítés; a páciens váróteremhez rendelése, a behívás és a tévéképernyős megjelenítés későbbi modul.</div>
        </div>
      </div>
    </template>

    <!-- orvosok és asszisztensek -->
    <template v-else-if="part === 'docs'">
      <div v-for="(d, i) in db.doctors" :key="d.id" class="sched-doc" :style="`border-left:6px solid ${d.color || pastel(i)};padding-left:10px;margin-bottom:16px;${d.active === false ? 'opacity:.6' : ''}`">
        <div class="row">
          <input v-model.lazy="d.name" class="inp" style="max-width:220px;font-weight:700" aria-label="Orvos neve">
          <input v-model="d.color" type="color" class="inp" style="width:48px;padding:2px;height:34px" aria-label="Szín a naptárban">
          <select v-model="d.roomId" class="inp auto" aria-label="Rendelő"><option v-for="r in db.rooms" :key="r.id" :value="r.id">{{ r.name }}</option></select>
          <label class="switch" :class="{ on: d.active !== false }" @click.prevent="d.active = d.active === false"><i />{{ d.active === false ? 'inaktív' : 'aktív' }}</label>
          <div class="spacer" /><button class="btn sm danger" @click="delDoctor(d.id)">Törlés</button>
        </div>
        <div class="row small" style="margin:6px 0">Asszisztens(ek): <span v-for="a in staff.assistants.filter(x => x.active)" :key="a.id" class="chip" :class="{ on: d.assistantIds?.includes(a.id) }" @click="toggleAs(d.id, a.id)">{{ a.name }}</span></div>
        <div class="small" style="margin-bottom:4px"><b>Heti sablon:</b> {{ weekText(doctorTpl(db, d.id)) }}</div>
        <details><summary class="small" style="cursor:pointer;font-weight:700">Heti sablon szerkesztése</summary>
          <WeekTplEditor :tpl="doctorTpl(db, d.id)" @save="t => saveDocTpl(d.id, t)" @reset="resetDocTpl(d.id)" /></details>
        <div class="small" style="margin:6px 0 2px"><b>Napi eltérések</b> (koppints egy napra):</div>
        <div class="sched-grid">
          <div /><div v-for="k in 7" :key="k" class="sg-h">{{ DAYS[k - 1]!.slice(0, 3) }}</div>
          <template v-for="w in 2" :key="w">
            <div class="small muted">{{ fmtShort(week[(w - 1) * 7]!) }}–</div>
            <div v-for="k in 7" :key="k" class="sched-cell" :class="{ on: periodsOn(db, 'doctor', d.id, week[(w - 1) * 7 + k - 1]!).length, ovr: hasOverride(db, 'doctor', d.id, week[(w - 1) * 7 + k - 1]!), past: week[(w - 1) * 7 + k - 1]! < today() }" @click="openDay('doctor', d.id, week[(w - 1) * 7 + k - 1]!)">
              <div class="small"><b>{{ fmtShort(week[(w - 1) * 7 + k - 1]!) }}</b></div><div style="font-size:10.5px">{{ periodsText(periodsOn(db, 'doctor', d.id, week[(w - 1) * 7 + k - 1]!)) }}</div>
            </div>
          </template>
        </div>
        <div class="row small" style="margin-top:6px">{{ fmtShort(date) }} – asszisztens:
          <select class="inp auto" :value="docAsToday(d.id)[0]?.assistantId || ''" @change="setAsDay(d.id, ($event.target as HTMLSelectElement).value)"><option value="">– nincs –</option><option v-for="a in staff.assistants.filter(x => x.active)" :key="a.id" :value="a.id">{{ a.name }}</option></select>
          <span v-if="periodsOn(db, 'doctor', d.id, date).length && !docAsToday(d.id).length" class="badge b-yellow">ezen a napon nincs asszisztens</span>
          <span v-if="docAsToday(d.id).some(x => clashes.includes(x.assistantId))" class="badge b-red">az asszisztens egyszerre két helyen</span>
        </div>
      </div>
      <button class="btn" @click="addDoctor">+ Orvos hozzáadása</button>
      <h3 style="margin-top:16px">Asszisztensek</h3>
      <div v-for="a in staff.assistants" :key="a.id" class="row" style="padding:2px 0"><input v-model.lazy="a.name" class="inp" style="max-width:220px"><label class="switch" :class="{ on: a.active }" @click.prevent="a.active = !a.active"><i />{{ a.active ? 'aktív' : 'inaktív' }}</label><button class="btn sm" @click="delPerson('assistants', a.id)">×</button></div>
      <button class="btn sm" @click="addPerson('assistants')">+ Asszisztens</button>
    </template>

    <!-- recepció -->
    <template v-else>
      <div class="hint small">Ki mikor ül a recepciós pultnál (műszak kezdete, vége). Ismétlődő heti sablon és napi eltérés. A recepciós nem azonos az asszisztenssel, de egy személy mindkét szerepben szerepelhet.</div>
      <div v-for="(r, i) in staff.receptionists" :key="r.id" :style="`border-left:6px solid ${pastel(i + 3)};padding-left:10px;margin-bottom:14px`">
        <div class="row"><input v-model.lazy="r.name" class="inp" style="max-width:220px;font-weight:700"><label class="switch" :class="{ on: r.active }" @click.prevent="r.active = !r.active"><i />{{ r.active ? 'aktív' : 'inaktív' }}</label><div class="spacer" /><button class="btn sm" @click="delPerson('receptionists', r.id)">×</button></div>
        <div class="small" style="margin:4px 0"><b>Heti sablon:</b> {{ weekText(receptionTpl(db, r.id)) }}</div>
        <details><summary class="small" style="cursor:pointer;font-weight:700">Heti sablon szerkesztése</summary><WeekTplEditor :tpl="receptionTpl(db, r.id)" @save="t => saveRecTpl(r.id, t)" @reset="saveRecTpl(r.id, defaultReceptionTpl())" /></details>
        <div class="sched-grid" style="margin-top:6px">
          <div /><div v-for="k in 7" :key="k" class="sg-h">{{ DAYS[k - 1]!.slice(0, 3) }}</div>
          <template v-for="w in 2" :key="w">
            <div class="small muted">{{ fmtShort(week[(w - 1) * 7]!) }}–</div>
            <div v-for="k in 7" :key="k" class="sched-cell" :class="{ on: periodsOn(db, 'reception', r.id, week[(w - 1) * 7 + k - 1]!).length, ovr: hasOverride(db, 'reception', r.id, week[(w - 1) * 7 + k - 1]!), past: week[(w - 1) * 7 + k - 1]! < today() }" @click="openDay('reception', r.id, week[(w - 1) * 7 + k - 1]!)">
              <div class="small"><b>{{ fmtShort(week[(w - 1) * 7 + k - 1]!) }}</b></div><div style="font-size:10.5px">{{ periodsText(periodsOn(db, 'reception', r.id, week[(w - 1) * 7 + k - 1]!)) }}</div>
            </div>
          </template>
        </div>
      </div>
      <button class="btn sm" @click="addPerson('receptionists')">+ Recepciós</button>
      <div class="small" style="margin-top:10px"><b>Lefedettség ({{ fmtShort(date) }}):</b> <span v-if="gaps.length" style="color:var(--red)">nincs recepciós: {{ periodsText(gaps) }}</span><span v-else style="color:var(--green)">a rendelési idő lefedett</span></div>
    </template>

    <!-- napi eltérés szerkesztése -->
    <div v-if="ovr" class="backdrop" style="z-index:120" @mousedown.self="ovr = null">
      <div class="modal" style="width:440px">
        <div class="mh"><h2>{{ ovr.kind === 'doctor' ? docName(ovr.personId) : staff.receptionists.find(x => x.id === ovr!.personId)?.name }} – {{ fmtShort(ovr.date) }} ({{ DAYS[dow(ovr.date) - 1] }})</h2></div>
        <div class="mb">
          <p class="small muted" style="margin-top:0">Az eltérés erre a napra a sablon helyett érvényes.</p>
          <div v-for="(p, i) in ovr.periods" :key="i" class="row" style="gap:4px;padding:2px 0">
            <select v-model="p[0]" class="inp auto"><option v-for="t in GRID" :key="t" :value="t">{{ t }}</option></select>–<select v-model="p[1]" class="inp auto"><option v-for="t in GRID" :key="t" :value="t">{{ t }}</option></select>
            <button class="btn sm" @click="ovr.periods.splice(i, 1)">×</button>
          </div>
          <button class="btn sm" @click="ovr.periods.push(['10:00', '14:00'])">+ időszak</button>
        </div>
        <div class="mf">
          <button class="btn" @click="backToTpl">Vissza az alapbeosztásra</button>
          <button class="btn danger" @click="saveDay(true)">{{ ovr.kind === 'doctor' ? 'Nincs rendelés' : 'Nincs műszak' }}</button>
          <div class="spacer" /><button class="btn pri" @click="saveDay()">Mentés</button>
        </div>
      </div>
    </div>
  </div>
</template>
