<script setup lang="ts">
// Anyag részletei: heti fogyás, beállítások (kulcsszavak a diktáláshoz), mozgásnapló
import { useDataStore } from '~/stores/data'
import { useInventoryStore } from '~/stores/inventory'
import { useUiStore } from '~/stores/ui'
import { dayDiff, fmtDate, fmtNum, fmtPrice, parseKw, today } from '~/utils/dates'
import ReceiptModal from './ReceiptModal.vue'
const props = defineProps<{ id: string }>()
const data = useDataStore()
const inv = useInventoryStore()
const ui = useUiStore()
const it = computed(() => inv.itemById(props.id)!)
const f = computed(() => inv.forecast(it.value))
const form = ref({ name: it.value.name, group: it.value.group, unit: it.value.unit, supplier: it.value.supplier, target: it.value.target, lead: it.value.lead, kw: it.value.kw.join(', '), lotTracked: !!it.value.lotTracked, implant: !!it.value.implant, safeMode: (it.value.safety?.mode || 'qty') as 'qty' | 'weeks', safeVal: it.value.safety?.value || 0 })
const lots = computed(() => inv.lots(it.value.id))
const untracked = computed(() => inv.untracked(it.value))
const days = (d: string) => dayDiff(today(), d)
import { ORDER_ST } from '~/utils/stock'
const kind: Record<string, string> = { use: 'Felhasználás', in: 'Bevételezés', corr: 'Korrekció' }
const pname = (id?: string) => (id ? data.db.patients.find(p => p.id === id)?.name || '' : '')
function save() {
  const v = form.value, i = it.value
  i.name = v.name.trim() || i.name; i.unit = v.unit.trim() || i.unit; i.group = v.group.trim() || i.group; i.supplier = v.supplier.trim()
  i.lotTracked = v.lotTracked; i.implant = v.implant; i.target = Math.max(1, Number(v.target) || i.target); i.lead = Math.max(0, Number(v.lead) || 0); i.kw = parseKw(v.kw)
  i.safety = Number(v.safeVal) > 0 ? { mode: v.safeMode, value: Number(v.safeVal) } : null
  ui.close(); ui.toast('Anyag mentve')
}
</script>

