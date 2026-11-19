<script setup lang="ts">
// Kezelési felület (spec 2.2.5): felül a páciens neve és a diktálás, középen a fogtérkép,
// alatta lenyitható csoportok. Diktálás → szabályalapú értelmezés → ellenőrzés → jóváhagyás.
import { useDataStore } from '~/stores/data'
import { useTreatmentStore } from '~/stores/treatment'
import { useVoiceStore } from '~/stores/voice'
import { useUiStore } from '~/stores/ui'
import { useAppointmentStore } from '~/stores/appointment'
import { esc, fmtFt, fmtLong, today } from '~/utils/dates'
import type { Surface } from '~/utils/types'
import { recordForAppt, typeNames } from '~/utils/logic'
import { URGENCY } from '~/utils/suggest'
import { DICTATION_LIMIT_S } from '~/utils/meta'
import { allTeeth } from '~/utils/teeth'
import { surfaceStr, teethStr, toothLabel } from '~/utils/teeth'
import { ATT_ACCEPT, DOC_TYPES, STATUS_STYLE } from '~/utils/defaults'
import AttachmentViewer from '~/components/modals/AttachmentViewer.vue'
import ApproveResultModal from '~/components/modals/ApproveResultModal.vue'
import StatusToothModal from '~/components/modals/StatusToothModal.vue'
import ConsentModal from '~/components/modals/ConsentModal.vue'
import { useOfficeStore } from '~/stores/office'
import { fmtDate, fmtPrice } from '~/utils/dates'

const data = useDataStore()
const tx = useTreatmentStore()
const voice = useVoiceStore()
const ui = useUiStore()
const ap = useAppointmentStore()
const office = useOfficeStore()
const db = computed(() => data.db)
const s = computed(() => tx.s)
const p = computed(() => tx.patient)
onMounted(() => voice.detect())
// a diktálás végén azonnal feldolgozunk: az előnézet (fogak, tételek, anyagok) azonnal kész, csak a ⚠ sorokat kell megerősíteni (spec v2.2, 4. pont)
watch(() => voice.recording, (v, old) => {
  if (old && !v && s.value?.mode !== 'status') { tx.finishDictation(); if (tx.toReview) open.mats = true; ui.toast(tx.toReview ? `Az előnézet elkészült – ${tx.toReview} ⚠ sort meg kell erősíteni` : 'Az előnézet elkészült – ellenőrizd, majd mentsd') }
})
onBeforeUnmount(() => voice.stop())

const SAMPLES = [
  ['Tömés két fogon', '36-os és 37-es fog, kompozit tömés. Érzéstelenítés két ampulla artikainnal. Kérek öt tampont. A tömést két rétegben építem fel, aztán még egy tampont kérek. Polírozás.'],
  ['Bővítés kezelés közben', 'A 26-os fogon meziális tömés. A rágófelszínen is tömünk, okkluzálisan bővítem. Érzéstelenítés egy ampulla lidokainnal.'],
  ['Szóbeli fogjelölés', 'Jobb alsó hatos, mezio-okkluzo-disztális tömés. Mepivakain két ampulla. Három tampont kérek.'],
  ['Gyökérkezelés', '46-os fog gyökérkezelése. Érzéstelenítés. Trepanálás után a csatornákat négy reszelővel tágítom. Húsz milliliter öblítő oldattal öblítem. Kérek három tampont. Négy guttapercha csúccsal gyökértöltés, ideiglenes tömőanyaggal zárom.'],
  ['Fogkő-eltávolítás', 'Fogkő-eltávolítás ultrahanggal mindkét fogíven. Kérek hat tampont. Polírozás, kérek négy adag polírpasztát.'],
]
const STATUS_SAMPLE = '18-as és 28-as hiányzik, 16-os korona, 36-os tömött, 46-os gyökérkezelt és koronás, 13-tól 23-ig ép, a többi ép.'
const STATUS_SAMPLE_PRIMARY = '55-ös szuvas, 64-es tömött, jobb alsó római négyes tömött, a többi ép.'

const open = reactive({ dict: false, type: false, stc: true, sug: true, mats: false, att: false, sum: false, status: true, ster: false, consent: false })
const dtText = computed({ get: () => s.value?.text || '', set: v => tx.setText(v) })
const stText = computed({ get: () => s.value?.statusText || '', set: v => tx.setStatusText(v) })

