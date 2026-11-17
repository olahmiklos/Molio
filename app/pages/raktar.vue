<script setup lang="ts">
// Raktár: készlet és előrejelzés (2.3, 2.3.1), átlagár (2.3.3), rendelési javaslat (2.3.4),
// gyártási tételek, lejárat és visszakövetés (2.3.5)
import { useDataStore } from '~/stores/data'
import { useInventoryStore } from '~/stores/inventory'
import { useUiStore } from '~/stores/ui'
import { addDays, fmtDate, fmtFt, fmtPrice, today } from '~/utils/dates'
import { HORIZON } from '~/utils/logic'
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
const tab = ref<'stock' | 'order' | 'lots'>((['order', 'lots'].includes(String(route.query.tab)) ? route.query.tab : 'stock') as 'stock')
watch(() => route.query.tab, v => { tab.value = (['order', 'lots'].includes(String(v)) ? v : 'stock') as 'stock' })
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
async function closeOrder(id: string) {
  if (!(await ui.confirm('Lezárod a megrendelést? (Az áru bevételezése külön, a Bevételezés gombbal történik, egységárral és gyártási számmal.)', 'Lezárás'))) return
  inv.closeOrder(id); ui.toast('Megrendelés lezárva')
}
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
      <div class="kpi click" @click="tab = 'order'"><div class="kv-v" style="color:var(--teal)">{{ inv.openOrders.length }}</div><div class="kv-l">leadott, beérkezésre váró rendelés</div></div>
      <div class="kpi click" @click="tab = 'lots'"><div class="kv-v" style="color:var(--red)">{{ inv.expiring.filter(r => r.days <= 60).length }}</div><div class="kv-l">gyártási tétel jár le 60 napon belül</div></div>
    </div>
    <div class="seg scroll-x" style="margin-bottom:14px;max-width:100%">
      <button :class="{ on: tab === 'stock' }" @click="tab = 'stock'">Készlet</button>
      <button :class="{ on: tab === 'order' }" @click="tab = 'order'">Rendelési javaslat</button>
      <button :class="{ on: tab === 'lots' }" @click="tab = 'lots'">Lejárat és nyomon követés</button>
    </div>

    <!-- készlet -->
    <template v-if="tab === 'stock'">
      <div class="hint">
        Előrejelzés a <b>{{ fmtDate(t0) }} – {{ fmtDate(addDays(t0, HORIZON)) }}</b> között lefoglalt kezelések alapján (60 nap). „Rendeld meg legkésőbb” = a várható elfogyás napja mínusz a beszerzési idő.
        Az egységár <b>gördülő súlyozott átlagár</b>: minden bevételezésnél újraszámolódik.
        <span class="dot red" />elmúlt vagy 3 napon belül <span class="dot yellow" />7 napon belül <span class="dot green" />ráér
      </div>
      <div class="card flush scroll-x">
        <table class="t">
          <thead><tr><th>Anyag</th><th>Aktuális készlet</th><th class="hide-m">Átlagár</th><th class="hide-m">Várható fogyás (60 nap)</th><th>Elfogy kb.</th><th class="hide-m">Beszerzési idő</th><th>Rendeld meg legkésőbb</th><th class="hide-m" /></tr></thead>
          <tbody>
            <tr v-for="{ it, f } in inv.rows" :key="it.id" class="click" @click="ui.open(ItemModal, { id: it.id })">
              <td><b>{{ it.name }}</b> <span v-if="it.implant" class="badge b-blue">implantátum</span><span v-else-if="it.lotTracked" class="badge b-gray">LOT</span><br><span class="muted small">{{ it.group }} · {{ it.supplier || 'nincs beszállító' }}</span></td>
              <td class="nowrap">
                <b>{{ it.stock }} {{ it.unit }}</b> <span class="muted small">/ {{ it.target }} ({{ Math.round(it.target ? it.stock / it.target * 100 : 0) }}%)</span>
                <div class="bar"><i :class="{ low: f.low }" :style="`width:${Math.max(0, Math.min(100, it.target ? it.stock / it.target * 100 : 0))}%`" /></div>
                <span v-if="f.neg" class="badge b-red">Készlet-eltérés, leltár indokolt</span><span v-else-if="f.low" class="badge b-red">10% alatt</span>
              </td>
              <td class="hide-m nowrap">{{ fmtPrice(it.price) }}<div v-if="it.lastPrice && it.lastPrice !== it.price" class="small muted">utolsó: {{ fmtPrice(it.lastPrice) }}</div></td>
              <td class="hide-m">{{ f.planned ? `${f.planned} ${it.unit}` : '–' }}</td>
              <td class="nowrap">{{ f.runOut ? fmtDate(f.runOut) : '60 napon belül nem' }}</td>
              <td class="hide-m">{{ it.lead }} nap</td>
              <td class="nowrap"><span class="dot" :class="f.level" /><template v-if="f.orderBy"><b>{{ fmtDate(f.orderBy) }}</b> <span v-if="f.orderBy < t0" class="badge b-red">határidő elmúlt</span></template><span v-else class="muted">ráér</span></td>
              <td class="hide-m"><button class="btn sm" @click.stop="ui.open(ReceiptModal, { itemId: it.id })">Bevételezés</button></td>
            </tr>
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
      <div class="card">
        <h2>Leadott megrendelések</h2>
        <div v-for="o in inv.openOrders" :key="o.id" class="rec">
          <div class="row">
            <b>{{ fmtDate(o.date) }}</b><span>{{ o.supplier }}</span><span class="badge b-blue">megrendelve – beérkezésre vár</span>
            <div class="spacer" />
            <span class="small muted">Leadta: {{ o.orderedBy }}</span>
            <button class="btn sm" @click="closeOrder(o.id)">Lezárás</button>
          </div>
          <div class="small" style="margin-top:6px">
            <span v-for="l in o.lines" :key="l.item" style="margin-right:14px">{{ iname(l.item) }}: <b>{{ l.qty }} {{ iunit(l.item) }}</b> <button class="btn sm" style="padding:2px 8px" @click="ui.open(ReceiptModal, { itemId: l.item, qty: l.qty, note: `Megrendelés ${fmtDate(o.date)} – ${o.supplier}` })">Bevételezés</button></span>
          </div>
          <div v-if="o.note" class="small muted" style="margin-top:4px">{{ o.note }}</div>
        </div>
        <p v-if="!inv.openOrders.length" class="muted" style="margin:0">Nincs nyitott megrendelés.</p>
      </div>
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
@media (max-width: 760px) { .kpis.k4 { grid-template-columns: 1fr 1fr } }
</style>
