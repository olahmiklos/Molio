<script setup lang="ts">
// Raktár: készlet és előrejelzés (2.3, 2.3.1), átlagár (2.3.3), rendelési javaslat (2.3.4),
// gyártási tételek, lejárat és visszakövetés (2.3.5)
import { useDataStore } from '~/stores/data'
import { useInventoryStore } from '~/stores/inventory'
import { useUiStore } from '~/stores/ui'
import { addDays, fmtDate, fmtFt, fmtPrice, today } from '~/utils/dates'
import { HORIZON, reserveLabel } from '~/utils/logic'
import { emptyFilters, filterChips, filterRows, stockRows } from '~/utils/stockFilter'
import { ORDER_ST } from '~/utils/stock'
import type { SavedFilter, StockFilters } from '~/utils/types'
import { uid } from '~/utils/dates'
import { teethStr } from '~/utils/teeth'
import ItemModal from '~/components/modals/ItemModal.vue'
import ReceiptModal from '~/components/modals/ReceiptModal.vue'
import NewItemModal from '~/components/modals/NewItemModal.vue'
import OrderModal from '~/components/modals/OrderModal.vue'
const data = useDataStore()
const inv = useInventoryStore()
const ui = useUiStore()
const route = useRoute()
const t0 = today()
const db = computed(() => data.db)
type Tab = 'stock' | 'order' | 'orders' | 'lots'
const tabOf = (v: unknown): Tab => (['order', 'orders', 'lots'].includes(String(v)) ? (v as Tab) : 'stock')
const tab = ref<Tab>(tabOf(route.query.tab))
watch(() => route.query.tab, v => { tab.value = tabOf(v) })