function toggleMic() {
  if (voice.recording) { voice.stop(); return }
  if (s.value?.mode === 'status') { open.status = true; voice.start({ get: () => s.value?.statusText || '', set: v => tx.setStatusText(v, 200) }) }
  else { open.dict = true; voice.start({ get: () => s.value?.text || '', set: v => tx.setText(v, 200) }) }
}
function insertSample(t: string) { tx.setText((s.value?.text ? s.value.text.trim() + ' ' : '') + t, 0); open.dict = true }
function chartClick(n: number) {
  const x = s.value; if (!x) return
  if (x.mode === 'status') { ui.open(StatusToothModal, { n }); return }
  if (!x.teeth.includes(n)) tx.toggleTooth(n)
  else if (x.focusTooth !== n) tx.focus(n)
  else tx.toggleTooth(n)
}
const words = computed(() => (s.value?.text.trim() ? s.value.text.trim().split(/\s+/).length : 0))
const live = computed(() => { const t = (s.value?.mode === 'status' ? s.value.statusText : s.value?.text) || ''; return t.length > 140 ? '…' + t.slice(-140) : t })
const flags = computed(() => {
  const f: Record<string, string> = {}
  if (s.value?.mode === 'status') return tx.statusConflicts
  tx.missingSurface.forEach(n => { f[n] = 'tömésnél a felszín megadása kötelező' })
  tx.offDentition.forEach(n => { f[n] = 'nem a beállított fogazathoz tartozik' })
  return f
})
const planned = computed(() => s.value?.planned)
const hl = ref<number | null>(null)
const marks = computed(() => {
  const m: Record<number, 'planned' | 'added' | 'postponed'> = {}
  tx.items.forEach(i => { if (i.tooth) m[i.tooth] = i.state === 'postponed' ? 'postponed' : i.origin === 'planned' ? 'planned' : m[i.tooth] === 'planned' ? 'planned' : 'added' })
  return m
})
const tname = (id: string) => db.value.types.find(x => x.id === id)?.name || id
const addTooth = ref<number | ''>(''), addType = ref('')
const sugTooth = ref<number | ''>(''), sugType = ref('')
const teethList = computed(() => allTeeth(p.value?.dentition || 'permanent'))
function addItem() {
  if (!addType.value) return
  const bound = db.value.types.find(x => x.id === addType.value)?.toothBound
  if (bound && !addTooth.value) { ui.toast('Ehhez a művelethez fogszám kell.'); return }
  tx.addItem(bound ? Number(addTooth.value) : null, addType.value); addType.value = ''
}
function addSug() {
  if (!sugType.value) return
  tx.addSuggestion(sugTooth.value ? Number(sugTooth.value) : null, sugType.value); sugType.value = ''; sugTooth.value = ''
}
const ORIGIN = { planned: ['b-blue', 'előjegyzett'], added: ['b-yellow', 'kezelés közben hozzáadva'], manual: ['b-gray', 'rögzített'] } as const
const dueIn = computed(() => (d: string | null) => (d ? fmtDate(d) : 'nincs határidő'))
const focus = computed(() => s.value?.focusTooth ?? null)
const typeSum = computed(() => (s.value?.types.length ? typeNames(db.value, s.value.types) : 'nincs kiválasztva'))
const matSum = computed(() => { const n = tx.rows.filter(r => r.checked && r.qty > 0).length; return `${n} anyag${tx.toReview ? `, ${tx.toReview} ellenőrizendő` : ''}` })
const present = computed(() => new Set(tx.rows.map(r => r.id)))
const groups = computed(() => [...new Set(db.value.items.map(i => i.group))])

// csatolmányok
const attType = ref('rtg_pa')
const attNote = ref('')
const drag = ref(false)
async function upload(files: FileList | File[] | null) {
  if (!files || !files.length) return
  const r = await tx.upload(files, attType.value, attNote.value.trim())
  attNote.value = ''
  ui.toast(r.memOnly ? 'Feltöltve, de ez a böngésző csak bezárásig őrzi meg a fájlt' : `${r.count} fájl feltöltve`)
}
async function removeAtt(id: string) {
  const a = db.value.attachments.find(x => x.id === id); if (!a) return
  if (!(await ui.confirm(`Törlöd ezt a csatolmányt: <b>${esc(a.name)}</b>?`, 'Törlés', true))) return
  db.value.attachments = db.value.attachments.filter(x => x.id !== id)
}

async function cancel() {
  voice.stop()
  if (tx.hasUnsaved && !(await ui.confirm('A kezelés még nincs mentve. A diktált szöveg <b>piszkozatként 7 napig megmarad</b> (a készlet nem változik), a csatolmányok és az aláírt nyilatkozatok viszont elvesznek. Kilépsz?', 'Kilépés', true))) return
  const pid = s.value?.patientId
  tx.cancel()
  if (pid) navigateTo(`/paciensek/${pid}`)
}
function approve() {
  voice.stop()
  const res = tx.approve()
  if (!res) return
  if ('error' in res) { ui.toast(res.error!); return }
  ui.toast('Kezelés mentve, anyagok levonva' + (res.statusChanged ? `, ${res.statusChanged} fogállapot rögzítve` : '') + (res.suggested ? `, ${res.suggested} javaslat a teendők között` : ''))
  if (res.warns.length || Object.keys(res.statusOffer).length || res.hasInfo) ui.open(ApproveResultModal, { warns: res.warns, statusOffer: res.statusOffer, patientId: res.patientId, recordId: res.recordId, hasInfo: res.hasInfo })
  navigateTo(`/paciensek/${res.patientId}`)
}
function startStatus() { voice.stop(); tx.setMode('status'); open.status = true }
function approveStatus() { voice.stop(); if (tx.approveStatus()) ui.toast('Fogazati státusz mentve'); else ui.toast('Nincs felismert fogállapot') }
function discardStatus() { voice.stop(); tx.discardStatus() }

