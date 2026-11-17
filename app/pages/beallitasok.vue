<script setup lang="ts">
// Beállítások négy lapon: Klinika, Értesítések, Kezelési csomagok, Anyag-törzsadatok (spec 2.3.2)
import { useDataStore } from '~/stores/data'
import { useInventoryStore } from '~/stores/inventory'
import { useUiStore } from '~/stores/ui'
import { useTreatmentStore } from '~/stores/treatment'
import { fmtDate, fmtFt, fmtPrice, parseKw, today } from '~/utils/dates'
import { defaultNotify } from '~/utils/defaults'
import { fillTpl, futureAppts } from '~/utils/logic'
import { APP_VERSION, SPEC } from '~/utils/meta'
import { CONSENT_TPL } from '~/utils/office'
import ItemModal from '~/components/modals/ItemModal.vue'
import NewItemModal from '~/components/modals/NewItemModal.vue'

const data = useDataStore()
const inv = useInventoryStore()
const ui = useUiStore()
const tx = useTreatmentStore()
const db = computed(() => data.db)
const st = computed(() => db.value.settings)
const tab = ref<'clinic' | 'notify' | 'pkg' | 'master' | 'integr'>('clinic')
const pkgSel = ref(db.value.types[0]?.id || '')
const t = computed(() => db.value.types.find(x => x.id === pkgSel.value))
const hours = Array.from({ length: 17 }, (_, i) => i + 6)
const saved = () => ui.toast('Mentve')

const sample = computed(() => futureAppts(db.value)[0] || { patientId: db.value.patients[0]!.id, doctorId: db.value.doctors[0]!.id, date: today(), start: '10:00', typeIds: [db.value.types[0]!.id] })
function resetTpl() { const d = defaultNotify(); Object.assign(st.value.notify, { smsTpl: d.smsTpl, mailSubj: d.mailSubj, mailTpl: d.mailTpl }); saved() }

function setKw(obj: { kw: string[] }, v: string) { obj.kw = parseKw(v); saved() }
function addType() { const n = inv.addType(); pkgSel.value = n.id; ui.toast('Új kezeléstípus létrehozva – add meg a nevét és a csomagját') }
async function delType(id: string) {
  const err = inv.deleteTypeCheck(id); if (err) { ui.toast(err); return }
  if (!(await ui.confirm('Törlöd ezt a kezeléstípust?', 'Törlés', true))) return
  inv.deleteType(id); pkgSel.value = db.value.types[0]?.id || ''
}
function addMat(id: string) { if (!t.value || !id) return; t.value.mats.push({ item: id, qty: 1, per: 'visit' }); saved() }
function togglePriceBySurf(on: boolean) {
  if (!t.value) return
  if (on) { t.value.priceBySurf = [t.value.price || 25000, Math.round((t.value.price || 25000) * 1.28), Math.round((t.value.price || 25000) * 1.52)]; t.value.needsSurface = true }
  else { t.value.priceBySurf = null; t.value.needsSurface = false }
  saved()
}
async function delItem(id: string) {
  const err = inv.deleteItemCheck(id); if (err) { ui.toast(err); return }
  const it = inv.itemById(id)
  if (!(await ui.confirm(`Törlöd ezt az anyagot a törzsadatokból: <b>${it?.name}</b>?`, 'Törlés', true))) return
  inv.deleteItem(id); ui.toast('Anyag törölve')
}
function addStatusDef() { st.value.statusDict.push({ id: 's' + Date.now().toString(36), name: 'új állapot', kw: [] }) }
async function resetDemo() {
  if (!(await ui.confirm('Minden adat visszaáll a kiinduló mintaadatokra. A saját felvitt páciensek, időpontok, kezelések és csatolmányok törlődnek. Folytatod?', 'Visszaállítás', true))) return
  tx.cancel(); await data.reset(); ui.toast('Visszaállítva alaphelyzetbe'); navigateTo('/')
}
</script>