/* ---------- Készlet: szűrők, mentett szűrők, rendezés (10. pont) ---------- */
const filters = ref<StockFilters>(emptyFilters())
const showFilters = ref(false)
const saveName = ref('')
const allRows = computed(() => stockRows(db.value))
type SortKey = 'urgency' | 'name' | 'stock' | 'price' | 'weekly' | 'runOut' | 'lead' | 'orderBy'
const sort = ref<{ key: SortKey; dir: 1 | -1 }>({ key: 'urgency', dir: 1 })
function sortBy(k: SortKey) { sort.value = sort.value.key === k ? { key: k, dir: (sort.value.dir * -1) as 1 | -1 } : { key: k, dir: 1 } }
const arrow = (k: SortKey) => (sort.value.key === k ? (sort.value.dir === 1 ? ' ▲' : ' ▼') : '')
const shown = computed(() => {
  const rows = filterRows(allRows.value, filters.value), { key, dir } = sort.value
  if (key === 'urgency') { const order = new Map(inv.rows.map((r, i) => [r.it.id, i])); return rows.slice().sort((a, b) => dir * ((order.get(a.it.id) ?? 0) - (order.get(b.it.id) ?? 0))) }
  const val = (r: (typeof rows)[number]) => key === 'name' ? r.it.name : key === 'stock' ? r.it.stock : key === 'price' ? r.it.price : key === 'weekly' ? r.weekly : key === 'lead' ? r.it.lead : key === 'runOut' ? (r.f.runOut || '9999') : (r.f.orderBy || '9999')
  return rows.slice().sort((a, b) => { const x = val(a), y = val(b); return dir * (typeof x === 'string' ? x.localeCompare(y as string, 'hu') : (x as number) - (y as number)) })
})
const chips = computed(() => filterChips(filters.value))
function clearChip(k: string) {
  const f = filters.value, e = emptyFilters()
  const map: Record<string, (keyof StockFilters)[]> = { stock: ['stockMin', 'stockMax'], price: ['priceMin', 'priceMax'], use: ['useMin', 'useMax'], lead: ['leadMin', 'leadMax'], by: ['byFrom', 'byTo'] }
  ;(map[k] || [k as keyof StockFilters]).forEach(x => { (f as Record<string, unknown>)[x] = e[x] })
}
const saved = computed(() => db.value.savedFilters)
function applySaved(s: SavedFilter) { filters.value = { ...emptyFilters(), ...JSON.parse(JSON.stringify(s.filters)) } }
function saveFilter() {
  const n = saveName.value.trim(); if (!n) { ui.toast('Adj nevet a mentett szűrőnek.'); return }
  db.value.savedFilters.push({ id: uid(), name: n, filters: JSON.parse(JSON.stringify(filters.value)) }); saveName.value = ''; ui.toast('Szűrő mentve')
}
function renameFilter(s: SavedFilter) { const n = window.prompt('Új név', s.name); if (n && n.trim()) s.name = n.trim() }
async function deleteFilter(s: SavedFilter) {
  if (!(await ui.confirm(`Törlöd a(z) <b>${s.name}</b> mentett szűrőt?`, 'Törlés', true))) return
  db.value.savedFilters = db.value.savedFilters.filter(x => x.id !== s.id)
}
const ordBadge: Record<string, [string, string]> = { ordered: ['Megrendelve', 'b-blue'], short: ['Megrendelve, de kevés lehet', 'b-yellow'], late: ['A szállítás késik', 'b-red'] }
const orderTabSel = ref<'open' | 'all'>('open')
const ordersShown = computed(() => (orderTabSel.value === 'open' ? inv.openOrders : inv.allOrders))
async function cancelOrder(id: string) {
  const reason = window.prompt('A visszavonás indoka (kötelező):'); if (!reason || !reason.trim()) { ui.toast('Indok nélkül nem vonható vissza.'); return }
  inv.cancelOrder(id, reason.trim()); ui.toast('Megrendelés visszavonva – a javaslat visszatér')
}
async function closeManual(id: string) {
  const note = window.prompt('Lezárás indoka (pl. a maradékot nem szállítják):', ''); if (note === null) return
  inv.closeOrderManual(id, note.trim()); ui.toast('Megrendelés lezárva')
}
const bySupplier = computed(() => {
  const m: Record<string, typeof inv.suggestions> = {}
  inv.suggestions.forEach(s => { const k = s.item.supplier || 'Nincs beszállító'; (m[k] = m[k] || []).push(s) })
  return Object.entries(m)
})
const lotQ = ref('')
const hits = computed(() => inv.searchLot(lotQ.value))
const pname = (id: string) => db.value.patients.find(p => p.id === id)?.name || ''
const iname = (id: string) => inv.itemById(id)?.name || '?'
const iunit = (id: string) => inv.itemById(id)?.unit || ''
</script>

