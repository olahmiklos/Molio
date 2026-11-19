<script setup lang="ts">
// Bevételezés egységárral (gördülő súlyozott átlagár), gyártási számmal (LOT) és lejárattal
import { useDataStore } from '~/stores/data'
import { useInventoryStore } from '~/stores/inventory'
import { useUiStore } from '~/stores/ui'
import { fmtDate, fmtPrice as fmtFt, today } from '~/utils/dates'
const props = defineProps<{ itemId?: string; qty?: number; note?: string; orderId?: string }>()
const data = useDataStore()
const inv = useInventoryStore()
const ui = useUiStore()
const itemId = ref(props.itemId || data.db.items[0]!.id)
const it = computed(() => inv.itemById(itemId.value)!)
const qty = ref<number | null>(props.qty ?? null)
const price = ref<number | null>(it.value.lastPrice ?? it.value.price)
const date = ref(today())
const lot = ref('')
const expiry = ref('')
const note = ref(props.note || '')
const msg = ref('')
/** a bevételezés melyik megrendeléshez tartozik (nyitott / részben beérkezett, az anyagot tartalmazó) */
const openForItem = computed(() => data.db.orders.filter(o => (o.status === 'ordered' || o.status === 'partial') && o.lines.some(l => l.item === itemId.value)))
const orderId = ref<string>(props.orderId || '')
const openQty = (o: (typeof openForItem.value)[number]) => { const l = o.lines.find(x => x.item === itemId.value); return l ? Math.max(0, l.qty - (l.received || 0)) : 0 }
watch(openForItem, list => { if (!orderId.value && list.length === 1 && !props.itemId) orderId.value = list[0]!.id }, { immediate: true })
watch(orderId, id => { const o = openForItem.value.find(x => x.id === id); if (o && !qty.value) qty.value = openQty(o) })
watch(itemId, () => { orderId.value = ''; price.value = it.value.lastPrice ?? it.value.price; lot.value = ''; expiry.value = '' })
const q = computed(() => Number(qty.value) || 0)
const newAvg = computed(() => (q.value > 0 ? inv.previewAvg(it.value, q.value, Number(price.value) || 0) : it.value.price))
function save() {
  msg.value = ''
  if (!(q.value > 0)) { msg.value = 'Adj meg pozitív mennyiséget.'; return }
  if (price.value === null || Number(price.value) < 0) { msg.value = 'Add meg a beszerzési egységárat.'; return }
  if (it.value.lotTracked && (!lot.value.trim() || !expiry.value)) { msg.value = 'Ennél az anyagnál a gyártási szám (LOT) és a lejárat megadása kötelező.'; return }
  inv.receive(itemId.value, { qty: q.value, unitPrice: Number(price.value), date: date.value, lot: lot.value, expiry: expiry.value, note: note.value.trim() }, orderId.value || null)
  ui.close(); ui.toast(`Bevételezve: ${q.value} ${it.value.unit} – új átlagár: ${fmtFt(it.value.price)}`)
}
</script>

<template>
  <ModalShell title="Bevételezés" wide>
    <div class="field"><label class="f">Anyag</label><select v-model="itemId" class="inp"><option v-for="i in data.db.items" :key="i.id" :value="i.id">{{ i.name }} ({{ i.unit }})</option></select></div>
    <div v-if="openForItem.length" class="field">
      <label class="f">Melyik megrendeléshez tartozik?</label>
      <select v-model="orderId" class="inp"><option value="">– nincs megrendeléshez kötve –</option><option v-for="o in openForItem" :key="o.id" :value="o.id">{{ fmtDate(o.date) }} · {{ o.supplier }} · még várt: {{ openQty(o) }} {{ it.unit }}{{ o.status === 'partial' ? ' (részben beérkezett)' : '' }}</option></select>
      <div class="small muted">Ha kevesebb érkezett a rendeltnél, a megrendelés „részben beérkezett” marad; a teljes mennyiségnél automatikusan lezárul.</div>
    </div>
    <div class="grid3">
      <div class="field"><label class="f">Beérkezett mennyiség *</label><input v-model.number="qty" class="inp" type="number" min="1" inputmode="numeric"></div>
      <div class="field"><label class="f">Beszerzési egységár (Ft / {{ it.unit }}) *</label><input v-model.number="price" class="inp" type="number" min="0" step="any" inputmode="decimal"></div>
      <div class="field"><label class="f">Dátum</label><input v-model="date" class="inp" type="date"></div>
      <div class="field"><label class="f">Gyártási szám (LOT){{ it.lotTracked ? ' *' : '' }}</label><input v-model="lot" class="inp" placeholder="a dobozon: LOT / Ch.-B."></div>
      <div class="field"><label class="f">Lejárat{{ it.lotTracked ? ' *' : '' }}</label><input v-model="expiry" class="inp" type="date"></div>
      <div class="field"><label class="f">Megjegyzés</label><input v-model="note" class="inp" placeholder="pl. szállítólevél, számlaszám"></div>
    </div>
    <div class="avgbox">
      <div><span class="muted small">Készlet</span><b>{{ it.stock }} → {{ it.stock + q }} {{ it.unit }}</b></div>
      <div><span class="muted small">Jelenlegi átlagár</span><b>{{ fmtFt(it.price) }}</b></div>
      <div><span class="muted small">Új átlagár</span><b style="color:var(--green)">{{ fmtFt(newAvg) }}</b></div>
    </div>
    <p class="small muted" style="margin:8px 0 0">Gördülő súlyozott átlagár: (meglévő készlet × régi átlagár + új mennyiség × új egységár) ÷ teljes mennyiség.
      <template v-if="q > 0">Most: ({{ Math.max(0, it.stock) }} × {{ fmtFt(it.price) }} + {{ q }} × {{ fmtFt(Number(price) || 0) }}) ÷ {{ Math.max(0, it.stock) + q }} = <b>{{ fmtFt(newAvg) }}</b>.</template>
      Ezt az árat használja a program a kezelések anyagköltségéhez és a készletértékhez.</p>
    <div v-if="msg" class="err" style="margin-top:8px">{{ msg }}</div>
    <template #foot><button class="btn" @click="ui.close()">Mégse</button><button class="btn pri" @click="save">Bevételezés</button></template>
  </ModalShell>
</template>

<style scoped>
.avgbox { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; background: var(--green-l); border-radius: 10px; padding: 12px 14px }
.avgbox div { display: flex; flex-direction: column; gap: 2px }
.avgbox b { font-size: 16px }
@media (max-width: 560px) { .avgbox { grid-template-columns: 1fr } }
</style>