<template>
  <ModalShell :title="it.name" wide>
    <div class="row" style="margin-bottom:12px">
      <span class="badge" :class="f.low || f.neg ? 'b-red' : 'b-green'">Készlet: {{ it.stock }} / {{ it.target }} {{ it.unit }}</span>
      <span v-if="f.runOut" class="badge" :class="f.level === 'red' ? 'b-red' : f.level === 'yellow' ? 'b-yellow' : 'b-green'">Elfogy kb. {{ fmtDate(f.runOut) }} · rendeld meg: {{ fmtDate(f.orderBy!) }}</span>
      <span v-else class="badge b-green">2 hónapon belül nem fogy el</span>
      <span class="badge b-blue">átlagár: {{ fmtPrice(it.price) }}<template v-if="it.lastPrice !== undefined"> · utolsó beszerzés: {{ fmtPrice(it.lastPrice) }}</template></span>
      <div class="spacer" /><button class="btn sm" @click="ui.open(ReceiptModal, { itemId: it.id })">Bevételezés</button>
    </div>
    <template v-if="it.lotTracked || lots.length">
      <h3>Gyártási tételek (kiadási sorrendben: ami előbb lejár, az fogy előbb)</h3>
      <div class="scroll-x" style="margin-bottom:12px">
        <table class="t">
          <thead><tr><th>#</th><th>Gyártási szám (LOT)</th><th>Lejárat</th><th>Mennyiség</th><th class="hide-m">Bevételezve</th><th class="hide-m">Egységár</th></tr></thead>
          <tbody>
            <tr v-for="(l, i) in lots" :key="l.id">
              <td>{{ i + 1 }}.</td><td><b>{{ l.lot }}</b></td>
              <td class="nowrap">{{ l.expiry ? fmtDate(l.expiry) : '–' }} <span v-if="l.expiry && days(l.expiry) < 0" class="badge b-red">lejárt</span><span v-else-if="l.expiry && days(l.expiry) <= 30" class="badge b-red">{{ days(l.expiry) }} nap</span><span v-else-if="l.expiry && days(l.expiry) <= 60" class="badge b-yellow">{{ days(l.expiry) }} nap</span></td>
              <td class="nowrap">{{ l.qty }} {{ it.unit }}</td><td class="hide-m">{{ fmtDate(l.received) }}</td><td class="hide-m">{{ fmtPrice(l.unitPrice) }}</td>
            </tr>
            <tr v-if="untracked > 0"><td /><td colspan="5" class="muted small">{{ untracked }} {{ it.unit }} gyártási szám nélkül (korábbi készlet)</td></tr>
            <tr v-if="!lots.length && untracked <= 0"><td colspan="6" class="muted">Nincs készleten gyártási tétel.</td></tr>
          </tbody>
        </table>
      </div>
    </template>
    <h3>Heti fogyás</h3>
    <WeeklyChart :item="it" />
    <h3 style="margin-top:14px">Beállítások</h3>
    <div class="grid3">
      <div class="field" style="grid-column:span 2"><label class="f">Megnevezés</label><input v-model="form.name" class="inp"></div>
      <div class="field"><label class="f">Anyagcsoport</label><input v-model="form.group" class="inp" list="dl-groups"></div>
      <div class="field"><label class="f">Egység</label><input v-model="form.unit" class="inp"></div>
      <div class="field"><label class="f">Beszállító</label><input v-model="form.supplier" class="inp" list="dl-sup"></div>
      <div class="field"><label class="f">Átlagos beszerzési ár</label><input class="inp" :value="fmtPrice(it.price)" disabled title="Bevételezéskor számolódik (gördülő súlyozott átlag)"></div>
      <div class="field"><label class="f">Célkészlet</label><input v-model.number="form.target" class="inp" type="number"></div>
      <div class="field"><label class="f">Beszerzési idő (nap)</label><input v-model.number="form.lead" class="inp" type="number"></div>
      <div class="field"><label class="f">Biztonsági tartalék</label>
        <div class="row" style="flex-wrap:nowrap"><input v-model.number="form.safeVal" class="inp" type="number" min="0" style="width:90px"><select v-model="form.safeMode" class="inp auto"><option value="qty">{{ it.unit }}</option><option value="weeks">hét fogyása</option></select></div>
        <div class="small muted">ennyit „nem használ el” a számítás: a rendelési határidő előbbre kerül</div></div>
      <div class="field" style="grid-column:1 / -1">
        <label class="switch" :class="{ on: form.lotTracked }" @click.prevent="form.lotTracked = !form.lotTracked"><i />gyártási szám (LOT) és lejárat kötelező a bevételezéskor</label>
        <label class="switch" :class="{ on: form.implant }" style="margin-left:14px" @click.prevent="form.implant = !form.implant; form.lotTracked = form.lotTracked || form.implant"><i />implantátum (a LOT a páciens kartonjába kerül)</label>
      </div>
      <div class="field" style="grid-column:1 / -1"><label class="f">Kulcsszavak a diktáláshoz <span class="n">(vesszővel; a * végű szó minden ragozott alakra illik)</span></label><input v-model="form.kw" class="inp"></div>
    </div>
    <datalist id="dl-groups"><option v-for="g in inv.groups" :key="g" :value="g" /></datalist>
    <datalist id="dl-sup"><option v-for="s in inv.suppliers" :key="s" :value="s" /></datalist>
    <div class="row"><div class="spacer" /><button class="btn pri sm" @click="save">Beállítások mentése</button></div>
    <h3 style="margin-top:14px">Megrendelések előzménye</h3>
    <div v-if="inv.ordersOf(it.id).length" class="small" style="margin-bottom:8px">
      <div v-for="o in inv.ordersOf(it.id)" :key="o.id" class="row" style="padding:3px 0;border-bottom:1px solid #eef1f3">
        <b>{{ fmtDate(o.date) }}</b><span>{{ o.supplier }}</span><span>{{ o.lines.find(l => l.item === it.id)?.qty }} {{ it.unit }}</span>
        <span class="badge" :class="ORDER_ST[o.status]![1]">{{ ORDER_ST[o.status]![0] }}</span>
        <span v-if="o.expected && (o.status === 'ordered' || o.status === 'partial')" class="muted">várható: {{ fmtDate(o.expected) }}</span>
        <span v-if="o.cancelReason" class="muted">indok: {{ o.cancelReason }}</span>
      </div>
    </div>
    <p v-else class="muted small" style="margin-top:0">Ehhez az anyaghoz még nem rögzítettek megrendelést.</p>
    <h3 style="margin-top:14px">Mozgásnapló</h3>
    <div style="max-height:260px;overflow:auto;border:1px solid var(--line);border-radius:8px">
      <table class="t">
        <thead><tr><th>Dátum</th><th>Típus</th><th>Mennyiség</th><th class="hide-m">Egységár → átlagár</th><th>Páciens</th><th class="hide-m">LOT</th><th class="hide-m">Megjegyzés</th></tr></thead>
        <tbody>
          <tr v-for="m in inv.movementsOf(it.id)" :key="m.id">
            <td class="nowrap">{{ fmtDate(m.date) }}</td><td>{{ kind[m.kind] || m.kind }}</td>
            <td class="nowrap" :style="`color:${m.qty < 0 ? 'var(--red)' : 'var(--green)'};font-weight:700`">{{ m.qty > 0 ? '+' : '' }}{{ fmtNum(m.qty) }} {{ it.unit }}</td>
            <td class="small hide-m nowrap"><template v-if="m.unitPrice !== undefined">{{ fmtPrice(m.unitPrice) }} → {{ fmtPrice(m.avgAfter ?? m.unitPrice) }}</template></td>
            <td>{{ pname(m.patientId) }}</td>
            <td class="small hide-m">{{ m.lot || (m.lots || []).map(l => l.lot + (m.lots!.length > 1 ? ` (${l.qty})` : '')).join(', ') }}</td>
            <td class="small hide-m">{{ m.note }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </ModalShell>
</template>