<template>
  <div>
    <div class="pagehead">
      <h1>Beállítások</h1>
      <div class="spacer" />
      <div class="seg scroll-x" style="max-width:100%">
        <button :class="{ on: tab === 'clinic' }" @click="tab = 'clinic'">Klinika</button>
        <button :class="{ on: tab === 'notify' }" @click="tab = 'notify'">Értesítések</button>
        <button :class="{ on: tab === 'pkg' }" @click="tab = 'pkg'">Kezelési csomagok</button>
        <button :class="{ on: tab === 'master' }" @click="tab = 'master'">Anyag-törzsadatok</button>
        <button :class="{ on: tab === 'integr' }" @click="tab = 'integr'">Kapcsolatok</button>
      </div>
    </div>

    <div class="ai-note">
      <b>Molio 2.0 – bemutató verzió:</b> a diktálásnál ez a verzió csak szövegfelismerést tartalmaz (a böngésző beépített magyar beszédfelismerése és szabályalapú értelmezés).
      A mesterséges intelligenciával készülő összefoglaló, a pontosabb AI-strukturálás és a hozzá tartozó kulcskezelés a későbbi verziókban lesz elérhető; a demóban nincs AI-kapcsolat és nem kell API-kulcsot megadni.
    </div>

    <!-- klinika -->
    <template v-if="tab === 'clinic'">
      <div class="card">
        <h2>Klinika</h2>
        <div class="grid3">
          <div class="field"><label class="f">Név</label><input v-model.lazy="st.clinic" class="inp" @change="saved"></div>
          <div class="field"><label class="f">Cím</label><input v-model.lazy="st.address" class="inp" @change="saved"></div>
          <div class="field"><label class="f">Telefon</label><input v-model.lazy="st.phone" class="inp" @change="saved"></div>
          <div class="field"><label class="f">Rendelés kezdete</label><select v-model.number="st.startHour" class="inp" @change="saved"><option v-for="h in hours" :key="h" :value="h">{{ h }}:00</option></select></div>
          <div class="field"><label class="f">Rendelés vége</label><select v-model.number="st.endHour" class="inp" @change="saved"><option v-for="h in hours" :key="h" :value="h">{{ h }}:00</option></select></div>
          <div class="field"><label class="f">Előrejelzési ablak</label><input class="inp" value="60 nap (2 hónap)" disabled></div>
          <div class="field"><label class="f">Tejfogazat javaslata ennyi éves kor alatt</label><input v-model.number="st.primaryAgeLimit" class="inp" type="number" min="1" max="18" @change="saved"></div>
          <div class="field"><label class="f">Ráhagyás a megjelölt pácienseknél</label><select v-model.number="st.patientBuffer" class="inp" @change="saved"><option :value="30">30 perc</option><option :value="60">60 perc</option></select></div>
          <div class="field"><label class="f">Szervezet</label><input class="inp" :value="`${db.company.name} · ${db.sites[0]?.name} · ${db.rooms[0]?.name}`" disabled></div>
        </div>
        <p class="small muted" style="margin:0">A demó egy céget, egy telephelyet és egy rendelőt kezel; a több telephely és rendelő a későbbi verzió része (az adatmodell már előkészített).</p>
      </div>
      <div class="card">
        <h2>Demó adatai</h2>
        <p class="muted" style="margin-top:0">A mintaadatok {{ fmtDate(db.seededAt) }}-án készültek ehhez a böngészőhöz. Az adatok csak ezen az eszközön és ebben a böngészőben tárolódnak.</p>
        <div class="row"><button class="btn danger" @click="resetDemo">Visszaállítás alaphelyzetbe</button><NuxtLink to="/nevjegy" class="btn">Névjegy és verzió</NuxtLink><NuxtLink to="/sugo" class="btn">Kézikönyv (PDF)</NuxtLink><span class="small muted">Molio {{ APP_VERSION }} · {{ SPEC.title }}</span></div>
      </div>
    </template>

    <!-- értesítések -->
    <template v-else-if="tab === 'notify'">
      <div class="card">
        <h2>Alapértelmezett emlékeztető</h2>
        <p class="muted" style="margin-top:0">Új páciensnél ez a kiinduló beállítás; a recepciós a foglaláskor megkérdezi a pácienst, és átállíthatja. A páciens választását a program megjegyzi.</p>
        <div class="row">
          <label class="chip" :class="{ on: st.notify.sms }" @click.prevent="st.notify.sms = !st.notify.sms; saved()">📱 SMS</label>
          <label class="chip" :class="{ on: st.notify.email }" @click.prevent="st.notify.email = !st.notify.email; saved()">✉ E-mail</label>
          <select v-model="st.notify.timing" class="inp auto" @change="saved"><option value="24">24 órával előtte</option><option value="48">48 órával előtte</option><option value="24+2">24 és 2 órával előtte</option></select>
        </div>
      </div>
      <div class="card">
        <h2>Üzenetsablonok</h2>
        <div class="hint">Behelyettesíthető mezők: {név} {dátum} {idő} {orvos} {kezelés} {klinika} {cím} {telefon}</div>
        <div class="grid2">
          <div>
            <div class="field"><label class="f">SMS szövege <span class="n">({{ fillTpl(db, st.notify.smsTpl, sample).length }} karakter a mintával)</span></label><textarea v-model.lazy="st.notify.smsTpl" class="inp" rows="4" @change="saved" /></div>
            <div class="field"><label class="f">E-mail tárgya</label><input v-model.lazy="st.notify.mailSubj" class="inp" @change="saved"></div>
            <div class="field"><label class="f">E-mail szövege</label><textarea v-model.lazy="st.notify.mailTpl" class="inp" rows="9" @change="saved" /></div>
          </div>
          <div>
            <label class="f">Előnézet (a következő időpont adataival)</label>
            <div class="sms">{{ fillTpl(db, st.notify.smsTpl, sample) }}</div>
            <div class="mail" style="margin-top:12px"><b>{{ fillTpl(db, st.notify.mailSubj, sample) }}</b><hr><span style="white-space:pre-line">{{ fillTpl(db, st.notify.mailTpl, sample) }}</span></div>
          </div>
        </div>
        <div class="row"><div class="spacer" /><button class="btn sm" @click="resetTpl">Sablonok visszaállítása</button></div>
      </div>
    </template>

    <!-- kezelési csomagok -->
    <template v-else-if="tab === 'pkg'">
      <div class="card">
        <div class="row" style="margin-bottom:14px">
          <h2 style="margin:0">Kezelési csomag</h2>
          <select v-model="pkgSel" class="inp auto" style="min-width:260px;font-weight:700"><option v-for="x in db.types" :key="x.id" :value="x.id">{{ x.name }}</option></select>
          <div class="spacer" />
          <button class="btn" @click="addType">+ Új kezeléstípus</button>
          <button v-if="t" class="btn danger" @click="delType(t.id)">Törlés</button>
        </div>
        <div class="hint"><b>Alkalmanként</b>: egyszer kerül a javaslatba (pl. kesztyű). <b>Foganként</b>: a kezelt fogak számával szorzódik. <b>Felszínenként</b>: a kezelt felszínek számával szorzódik (pl. kompozit, bond).</div>
        <div v-if="t" class="pkg-card" :style="`border-left-color:${t.color}`">
          <div class="grid3">
            <div class="field"><label class="f">Kezelés neve</label><input v-model.lazy="t.name" class="inp" @change="saved"></div>
            <div class="field"><label class="f">Alapidő</label><select v-model.number="t.dur" class="inp" @change="saved"><option v-for="m in [30, 60, 90, 120, 150, 180]" :key="m" :value="m">{{ m }} perc</option></select></div>
            <div class="field"><label class="f">Ráhagyási idő utána</label><select v-model.number="t.buffer" class="inp" @change="saved"><option :value="0">nincs</option><option :value="30">30 perc</option><option :value="60">60 perc</option></select></div>
            <div class="field">
              <label class="f">Díj</label>
              <label class="switch" :class="{ on: !!t.priceBySurf }" style="margin-bottom:6px" @click.prevent="togglePriceBySurf(!t.priceBySurf)"><i />felszínszám szerint (felszín kötelező)</label>
              <input v-if="!t.priceBySurf" v-model.number="t.price" class="inp" type="number" min="0" step="1000" @change="saved">
            </div>
            <template v-if="t.priceBySurf">
              <div class="field"><label class="f">1 felszín (Ft)</label><input v-model.number="t.priceBySurf[0]" class="inp" type="number" step="1000" @change="saved"></div>
              <div class="field"><label class="f">2 felszín (Ft)</label><input v-model.number="t.priceBySurf[1]" class="inp" type="number" step="1000" @change="saved"></div>
              <div class="field"><label class="f">3 vagy több felszín (Ft)</label><input v-model.number="t.priceBySurf[2]" class="inp" type="number" step="1000" @change="saved"></div>
            </template>
            <div class="field"><label class="f">Kontroll-meghívó (recall)</label><select v-model.number="t.recallMonths" class="inp" @change="saved"><option :value="0">nincs</option><option v-for="m in [3, 4, 6, 9, 12, 18, 24]" :key="m" :value="m">{{ m }} hónap múlva</option></select></div>
            <div class="field"><label class="f">Beleegyező nyilatkozat sablonja</label><select v-model="t.consent" class="inp" @change="saved"><option :value="undefined">általános</option><option v-for="(c, k) in CONSENT_TPL" :key="k" :value="k">{{ c.title.replace('Beleegyező nyilatkozat – ', '') }}</option></select></div>
            <div class="field"><label class="f">Szín a fogtérképen</label><input v-model.lazy="t.color" class="inp" type="color" style="padding:4px;height:40px" @change="saved"></div>
            <div class="field" style="grid-column:1 / -1"><label class="f">Kulcsszavak a diktáláshoz <span class="n">(vesszővel; * = minden ragozott alak)</span></label><input class="inp" :value="t.kw.join(', ')" @change="setKw(t, ($event.target as HTMLInputElement).value)"></div>
          </div>
          <div class="scroll-x">
            <table class="t">
              <thead><tr><th>Anyag</th><th class="hide-m">Csoport</th><th>Mennyiség</th><th>Mód</th><th class="hide-m">Becsült költség</th><th /></tr></thead>
              <tbody>
                <tr v-for="(m, i) in t.mats" :key="m.item + i">
                  <td><b>{{ inv.itemById(m.item)?.name || '?' }}</b></td>
                  <td class="small muted hide-m">{{ inv.itemById(m.item)?.group }}</td>
                  <td class="nowrap"><input v-model.number="m.qty" class="inp" style="width:84px" type="number" min="0" @change="saved"> {{ inv.itemById(m.item)?.unit }}</td>
                  <td><select v-model="m.per" class="inp auto" @change="saved"><option value="visit">alkalmanként</option><option value="tooth">foganként</option><option value="surface">felszínenként</option></select></td>
                  <td class="hide-m">{{ fmtFt(m.qty * (inv.itemById(m.item)?.price || 0)) }}</td>
                  <td><button class="btn sm danger" @click="t.mats.splice(i, 1); saved()">Törlés</button></td>
                </tr>
                <tr v-if="!t.mats.length"><td colspan="6" class="muted">A csomag még üres.</td></tr>
              </tbody>
            </table>
          </div>
          <div class="row" style="margin-top:10px">
            <select class="inp auto" @change="addMat(($event.target as HTMLSelectElement).value); ($event.target as HTMLSelectElement).value = ''">
              <option value="">+ Anyag hozzáadása a csomaghoz…</option>
              <optgroup v-for="g in inv.groups" :key="g" :label="g"><option v-for="i in db.items.filter(x => x.group === g && !t!.mats.some(m => m.item === x.id))" :key="i.id" :value="i.id">{{ i.name }} ({{ i.unit }})</option></optgroup>
            </select>
            <div class="spacer" /><span class="muted">Becsült anyagköltség (1 fog, 1 felszín): <b>{{ fmtFt(inv.pkgCost(t)) }}</b></span>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="row" style="margin-bottom:10px"><h2 style="margin:0">Fogazati státusz – felismerési szótár</h2><div class="spacer" /><button class="btn sm" @click="addStatusDef">+ Új állapot</button></div>
        <p class="muted small" style="margin-top:0">A státuszfelvétel üzemmódban ezek alapján ismeri fel a program a fog állapotát. A * végű szó minden ragozott alakra illik.</p>
        <div class="scroll-x">
          <table class="t">
            <thead><tr><th>Állapot</th><th>Kulcsszavak</th></tr></thead>
            <tbody>
              <tr v-for="d in st.statusDict" :key="d.id">
                <td style="width:220px"><input v-model.lazy="d.name" class="inp" @change="saved"></td>
                <td><input class="inp" :value="d.kw.join(', ')" @change="setKw(d, ($event.target as HTMLInputElement).value)"></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <!-- külső kapcsolatok (szemléltetés) -->
    <template v-else-if="tab === 'integr'">
      <div class="card">
        <div class="row"><h2 style="margin:0">EESZT – Elektronikus Egészségügyi Szolgáltatási Tér</h2><span class="badge b-yellow">demó: szimulált</span></div>
        <p style="line-height:1.6">A végleges rendszerben a kezelés jóváhagyásakor a Molio automatikusan beküldi az ellátási eseményt és az ambuláns lapot, így az orvosnak és az asszisztensnek nem kell külön felületen rögzítenie. A kartonban kezelésenként látszik az állapot (beküldésre vár / beküldve).</p>
        <p class="small muted" style="margin:0">Éles bekötéshez szükséges: EESZT-csatlakozási engedély és tanúsítás, intézményi azonosító, orvosi pecsétszámok, a szerveroldali tanúsítványkezelés. Most beküldésre vár: <b>{{ db.records.filter(r => r.eeszt?.status === 'pending').length }}</b> kezelés.</p>
      </div>
      <div class="card">
        <div class="row"><h2 style="margin:0">Számlázó program</h2><span class="badge b-yellow">demó: szimulált</span></div>
        <p style="line-height:1.6">A Molio a nap kezeléseiből összeállítja a számla tételeit (kezelés, fog, díj), a fizetési módot és – egészségpénztári fizetésnél – a pénztárat. A számlát a csatolt számlázó program (pl. Számlázz.hu vagy Billingo) állítja ki és jelenti a NAV Online Számla rendszerébe; a Molio nem saját számlázó.</p>
        <div class="grid3">
          <div class="field"><label class="f">Számlázó</label><select class="inp" disabled><option>Számlázz.hu (a végleges verzióban választható)</option></select></div>
          <div class="field"><label class="f">API-kulcs</label><input class="inp" disabled placeholder="a végleges verzióban adható meg"></div>
          <div class="field"><label class="f">Áfa</label><input class="inp" disabled value="könyvelővel egyeztetve állítandó be"></div>
        </div>
        <p class="small muted" style="margin:0">Demóban kiállított (szimulált) számlák: <b>{{ db.invoices.length }}</b>.</p>
      </div>
      <div class="card">
        <div class="row"><h2 style="margin:0">Mesterséges intelligencia</h2><span class="badge b-gray">későbbi verzió</span></div>
        <p style="line-height:1.6;margin-bottom:0">A páciens-tájékoztató a demóban sablon alapján készül. A végleges verzióban az AI írja a diktálásból, de a küldés előtt az orvos jóváhagyása ott is kötelező. Az orvos a saját Anthropic API-kulcsát a beállításokban adja meg.</p>
      </div>
    </template>

    <!-- anyag-törzsadatok -->
    <template v-else>
      <div class="row" style="margin-bottom:16px;align-items:stretch">
        <div class="hint" style="margin:0;flex:1">Anyagonként a beszállító, a beszerzési idő, az átlagár (bevételezéskor számolódik), a célkészlet és a diktáláshoz tartozó kulcsszavak. A mintában szereplő beszállítók kitaláltak, az árak becsült, tájékoztató értékek. <b>Teljes készletérték: {{ fmtFt(inv.stockValue) }}</b></div>
        <button class="btn pri" @click="ui.open(NewItemModal, {})">+ Új anyag / csoport</button>
      </div>
      <div v-for="g in inv.groups" :key="g" class="card">
        <div class="row" style="margin-bottom:10px">
          <h2 style="margin:0">{{ g }}</h2><span class="badge b-gray">{{ db.items.filter(i => i.group === g).length }} típus</span>
          <div class="spacer" /><button class="btn sm" @click="ui.open(NewItemModal, { group: g })">+ Új típus ebbe a csoportba</button>
        </div>
        <div class="scroll-x">
          <table class="t">
            <thead><tr><th>Megnevezés</th><th>Egység</th><th>Beszállító</th><th>Beszerzési idő</th><th>Átlagár</th><th>Célkészlet</th><th>Készlet</th><th /></tr></thead>
            <tbody>
              <tr v-for="i in db.items.filter(x => x.group === g)" :key="i.id">
                <td><input v-model.lazy="i.name" class="inp" style="min-width:260px" @change="saved"></td>
                <td><input v-model.lazy="i.unit" class="inp" style="width:84px" @change="saved"></td>
                <td><input v-model.lazy="i.supplier" class="inp" style="min-width:160px" @change="saved"></td>
                <td class="nowrap"><input v-model.number="i.lead" class="inp" type="number" min="0" style="width:70px" @change="saved"> nap</td>
                <td class="nowrap" title="Bevételezéskor számolódik (gördülő súlyozott átlag)">{{ fmtPrice(i.price) }}</td>
                <td><input v-model.number="i.target" class="inp" type="number" min="1" style="width:84px" @change="saved"></td>
                <td class="nowrap">{{ i.stock }} {{ i.unit }}</td>
                <td class="nowrap"><button class="btn sm" @click="ui.open(ItemModal, { id: i.id })">Részletek</button> <button class="btn sm danger" @click="delItem(i.id)">×</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>