// nincs aktív kezelés: a mai időpontok
const todays = computed(() => db.value.appointments.filter(a => a.date === today() && !recordForAppt(db.value, a.id) && a.status !== 'noshow').sort((a, b) => a.start.localeCompare(b.start)))
const pname = (pid: string) => db.value.patients.find(x => x.id === pid)?.name || ''
function startAppt(id: string) { tx.startFromAppointment(id) }
const stLabel = (st: string[]) => st.map(x => STATUS_STYLE[x]?.label || x).join(', ')
</script>

<template>
  <div v-if="!s || !p">
    <div class="pagehead"><h1>Kezelés</h1></div>
    <div class="card">
      <h2>Nincs folyamatban lévő kezelés</h2>
      <p class="muted" style="margin-top:0">A kezelést a naptárban egy időpontra kattintva, vagy a páciens kartonjáról az „Új kezelés” gombbal indíthatod.</p>
      <template v-if="todays.length">
        <h3>Mai időpontok</h3>
        <div v-for="a in todays" :key="a.id" class="row" style="padding:10px 0;border-top:1px solid #eef1f3">
          <b style="width:56px">{{ a.start }}</b><span style="min-width:160px"><b>{{ pname(a.patientId) }}</b></span><span class="muted">{{ typeNames(db, a.typeIds) }}</span>
          <div class="spacer" /><button class="btn go sm" @click="startAppt(a.id)">Kezelés indítása</button>
        </div>
      </template>
      <div class="row" style="margin-top:12px"><NuxtLink to="/" class="btn">Naptár</NuxtLink><NuxtLink to="/paciensek" class="btn">Páciensek</NuxtLink></div>
    </div>
  </div>

  <div v-else>
    <!-- fejléc: páciens és diktálás -->
    <div class="tx-head" :style="s.mode === 'status' ? 'border-top-color:var(--purple)' : ''">
      <div>
        <div class="small muted" style="font-weight:700;letter-spacing:.08em;text-transform:uppercase">{{ s.mode === 'status' ? 'Fogazati státusz felvétele' : s.recordId ? 'Kezelés szerkesztése' : 'Kezelés' }} · {{ fmtLong(s.date) }}, {{ s.time }}</div>
        <h1>{{ p.name }}</h1>
      </div>
      <HealthWarning :text="p.healthWarning" />
      <div class="spacer" />
      <select v-model="s.doctorId" class="inp auto" aria-label="Orvos"><option v-for="d in db.doctors" :key="d.id" :value="d.id">{{ d.name }}</option></select>
      <button v-if="s.mode === 'treat'" class="btn" @click="startStatus">🦷 Státuszfelvétel</button>
      <button class="mic" :class="{ rec: voice.recording, status: s.mode === 'status' && !voice.recording }" :disabled="!voice.supported" @click="toggleMic">
        <AppIcon :name="voice.recording ? 'stop' : 'mic'" :size="18" />{{ voice.recording ? `Leállítás (${voice.remaining} s)` : s.mode === 'status' ? 'Státusz diktálása' : 'Diktálás' }}
      </button>
    </div>
    <div class="ai-note">
      <b>Demó (2.0):</b> csak szövegfelismerés – a program a böngésző beszédfelismerésével alakítja szöveggé a diktálást, és szabályok alapján tölti ki a mezőket.
      Egy felvétel legfeljebb {{ DICTATION_LIMIT_S }} másodperc lehet (a hátralévő idő a gombon látszik); utána újra indíthatod.
      A mesterséges intelligenciával készülő összefoglaló a későbbi verziókban lesz elérhető. Csak kitalált adatot diktálj: a böngésző a hangot a szolgáltatója szerverére küldheti.
      <span v-if="!voice.supported"><br><b>Ez a böngésző nem támogatja a diktálást</b> – gépeld be a szöveget (Chrome, Edge vagy Safari ajánlott).</span>
    </div>
    <div v-if="tx.restored && s?.text" class="hint">Mentetlen diktálási piszkozat visszaállítva (7 napig őrizzük, a készletet nem érinti). Mentés után a piszkozat törlődik.</div>
    <div v-if="voice.recording || voice.message" class="tx-live">{{ voice.recording ? '🎙 ' : '' }}{{ voice.recording && live ? live : voice.message }}</div>

    <!-- fogtérkép középen -->
    <div class="tx-chart">
      <ChartPanel :patient-id="p.id" :sess-key="s.key" :selected="s.mode === 'treat' ? s.teeth : []" :focus="s.mode === 'treat' ? focus : null"
        :current="s.mode === 'treat' ? tx.surfaces : undefined" :marks="s.mode === 'treat' ? marks : undefined" :hl="hl" @hover="hl = $event" :draft="s.mode === 'status' && Object.keys(tx.statusDraft).length ? tx.statusDraft : null" :flags="flags" clickable @tooth="chartClick" />
      <template v-if="s.mode === 'treat'">
        <div class="row" style="margin-top:12px">
          <b class="small" style="text-transform:uppercase;letter-spacing:.1em;color:var(--slate)">Érintett fogak:</b>
          <span v-for="n in s.teeth" :key="n" class="tchip" style="cursor:pointer;font-size:12.5px;padding:4px 9px" :style="focus === n ? 'box-shadow:0 0 0 2px #fff,0 0 0 4px var(--pink)' : ''" @click="tx.focus(n)">
            {{ surfaceStr(n, tx.surfaces[n]) }} <span style="opacity:.8" title="Levétel" @click.stop="tx.toggleTooth(n)">×</span>
          </span>
          <span v-if="!s.teeth.length" class="muted small">Kattints a fogra, vagy diktáld („36-os fog”, „jobb alsó hatos”).</span>
          <template v-if="planned?.teeth.length"><span class="small muted">· tervezett:</span><span v-for="t in planned.teeth" :key="'p' + t" class="tchip plan">{{ teethStr([t], planned.surfaces) }}</span></template>
          <span v-if="tx.extendedTeeth.length" class="badge b-yellow">kezelés közben bővítve: {{ tx.extendedTeeth.map(n => surfaceStr(n, tx.surfaces[n])).join(', ') }}</span>
        </div>
        <div v-if="focus && s.teeth.includes(focus)" style="margin-top:12px;padding-top:12px;border-top:1px solid var(--line)">
          <SurfacePicker :n="focus" :value="tx.surfaces[focus] || []" :planned="planned?.surfaces[focus] as Surface[] | undefined" @toggle="tx.toggleSurface(focus!, $event)" />
        </div>
        <div v-for="(msg, n) in flags" :key="n" class="warn" style="margin:8px 0 0">{{ toothLabel(Number(n)) }}: {{ msg }}</div>
      </template>
    </div>

    <!-- státuszfelvétel -->
    <details v-if="s.mode === 'status'" class="grp" :class="{ flag: Object.keys(tx.statusConflicts).length || tx.statusParsed.unparsed.length }" :open="open.status" @toggle="open.status = ($event.target as HTMLDetailsElement).open">
      <summary><span class="gi" style="background:var(--purple)">🦷</span><span class="gt">Fogazati státusz diktálással</span><span class="gs">{{ Object.keys(tx.statusDraft).length }} fog felismerve</span><span class="chev">▾</span></summary>
      <div class="gb">
        <div class="hint">Mondd fogról fogra az állapotot: „16-os hiányzik, 26-os korona, 36-os tömött, 13-tól 23-ig ép, a többi ép”. Ebben az üzemmódban a kimondott állapot nem jelöl ki kezelést, és anyagot sem von le. A felismert státusz vázlat: a fogra kattintva javítható, és csak jóváhagyás után mentődik.</div>
        <div class="row" style="margin-bottom:8px">
          <button class="btn sm" @click="tx.setStatusText((s.statusText ? s.statusText.trim() + ' ' : '') + (p.dentition === 'primary' ? STATUS_SAMPLE_PRIMARY : STATUS_SAMPLE), 0)">Minta beszúrása</button>
          <span class="small muted">Állapotok: {{ db.settings.statusDict.map(d => d.name).join(', ') }} (a szótár a Beállításokban bővíthető)</span>
        </div>
        <textarea v-model="stText" class="dt" placeholder="Pl.: 18-as és 28-as hiányzik, 16-os korona, a többi ép." />
        <div v-if="tx.statusParsed.unparsed.length" class="warn" style="margin-top:8px">Nem értelmezett rész (a jegyzetben marad): {{ tx.statusParsed.unparsed.join(' · ') }}</div>
        <div v-for="(m, n) in tx.statusConflicts" :key="n" class="warn">⚠ {{ m }}</div>
        <div v-if="Object.keys(tx.statusDraft).length" class="small" style="margin-top:8px;line-height:1.7">
          <b>Vázlat:</b>
          <span v-for="(st, n) in tx.statusDraft" :key="n" style="margin-right:10px">{{ n }}: {{ stLabel(st) }}</span>
        </div>
        <div class="row" style="margin-top:12px">
          <button class="btn" @click="discardStatus">Vissza a kezeléshez</button>
          <div class="spacer" />
          <button class="btn pri" :disabled="!Object.keys(tx.statusDraft).length" @click="approveStatus"><AppIcon name="check" :size="16" />Státusz jóváhagyása</button>
        </div>
      </div>
    </details>

    <template v-if="s.mode === 'treat'">
      <!-- diktálás és jegyzet -->
      <details class="grp" :open="open.dict" @toggle="open.dict = ($event.target as HTMLDetailsElement).open">
        <summary><span class="gi" style="background:var(--pink)"><AppIcon name="mic" :size="18" /></span><span class="gt">Diktálás és jegyzet</span><span class="gs">{{ words ? `${words} szó` : 'még üres' }}{{ s.teeth.length ? ` · fogak: ${s.teeth.join(', ')}` : '' }}</span><span class="chev">▾</span></summary>
        <div class="gb">
          <div class="row" style="margin-bottom:8px">
            <span class="small muted">{{ voice.message || 'A teljes szöveg kezelési jegyzetként is megmarad, és bármikor javítható.' }}</span>
            <div class="spacer" />
            <select class="inp auto" @change="insertSample(($event.target as HTMLSelectElement).value); ($event.target as HTMLSelectElement).value = ''">
              <option value="">Minta diktálás beszúrása…</option>
              <option v-for="[l, t] in SAMPLES" :key="l" :value="t">{{ l }}</option>
            </select>
          </div>
          <textarea v-model="dtText" class="dt" placeholder="Pl.: 36-os fog, meziális és rágófelszíni kompozit tömés. Érzéstelenítés két ampullával, kérek öt tampont…" />
          <div v-if="tx.parsed.orphanSurfaces.length && !s.teeth.length" class="warn" style="margin-top:8px">Felszín hangzott el ({{ tx.parsed.orphanSurfaces.join(', ') }}), de fog nem – jelöld ki a fogat.</div>
        </div>
      </details>

      <!-- oldal és fogszám ellentmondása (4. pont) -->
      <div v-for="c in tx.sideConflicts" :key="c.key" class="warn" style="margin:8px 0;display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <span>⚠ „{{ c.said }}” – a(z) {{ c.n }}-es fog {{ c.expected }} található. Melyik fogra gondolt?</span>
        <button class="btn sm" @click="tx.confirmConflict(c.key)">Maradjon: {{ c.n }}-es fog</button>
      </div>

      <!-- kezelési tételek -->
      <details class="grp" :class="{ flag: !tx.items.length }" :open="open.type" @toggle="open.type = ($event.target as HTMLDetailsElement).open">
        <summary><span class="gi" style="background:var(--blue)"><AppIcon name="clipboard" :size="18" /></span><span class="gt">Kezelési tételek</span><span class="gs">{{ tx.items.length ? `${tx.items.length} tétel` : 'nincs kiválasztva' }} · {{ fmtFt(tx.fee) }}</span><span class="chev">▾</span></summary>
        <div class="gb">
          <div class="row">
            <span v-for="t in db.types" :key="t.id" class="chip" :class="{ on: s.types.includes(t.id) }" @click="tx.toggleType(t.id)">{{ t.name }}</span>
          </div>
          <div class="scroll-x" style="margin-top:10px">
            <table class="t ss">
              <thead><tr><th>Fog</th><th>Művelet</th><th class="hide-m">Eredet</th><th>Állapot</th><th class="r">Díj</th><th /></tr></thead>
              <tbody>
                <tr v-for="i in tx.items" :key="i.key" :class="{ off: i.state === 'postponed' }" :style="hl && hl === i.tooth ? 'background:#fff1f6' : ''" @mouseenter="hl = i.tooth" @mouseleave="hl = null">
                  <td><b>{{ i.tooth ? surfaceStr(i.tooth, i.surfaces) : '–' }}</b></td>
                  <td>{{ tname(i.typeId) }}</td>
                  <td class="hide-m"><span class="badge" :class="ORIGIN[i.origin][0]">{{ ORIGIN[i.origin][1] }}</span></td>
                  <td><select class="inp auto" :value="i.state" @change="tx.setItemState(i.key, ($event.target as HTMLSelectElement).value as 'done' | 'postponed')"><option value="done">elvégezve</option><option value="postponed">elhalasztva</option></select></td>
                  <td class="r">{{ i.state === 'done' ? fmtFt(i.fee) : '–' }}</td>
                  <td><button class="btn sm" title="Tétel törlése" @click="tx.removeItem(i.key)">×</button></td>
                </tr>
                <tr v-if="!tx.items.length"><td colspan="6" class="muted">Még nincs tétel – diktálj („36-os tömés, 37-es húzás”), jelölj fogat és műveletet, vagy vedd fel alább.</td></tr>
              </tbody>
              <tfoot v-if="tx.items.length"><tr><td colspan="4"><b>Összesen</b></td><td class="r"><b>{{ fmtFt(tx.itemTotal) }}</b></td><td /></tr></tfoot>
            </table>
          </div>
          <div class="row" style="margin-top:10px">
            <span class="small muted">Tétel hozzáadása kezelés közben:</span>
            <select v-model="addTooth" class="inp auto"><option value="">fog…</option><option v-for="n in teethList" :key="n" :value="n">{{ n }}</option></select>
            <select v-model="addType" class="inp auto"><option value="">művelet…</option><option v-for="t in db.types" :key="t.id" :value="t.id">{{ t.name }}</option></select>
            <button class="btn sm" @click="addItem">+ Hozzáadás</button>
          </div>
          <div class="small muted" style="margin-top:6px">Az előjegyzett tételek kék, a kezelés közben hozzáadottak borostyán jelölést kapnak a fogtérképen és a kartonban. Az elhalasztott tétel nem kerül díjba és anyagfelhasználásba.</div>
        </div>
      </details>

      <!-- fogállapot-változás a diktálásból -->
      <details v-if="tx.statusChanges.length" class="grp flag" :open="open.stc" @toggle="open.stc = ($event.target as HTMLDetailsElement).open">
        <summary><span class="gi" style="background:var(--purple)">🦷</span><span class="gt">Diktált fogállapot-változás</span><span class="gs">{{ tx.statusChanges.length }} fog – mentés előtt ellenőrizd</span><span class="chev">▾</span></summary>
        <div class="gb">
          <div class="hint">A diktálásban kimondott állapot a jóváhagyáskor a fogtérképre és a státusz előzményeibe is bekerül (a kezelés napjával). Itt még javíthatod vagy elvetheted.</div>
          <div v-for="c in tx.statusChanges" :key="c.tooth" class="row" style="padding:6px 0;border-bottom:1px solid #eef1f3">
            <b style="width:60px">{{ c.tooth }}</b>
            <span class="muted">{{ c.from.length ? stLabel(c.from) : 'nincs adat' }}</span><span>→</span><b>{{ stLabel(c.to) }}</b>
            <div class="spacer" />
            <select class="inp auto" :value="c.to[0]" @change="tx.setStatusChange(c.tooth, [($event.target as HTMLSelectElement).value])"><option v-for="d in db.settings.statusDict" :key="d.id" :value="d.id">{{ d.name }}</option></select>
            <button class="btn sm" @click="tx.setStatusChange(c.tooth, null)">Elvet</button>
          </div>
        </div>
      </details>

      <!-- javasolt további kezelések -->
      <details class="grp" :open="open.sug" @toggle="open.sug = ($event.target as HTMLDetailsElement).open">
        <summary><span class="gi" style="background:var(--orange)"><AppIcon name="clipboard" :size="18" /></span><span class="gt">Javasolt további kezelések</span><span class="gs">{{ tx.suggestList.length ? `${tx.suggestList.length} javaslat – az asszisztens kapja meg` : 'nincs' }}</span><span class="chev">▾</span></summary>
        <div class="gb">
          <div class="hint">A „szükséges”, „javasolt”, „kell” jelzésű diktált kezelés nem számít elvégzettnek: javaslatként a Teendők listára kerül, és az asszisztens időpontot egyeztet rá.</div>
          <div v-for="g in tx.suggestList" :key="g.key" class="row" style="padding:6px 0;border-bottom:1px solid #eef1f3">
            <b style="width:60px">{{ g.tooth ?? '–' }}</b><span style="min-width:120px">{{ tname(g.typeId) }}</span>
            <select class="inp auto" :value="g.urgency" @change="tx.setSuggestion(g.key, { urgency: ($event.target as HTMLSelectElement).value as 'urgent' | 'recommended' | 'later' })"><option v-for="(u, k) in URGENCY" :key="k" :value="k">{{ u.label }}</option></select>
            <input type="date" class="inp auto" :value="g.due || ''" :title="dueIn(g.due)" @change="tx.setSuggestion(g.key, { due: ($event.target as HTMLInputElement).value || null })">
            <input class="inp" style="flex:1;min-width:140px" placeholder="Megjegyzés" :value="g.note" @change="tx.setSuggestion(g.key, { note: ($event.target as HTMLInputElement).value })">
            <button class="btn sm" @click="tx.removeSuggestion(g.key)">×</button>
          </div>
          <div class="row" style="margin-top:10px">
            <select v-model="sugTooth" class="inp auto"><option value="">fog…</option><option v-for="n in teethList" :key="n" :value="n">{{ n }}</option></select>
            <select v-model="sugType" class="inp auto"><option value="">javasolt művelet…</option><option v-for="t in db.types" :key="t.id" :value="t.id">{{ t.name }}</option></select>
            <button class="btn sm" @click="addSug">+ Javaslat felvétele</button>
          </div>
        </div>
      </details>

      <!-- felhasznált anyagok -->
      <details class="grp" :class="{ flag: tx.toReview }" :open="open.mats" @toggle="open.mats = ($event.target as HTMLDetailsElement).open">
        <summary><span class="gi" style="background:var(--teal)"><AppIcon name="box" :size="18" /></span><span class="gt">Felhasznált anyagok</span><span class="gs">{{ matSum }}</span><span v-if="tx.toReview" class="flagdot">{{ tx.toReview }}</span><span class="chev">▾</span></summary>
        <div class="gb">
          <div class="scroll-x">
            <table class="t ss">
              <thead><tr><th style="width:30px" /><th>Anyag</th><th class="hide-m">Csomag szerint</th><th class="hide-m">Diktálás alapján</th><th>Mennyiség</th><th>Jelzés</th></tr></thead>
              <tbody>
                <tr v-for="r in tx.rows" :key="r.id" :class="[`st-${r.st}`, { off: !r.checked }]">
                  <td><input type="checkbox" :checked="r.checked" @change="tx.setChecked(r.id, ($event.target as HTMLInputElement).checked)"></td>
                  <td><b>{{ db.items.find(i => i.id === r.id)?.name }}</b><div class="small muted">{{ db.items.find(i => i.id === r.id)?.group }}</div>
                    <div v-for="l in (r.checked ? tx.lotPreview(r.id, r.qty) : [])" :key="l.lot" class="small" :style="l.expiry && l.expiry < today() ? 'color:var(--red);font-weight:700' : 'color:var(--blue-d)'">LOT {{ l.lot }} · lejár: {{ l.expiry ? fmtDate(l.expiry) : '–' }}{{ l.expiry && l.expiry < today() ? ' – LEJÁRT!' : '' }}{{ tx.lotPreview(r.id, r.qty).length > 1 ? ` (${l.qty})` : '' }}</div></td>
                  <td class="hide-m">{{ r.pk ? `${r.pk} ${db.items.find(i => i.id === r.id)?.unit}` : '–' }}</td>
                  <td class="hide-m">{{ r.dq !== undefined ? `${r.dq} ${db.items.find(i => i.id === r.id)?.unit}` : '–' }}<div v-if="r.dRel" class="small muted">csomag + {{ r.dRel }}</div></td>
                  <td class="nowrap"><input class="q" type="number" min="0" step="1" :value="r.qty" @change="tx.setQty(r.id, Number(($event.target as HTMLInputElement).value))"> {{ db.items.find(i => i.id === r.id)?.unit }}
                    <button v-if="r.manual" class="reset" :title="`Vissza a javasolt értékre (${r.auto})`" @click="tx.resetQty(r.id)">↺</button></td>
                  <td>
                    <span v-if="r.st === 'ok'" class="badge b-green">✓ egyezik</span>
                    <template v-else-if="r.st === 'diff' || r.st === 'dict'">
                      <span v-if="s.confirmedRows.includes(r.id) || s.recordId" class="badge b-green">✓ megerősítve</span>
                      <template v-else>
                        <span class="badge b-yellow" :title="r.st === 'diff' ? `csomag: ${r.pk}` : 'Csak a diktálásban hangzott el'">⚠ ellenőrizendő</span>
                        <button class="btn sm" style="margin-left:4px" @click="tx.confirmRow(r.id)">Megerősítem</button>
                      </template>
                    </template>
                    <span v-else-if="r.st === 'pkg'" class="badge b-gray">csomag</span>
                    <span v-else class="badge b-blue">kézzel hozzáadva</span>
                  </td>
                </tr>
                <tr v-if="!tx.rows.length"><td colspan="6" class="muted">Válassz kezelést vagy kezdj diktálni – a javaslat itt jelenik meg.</td></tr>
              </tbody>
            </table>
          </div>
          <div class="row" style="margin-top:8px">
            <select class="inp auto" @change="($event.target as HTMLSelectElement).value && tx.addMaterial(($event.target as HTMLSelectElement).value); ($event.target as HTMLSelectElement).value = ''">
              <option value="">+ Anyag hozzáadása a raktárlistából…</option>
              <optgroup v-for="g in groups" :key="g" :label="g"><option v-for="i in db.items.filter(x => x.group === g && !present.has(x.id))" :key="i.id" :value="i.id">{{ i.name }} ({{ i.unit }})</option></optgroup>
            </select>
            <span class="small muted">Sárga = ellenőrizendő eltérés · halvány = csak a csomagból javasolt. Jóváhagyáskor a tételek levonódnak a raktárból.</span>
          </div>
        </div>
      </details>

      <!-- műszercsomag (sterilizálás) -->
      <details class="grp" :class="{ flag: !s.sterBatch }" :open="open.ster" @toggle="open.ster = ($event.target as HTMLDetailsElement).open">
        <summary><span class="gi" style="background:#64748b">♨</span><span class="gt">Sterilizált műszercsomag</span><span class="gs">{{ s.sterBatch ? 'tétel: ' + s.sterBatch : 'nincs kiválasztva' }}</span><span class="chev">▾</span></summary>
        <div class="gb">
          <div v-if="!office.bdToday" class="warn" style="margin-top:0">Ma még nincs rögzítve Bowie–Dick-teszt a sterilizációs naplóban. <NuxtLink to="/sterilizalas">Napló megnyitása</NuxtLink></div>
          <div class="row">
            <select v-model="s.sterBatch" class="inp auto" style="min-width:280px">
              <option :value="null">– nincs megadva –</option>
              <option v-for="c in office.batches" :key="c.id" :value="c.batch">{{ c.batch }} · {{ fmtDate(c.date) }} {{ c.time }} · {{ c.program.split('·')[0] }}</option>
            </select>
            <span class="small muted">A kezeléshez használt műszercsomag sterilizálási tétele kerül a kartonba; sikertelen ciklusnál így visszakereshető, kiknél használták.</span>
          </div>
        </div>
      </details>

      <!-- beleegyező nyilatkozat -->
      <details class="grp" :open="open.consent" @toggle="open.consent = ($event.target as HTMLDetailsElement).open">
        <summary><span class="gi" style="background:var(--gold)">✍</span><span class="gt">Beleegyező nyilatkozat</span><span class="gs">{{ tx.consents.length ? `${tx.consents.length} aláírva` : 'nincs aláírva' }}</span><span class="chev">▾</span></summary>
        <div class="gb">
          <div v-for="c in tx.consents" :key="c.id" class="row small" style="padding:6px 0;border-bottom:1px solid #eef1f3">
            <span class="badge b-green">✓ aláírva</span><b>{{ c.title }}</b><span class="muted">{{ new Date(c.signedAt).toLocaleString('hu-HU') }}</span>
            <div class="spacer" /><button class="btn sm" @click="ui.open(AttachmentViewer, { id: c.attachmentId })">PDF megnyitása</button>
          </div>
          <div class="row" style="margin-top:8px">
            <button class="btn pri" :disabled="!s.types.length" @click="ui.open(ConsentModal, { patientId: p.id, sessKey: s.key, recordId: s.recordId, typeIds: [...s.types], teeth: [...s.teeth], doctorId: s.doctorId })">✍ Nyilatkozat aláíratása tableten</button>
            <span class="small muted">{{ s.types.length ? 'A szöveget a program a kiválasztott kezelésből és fogakból készíti elő.' : 'Előbb válaszd ki vagy diktáld a kezelést.' }}</span>
          </div>
        </div>
      </details>

      <!-- csatolmányok -->
      <details class="grp" :open="open.att" @toggle="open.att = ($event.target as HTMLDetailsElement).open">
        <summary><span class="gi" style="background:var(--orange)"><AppIcon name="image" :size="18" /></span><span class="gt">Csatolmányok</span><span class="gs">{{ tx.attachments.length ? `${tx.attachments.length} db` : 'nincs' }}</span><span class="chev">▾</span></summary>
        <div class="gb">
          <div class="att-up" :class="{ drag }" @dragover.prevent="drag = true" @dragleave="drag = false" @drop.prevent="drag = false; upload($event.dataTransfer?.files || null)">
            <div class="row">
              <div><label class="f">Dokumentum típusa</label><select v-model="attType" class="inp auto"><option v-for="[k, n] in DOC_TYPES" :key="k" :value="k">{{ n }}</option></select></div>
              <div style="flex:1;min-width:200px"><label class="f">Megjegyzés</label><input v-model="attNote" class="inp" placeholder="pl. 46-os fog, kezelés előtt"></div>
              <div><label class="f">&nbsp;</label><label class="btn pri">⬆ Fájl feltöltése<input type="file" multiple style="display:none" :accept="ATT_ACCEPT" @change="upload(($event.target as HTMLInputElement).files); ($event.target as HTMLInputElement).value = ''"></label></div>
            </div>
            <div class="small muted" style="margin-top:6px">Vagy húzd ide a fájlokat. Kép (JPG, PNG), PDF, 3D modell (STL, PLY, OBJ), DICOM és ZIP. Demó: a fájl csak ebben a böngészőben tárolódik. A röntgenkép (periapikális, szárnyas, OPG) a fogtérkép helyére váltható.</div>
          </div>
          <div class="att-list">
            <AttachmentCard v-for="a in tx.attachments" :key="a.id" :a="a" removable @open="ui.open(AttachmentViewer, { id: a.id })" @remove="removeAtt(a.id)" />
          </div>
        </div>
      </details>

      <!-- betegösszefoglaló -->
      <details class="grp" :open="open.sum" @toggle="open.sum = ($event.target as HTMLDetailsElement).open">
        <summary><span class="gi" style="background:var(--purple)"><AppIcon name="sparkle" :size="18" /></span><span class="gt">Betegösszefoglaló</span><span class="gs">{{ p.healthWarning ? '⚕ ' + p.healthWarning : 'gyors kivonat a kartonból' }}</span><span class="chev">▾</span></summary>
        <div class="gb"><PatientSummary :patient-id="p.id" /></div>
      </details>

      <div class="card row txbar">
        <button class="btn" @click="cancel">Mégse</button>
        <div class="spacer" />
        <span v-if="tx.toReview" class="badge b-yellow">⚠ {{ tx.toReview }} sor megerősítésre vár</span>
        <span class="small muted hide-m">Mentéskor véglegesül: a kartonba kerül, és csak ekkor vonódik le az anyag a raktárból.</span>
        <span class="small muted" :title="'Anyagköltség átlagáron: ' + fmtPrice(tx.cost)">anyag: {{ fmtFt(tx.cost) }}</span>
        <span class="fee">{{ fmtFt(tx.fee) }}</span>
        <button class="btn go" @click="approve"><AppIcon name="check" :size="16" />Mentés és véglegesítés</button>
      </div>
    </template>
  </div>
</template>
