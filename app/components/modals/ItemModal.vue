<script setup lang="ts">
// Anyag részletei: heti fogyás, beállítások (kulcsszavak a diktáláshoz), mozgásnapló
import { useDataStore } from '~/stores/data'
import { useInventoryStore } from '~/stores/inventory'
import { useUiStore } from '~/stores/ui'
import { fmtDate, fmtNum, parseKw } from '~/utils/dates'
import ReceiptModal from './ReceiptModal.vue'
const props = defineProps<{ id: string }>()
const data = useDataStore()
const inv = useInventoryStore()
const ui = useUiStore()
const it = computed(() => inv.itemById(props.id)!)
const f = computed(() => inv.forecast(it.value))
const form = ref({ name: it.value.name, group: it.value.group, unit: it.value.unit, supplier: it.value.supplier, price: it.value.price, target: it.value.target, lead: it.value.lead, kw: it.value.kw.join(', ') })
const kind: Record<string, string> = { use: 'Felhasználás', in: 'Bevételezés', corr: 'Korrekció' }
const pname = (id?: string) => (id ? data.db.patients.find(p => p.id === id)?.name || '' : '')
function save() {
  const v = form.value, i = it.value
  i.name = v.name.trim() || i.name; i.unit = v.unit.trim() || i.unit; i.group = v.group.trim() || i.group; i.supplier = v.supplier.trim()
  i.price = Math.max(0, Number(v.price) || 0); i.target = Math.max(1, Number(v.target) || i.target); i.lead = Math.max(0, Number(v.lead) || 0); i.kw = parseKw(v.kw)
  ui.close(); ui.toast('Anyag mentve')
}
</script>

<template>
  <ModalShell :title="it.name" wide>
    <div class="row" style="margin-bottom:12px">
      <span class="badge" :class="f.low || f.neg ? 'b-red' : 'b-green'">Készlet: {{ it.stock }} / {{ it.target }} {{ it.unit }}</span>
      <span v-if="f.runOut" class="badge" :class="f.level === 'red' ? 'b-red' : f.level === 'yellow' ? 'b-yellow' : 'b-green'">Elfogy kb. {{ fmtDate(f.runOut) }} · rendeld meg: {{ fmtDate(f.orderBy!) }}</span>
      <span v-else class="badge b-green">2 hónapon belül nem fogy el</span>
      <div class="spacer" /><button class="btn sm" @click="ui.open(ReceiptModal, { itemId: it.id })">Bevételezés</button>
    </div>
    <h3>Heti fogyás</h3>
    <WeeklyChart :item="it" />
    <h3 style="margin-top:14px">Beállítások</h3>
    <div class="grid3">
      <div class="field" style="grid-column:span 2"><label class="f">Megnevezés</label><input v-model="form.name" class="inp"></div>
      <div class="field"><label class="f">Anyagcsoport</label><input v-model="form.group" class="inp" list="dl-groups"></div>
      <div class="field"><label class="f">Egység</label><input v-model="form.unit" class="inp"></div>
      <div class="field"><label class="f">Beszállító</label><input v-model="form.supplier" class="inp" list="dl-sup"></div>
      <div class="field"><label class="f">Beszerzési egységár (Ft)</label><input v-model.number="form.price" class="inp" type="number" min="0"></div>
      <div class="field"><label class="f">Célkészlet</label><input v-model.number="form.target" class="inp" type="number"></div>
      <div class="field"><label class="f">Beszerzési idő (nap)</label><input v-model.number="form.lead" class="inp" type="number"></div>
      <div class="field" style="grid-column:1 / -1"><label class="f">Kulcsszavak a diktáláshoz <span class="n">(vesszővel; a * végű szó minden ragozott alakra illik)</span></label><input v-model="form.kw" class="inp"></div>
    </div>
    <datalist id="dl-groups"><option v-for="g in inv.groups" :key="g" :value="g" /></datalist>
    <datalist id="dl-sup"><option v-for="s in inv.suppliers" :key="s" :value="s" /></datalist>
    <div class="row"><div class="spacer" /><button class="btn pri sm" @click="save">Beállítások mentése</button></div>
    <h3 style="margin-top:14px">Mozgásnapló</h3>
    <div style="max-height:260px;overflow:auto;border:1px solid var(--line);border-radius:8px">
      <table class="t">
        <thead><tr><th>Dátum</th><th>Típus</th><th>Mennyiség</th><th>Páciens</th><th class="hide-m">Megjegyzés</th></tr></thead>
        <tbody>
          <tr v-for="m in inv.movementsOf(it.id)" :key="m.id">
            <td class="nowrap">{{ fmtDate(m.date) }}</td><td>{{ kind[m.kind] || m.kind }}</td>
            <td class="nowrap" :style="`color:${m.qty < 0 ? 'var(--red)' : 'var(--green)'};font-weight:700`">{{ m.qty > 0 ? '+' : '' }}{{ fmtNum(m.qty) }} {{ it.unit }}</td>
            <td>{{ pname(m.patientId) }}</td><td class="small hide-m">{{ m.note }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </ModalShell>
</template>