<template>
  <div>
    <div class="pagehead">
      <h1>Raktár</h1><span class="pill">Budai telephely</span><span class="muted small">készletérték átlagáron: <b>{{ fmtFt(inv.stockValue) }}</b></span>
      <div class="spacer" />
      <button class="btn" @click="ui.open(ReceiptModal, {})">Bevételezés</button>
      <button class="btn pri" @click="ui.open(NewItemModal, {})"><AppIcon name="plus" :size="16" />Új anyag</button>
    </div>
    <div class="kpis k4">
      <div class="kpi click" @click="tab = 'stock'"><div class="kv-v" style="color:var(--green)">{{ db.items.length }}</div><div class="kv-l">anyagtípus a raktárban</div></div>
      <div class="kpi click" @click="tab = 'order'"><div class="kv-v" style="color:var(--blue)">{{ inv.suggestions.length }}</div><div class="kv-l">tétel rendelése javasolt</div></div>
      <div class="kpi click" @click="tab = 'orders'"><div class="kv-v" style="color:var(--teal)">{{ inv.openOrders.length }}</div><div class="kv-l">leadott, beérkezésre váró rendelés</div></div>
      <div class="kpi click" @click="tab = 'lots'"><div class="kv-v" style="color:var(--red)">{{ inv.expiring.filter(r => r.days <= 60).length }}</div><div class="kv-l">gyártási tétel jár le 60 napon belül</div></div>
    </div>
    <div class="seg scroll-x" style="margin-bottom:14px;max-width:100%">
      <button :class="{ on: tab === 'stock' }" @click="tab = 'stock'">Készlet</button>
      <button :class="{ on: tab === 'order' }" @click="tab = 'order'">Rendelési javaslat</button>
      <button :class="{ on: tab === 'orders' }" @click="tab = 'orders'">Megrendelések ({{ inv.openOrders.length }})</button>
      <button :class="{ on: tab === 'lots' }" @click="tab = 'lots'">Lejárat és nyomon követés</button>
    </div>

    <!-- készlet -->
    <template v-if="tab === 'stock'">
      <div class="hint">
        Előrejelzés a <b>{{ fmtDate(t0) }} – {{ fmtDate(addDays(t0, HORIZON)) }}</b> között lefoglalt kezelések alapján (60 nap). „Rendeld meg legkésőbb” = a várható elfogyás napja mínusz a beszerzési idő.
        Az egységár <b>gördülő súlyozott átlagár</b>: minden bevételezésnél újraszámolódik.
        <span class="dot red" />elmúlt vagy 3 napon belül <span class="dot yellow" />7 napon belül <span class="dot green" />ráér
      </div>
      <div class="card" style="padding:12px 14px">
        <div class="row">
          <input v-model="filters.q" class="inp" style="max-width:240px" placeholder="Anyag vagy csoport keresése…">
          <button class="btn sm" :class="{ pri: showFilters }" @click="showFilters = !showFilters">Szűrők{{ chips.length ? ` (${chips.length})` : '' }}</button>
          <span class="small muted">Gyors:</span>
          <button v-for="[k, l] in [['overdue', 'Lejárt határidő'], ['today', 'Ma'], ['week', 'Ezen a héten'], ['month', '30 napon belül']]" :key="k" class="chip" :class="{ on: filters.quick === k }" @click="filters.quick = filters.quick === k ? '' : (k as StockFilters['quick'])">{{ l }}</button>
          <label class="switch" :class="{ on: filters.notOrdered }" @click.prevent="filters.notOrdered = !filters.notOrdered"><i />még nincs megrendelve</label>
          <label class="switch" :class="{ on: filters.belowReserve }" @click.prevent="filters.belowReserve = !filters.belowReserve"><i />tartalék / 10% alatt</label>
        </div>
        <div v-if="showFilters" class="grid3" style="margin-top:10px">
          <div class="field"><label class="f">Készlet (db) – tól / ig</label><div class="row" style="flex-wrap:nowrap"><input v-model.number="filters.stockMin" class="inp" type="number" placeholder="tól"><input v-model.number="filters.stockMax" class="inp" type="number" placeholder="ig"></div></div>
          <div class="field"><label class="f">Átlagár (Ft) – tól / ig</label><div class="row" style="flex-wrap:nowrap"><input v-model.number="filters.priceMin" class="inp" type="number" placeholder="tól"><input v-model.number="filters.priceMax" class="inp" type="number" placeholder="ig"></div></div>
          <div class="field"><label class="f">Várható fogyás (db / hét) – tól / ig</label><div class="row" style="flex-wrap:nowrap"><input v-model.number="filters.useMin" class="inp" type="number" placeholder="tól"><input v-model.number="filters.useMax" class="inp" type="number" placeholder="ig"></div></div>
          <div class="field"><label class="f">Beszerzési idő (nap) – tól / ig</label><div class="row" style="flex-wrap:nowrap"><input v-model.number="filters.leadMin" class="inp" type="number" placeholder="tól"><input v-model.number="filters.leadMax" class="inp" type="number" placeholder="ig"></div></div>
          <div class="field"><label class="f">Rendeld meg legkésőbb – tól / ig</label><div class="row" style="flex-wrap:nowrap"><input v-model="filters.byFrom" class="inp" type="date"><input v-model="filters.byTo" class="inp" type="date"></div></div>
          <div class="field"><label class="f">Telephely</label><select v-model="filters.siteId" class="inp"><option value="">összes</option><option v-for="s in db.sites" :key="s.id" :value="s.id">{{ s.name }}</option></select></div>
        </div>
        <div v-if="chips.length" class="row" style="margin-top:8px">
          <span class="small muted">Aktív szűrők:</span>
          <span v-for="c in chips" :key="c.key" class="chip on" style="cursor:pointer" title="Szűrő törlése" @click="clearChip(c.key)">{{ c.label }} ×</span>
          <button class="btn sm" @click="filters = emptyFilters()">Összes törlése</button>
        </div>
        <div class="row" style="margin-top:8px">
          <span class="small muted">Mentett szűrők:</span>
          <span v-for="s in saved" :key="s.id" class="row" style="gap:2px"><button class="chip" @click="applySaved(s)">{{ s.name }}</button><button class="btn sm" style="padding:2px 6px" title="Átnevezés" @click="renameFilter(s)">✎</button><button class="btn sm" style="padding:2px 6px" title="Törlés" @click="deleteFilter(s)">×</button></span>
          <input v-model="saveName" class="inp" style="max-width:180px" placeholder="Név az aktuális szűrőhöz" @keyup.enter="saveFilter"><button class="btn sm" @click="saveFilter">Szűrő mentése</button>
        </div>
      </div>
      <div class="small muted" style="margin:0 0 6px">{{ shown.length }} / {{ allRows.length }} anyag látszik. A fejlécre kattintva rendezhetsz.</div>
      <div class="card flush scroll-x">
        <table class="t">
          <thead><tr>
            <th class="sortable" @click="sortBy('name')">Anyag{{ arrow('name') }}</th><th class="sortable" @click="sortBy('stock')">Aktuális készlet{{ arrow('stock') }}</th><th class="hide-m sortable" @click="sortBy('price')">Átlagár{{ arrow('price') }}</th>
            <th class="hide-m sortable" @click="sortBy('weekly')">Várható fogyás (db / hét){{ arrow('weekly') }}</th><th class="sortable" @click="sortBy('runOut')">Elfogy kb.{{ arrow('runOut') }}</th><th class="hide-m sortable" @click="sortBy('lead')">Beszerzési idő{{ arrow('lead') }}</th>
            <th class="sortable" @click="sortBy('orderBy')">Rendeld meg legkésőbb{{ arrow('orderBy') }}</th><th class="hide-m" />
          </tr></thead>
          <tbody>
            <tr v-for="{ it, f, weekly, reserve, oi } in shown" :key="it.id" class="click" @click="ui.open(ItemModal, { id: it.id })">
              <td><b>{{ it.name }}</b> <span v-if="it.implant" class="badge b-blue">implantátum</span><span v-else-if="it.lotTracked" class="badge b-gray">LOT</span><br><span class="muted small">{{ it.group }} · {{ it.supplier || 'nincs beszállító' }}</span></td>
              <td class="nowrap">
                <b>{{ it.stock }} {{ it.unit }}</b> <span class="muted small">/ {{ it.target }} ({{ Math.round(it.target ? it.stock / it.target * 100 : 0) }}%)</span>
                <div class="bar"><i :class="{ low: f.low }" :style="`width:${Math.max(0, Math.min(100, it.target ? it.stock / it.target * 100 : 0))}%`" /></div>
                <span v-if="f.neg" class="badge b-red">Készlet-eltérés, leltár indokolt</span><span v-else-if="f.low" class="badge b-red">10% alatt</span>
                <div v-if="reserve" class="small muted">tartalék: {{ reserveLabel(it) }}</div>
              </td>
              <td class="hide-m nowrap">{{ fmtPrice(it.price) }}<div v-if="it.lastPrice && it.lastPrice !== it.price" class="small muted">utolsó: {{ fmtPrice(it.lastPrice) }}</div></td>
              <td class="hide-m">{{ weekly ? `${weekly.toLocaleString('hu-HU', { maximumFractionDigits: 1 })} ${it.unit} / hét` : '–' }}<div v-if="f.planned" class="small muted">{{ f.planned }} {{ it.unit }} / 60 nap</div></td>
              <td class="nowrap">{{ f.runOut ? fmtDate(f.runOut) : '60 napon belül nem' }}</td>
              <td class="hide-m">{{ it.lead }} nap</td>
              <td class="nowrap"><span class="dot" :class="f.level" /><template v-if="f.orderBy"><b>{{ fmtDate(f.orderBy) }}</b> <span v-if="f.orderBy < t0" class="badge b-red">határidő elmúlt</span></template><span v-else class="muted">ráér</span>
                <div v-if="oi.state !== 'none'" style="margin-top:3px"><span class="badge" :class="ordBadge[oi.state]![1]">{{ ordBadge[oi.state]![0] }}</span><div class="small muted">{{ oi.open }} {{ it.unit }} · várható: {{ oi.expected ? fmtDate(oi.expected) : '–' }}</div></div></td>
              <td class="hide-m nowrap" @click.stop>
                <button v-if="oi.state === 'none' || oi.state === 'short' || oi.state === 'late'" class="btn sm" @click="ui.open(OrderModal, { supplier: it.supplier || 'Nincs beszállító', onlyItem: it.id })">Megrendelés leadva</button>
                <button class="btn sm" style="margin-left:4px" @click="ui.open(ReceiptModal, { itemId: it.id })">Bevételezés</button>
              </td>
            </tr>
            <tr v-if="!shown.length"><td colspan="8" class="muted">Nincs a szűrőnek megfelelő anyag.</td></tr>
          </tbody>
        </table>
      </div>
      <p class="muted small">Kattints egy anyagra a mozgásnaplóhoz, a gyártási tételekhez, a heti fogyás grafikonjához és a beállításaihoz. A készlet telephelyszinten vezetett.</p>
    </template>

    <!-- rendelési javaslat -->
    <template v-else-if="tab === 'order'">
      <div class="ai-note">
        <b>A program csak javasol, nem rendel.</b> A javaslatot a lefoglalt kezelések várható fogyásából, a beszerzési időből és a célkészletből számolja
        (javasolt mennyiség = célkészlet − a beszállításig megmaradó készlet − a már megrendelt mennyiség). A rendelést mindig egy munkatárs adja le a beszállítónál;
        utána itt jelzi, hogy megrendelte, így a javaslat nem duplázódik.
      </div>
      <div v-if="!bySupplier.length" class="card"><b>Most nincs rendelendő anyag.</b> <span class="muted">Minden tétel kitart a beszerzési időn túl.</span></div>
      <div v-for="[sup, list] in bySupplier" :key="sup" class="card">
        <div class="row" style="margin-bottom:10px">
          <h2 style="margin:0">{{ sup }}</h2><span class="badge b-gray">{{ list.length }} tétel</span>
          <div class="spacer" />
          <button class="btn pri sm" @click="ui.open(OrderModal, { supplier: sup })">Rendelőlap és „megrendeltem”</button>
        </div>
        <div class="scroll-x">
          <table class="t">
            <thead><tr><th>Anyag</th><th>Készlet</th><th>Javasolt mennyiség</th><th class="hide-m">Indok</th><th>Rendeld meg legkésőbb</th></tr></thead>
            <tbody>
              <tr v-for="s in list" :key="s.item.id">
                <td><b>{{ s.item.name }}</b></td>
                <td class="nowrap">{{ s.item.stock }} / {{ s.item.target }} {{ s.item.unit }}</td>
                <td class="nowrap"><b>{{ s.qty }} {{ s.item.unit }}</b><div v-if="s.onOrder" class="small muted">már megrendelve: {{ s.onOrder }}</div></td>
                <td class="small hide-m">{{ s.reason.replace(/\d{4}-\d{2}-\d{2}/, m => fmtDate(m)) }}</td>
                <td class="nowrap"><span class="dot" :class="s.level" />{{ s.orderBy ? fmtDate(s.orderBy) : 'most' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <p class="muted small">A leadott megrendelések a <a href="#" @click.prevent="tab = 'orders'">Megrendelések</a> fülön követhetők.</p>
    </template>

    <!-- megrendelések követése (11. pont) -->
    <template v-else-if="tab === 'orders'">
      <div class="hint">
        A leadott rendelés a beszállítás idejéig kikerül a „rendelendő” listából. Ha a megrendelt mennyiség nem fedezi a várható fogyást, vagy a szállítás késik, a program újra jelez.
        Bevételezéskor a megrendelést kiválasztva a részleges beérkezés is nyomon követhető; teljes beérkezésnél a megrendelés automatikusan lezárul.
      </div>
      <div class="row" style="margin-bottom:10px"><div class="seg"><button :class="{ on: orderTabSel === 'open' }" @click="orderTabSel = 'open'">Nyitott ({{ inv.openOrders.length }})</button><button :class="{ on: orderTabSel === 'all' }" @click="orderTabSel = 'all'">Összes (előzmény)</button></div></div>
      <div v-for="o in ordersShown" :key="o.id" class="card">
        <div class="row">
          <b>{{ fmtDate(o.date) }}</b><span>{{ o.supplier }}</span><span class="badge" :class="ORDER_ST[o.status]![1]">{{ ORDER_ST[o.status]![0] }}</span>
          <span v-if="o.expected && (o.status === 'ordered' || o.status === 'partial')" class="small" :style="o.expected < t0 ? 'color:var(--red);font-weight:700' : ''">várható beérkezés: {{ fmtDate(o.expected) }}{{ o.expected < t0 ? ' – késik' : '' }}</span>
          <div class="spacer" />
          <span class="small muted">Leadta: {{ o.orderedBy }}{{ o.ref ? ' · ' + o.ref : '' }}</span>
          <template v-if="o.status === 'ordered' || o.status === 'partial'">
            <button class="btn sm" @click="closeManual(o.id)">Lezárás</button><button class="btn sm danger" @click="cancelOrder(o.id)">Visszavonás</button>
          </template>
        </div>
        <div class="small" style="margin-top:6px">
          <span v-for="l in o.lines" :key="l.item" style="margin-right:14px;display:inline-block">{{ iname(l.item) }}: <b>{{ l.received || 0 }} / {{ l.qty }} {{ iunit(l.item) }}</b>
            <button v-if="o.status === 'ordered' || o.status === 'partial'" class="btn sm" style="padding:2px 8px;margin-left:4px" @click="ui.open(ReceiptModal, { itemId: l.item, qty: Math.max(0, l.qty - (l.received || 0)), orderId: o.id, note: `Megrendelés ${fmtDate(o.date)} – ${o.supplier}` })">Bevételezés</button></span>
        </div>
        <div v-if="o.note || o.cancelReason || o.closedNote" class="small muted" style="margin-top:4px">{{ [o.note, o.cancelReason && 'Visszavonás indoka: ' + o.cancelReason, o.closedNote && 'Lezárás: ' + o.closedNote].filter(Boolean).join(' · ') }}</div>
      </div>
      <p v-if="!ordersShown.length" class="muted">Nincs megjeleníthető megrendelés.</p>
    </template>

    <!-- lejárat és nyomon követés -->
    <template v-else>
      <div class="card">
        <h2>Visszahívás és nyomon követés – keresés gyártási számra (LOT)</h2>
        <p class="muted small" style="margin-top:0">Ha a gyártó egy tételt visszahív, írd be a gyártási számot: a program kilistázza, kinél és melyik foghoz használták fel. Implantátumnál a LOT a páciens kartonjában is szerepel.</p>
        <input v-model="lotQ" class="inp" style="max-width:360px" placeholder="pl. IM2408 vagy AR24-0610">
        <div class="row small" style="margin-top:6px"><span class="muted">Minta:</span><a href="#" @click.prevent="lotQ = 'IM2408-2210'">IM2408-2210</a><a href="#" @click.prevent="lotQ = 'IM2405'">IM2405</a><a href="#" @click.prevent="lotQ = 'KA2-2408'">KA2-2408</a></div>
        <div v-if="lotQ.trim().length >= 2" class="scroll-x" style="margin-top:10px">
          <table class="t">
            <thead><tr><th>Dátum</th><th>Páciens</th><th>Anyag</th><th>LOT</th><th>Fog</th><th>Mennyiség</th></tr></thead>
            <tbody>
              <tr v-for="h in hits" :key="h.recordId + h.lot + h.item.id" class="click" @click="navigateTo(`/paciensek/${h.patientId}`)">
                <td class="nowrap">{{ fmtDate(h.date) }}</td><td><b>{{ pname(h.patientId) }}</b></td><td>{{ h.item.name }}</td><td class="nowrap"><b>{{ h.lot }}</b></td><td>{{ teethStr(h.teeth) || '–' }}</td><td class="nowrap">{{ h.qty }} {{ h.item.unit }}</td>
              </tr>
              <tr v-if="!hits.length"><td colspan="6" class="muted">Ezzel a gyártási számmal nem használtak fel anyagot.</td></tr>
            </tbody>
          </table>
          <p v-if="db.lots.some(l => l.lot.toLowerCase().includes(lotQ.trim().toLowerCase()))" class="warn" style="margin:8px 0 0">
            A raktárban is van ilyen tétel: {{ db.lots.filter(l => l.lot.toLowerCase().includes(lotQ.trim().toLowerCase())).map(l => `${iname(l.item)} – ${l.lot}: ${l.qty} ${iunit(l.item)}`).join('; ') }}. Visszahívásnál ezt el kell különíteni.
          </p>
        </div>
      </div>
      <div class="card flush scroll-x">
        <table class="t">
          <thead><tr><th>Lejárat</th><th>Anyag</th><th>Gyártási szám (LOT)</th><th>Mennyiség</th><th class="hide-m">Bevételezve</th></tr></thead>
          <tbody>
            <tr v-for="r in inv.expiring" :key="r.lot.id" class="click" @click="ui.open(ItemModal, { id: r.item.id })">
              <td class="nowrap"><span class="dot" :class="r.level" /><b>{{ fmtDate(r.lot.expiry) }}</b> <span class="small" :style="r.days < 0 ? 'color:var(--red);font-weight:700' : ''">{{ r.days < 0 ? 'lejárt!' : `${r.days} nap múlva` }}</span></td>
              <td>{{ r.item.name }}</td><td class="nowrap"><b>{{ r.lot.lot }}</b></td><td class="nowrap">{{ r.lot.qty }} {{ r.item.unit }}</td><td class="hide-m">{{ fmtDate(r.lot.received) }}</td>
            </tr>
            <tr v-if="!inv.expiring.length"><td colspan="5" class="muted">90 napon belül nem jár le gyártási tétel.</td></tr>
          </tbody>
        </table>
      </div>
      <p class="muted small">A kiadás lejárat szerint történik: a kezeléskor a program mindig a legkorábban lejáró tételből von le. A 90 napon belül lejáró tételek látszanak; piros = 30 napon belül.</p>
    </template>
  </div>
</template>

<style scoped>
.kpis.k4 { grid-template-columns: repeat(4, 1fr) }
.kpi.click { cursor: pointer }
th.sortable { cursor: pointer; user-select: none; white-space: nowrap }
@media (max-width: 760px) { .kpis.k4 { grid-template-columns: 1fr 1fr } }
</style>
