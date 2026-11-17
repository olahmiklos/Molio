<script setup lang="ts">
import { useDataStore } from '~/stores/data'
import { useInventoryStore } from '~/stores/inventory'
import { useUiStore } from '~/stores/ui'
import { today } from '~/utils/dates'
const props = defineProps<{ itemId?: string }>()
const data = useDataStore()
const inv = useInventoryStore()
const ui = useUiStore()
const itemId = ref(props.itemId || data.db.items[0]!.id)
const qty = ref<number | null>(null)
const date = ref(today())
const note = ref('')
const it = computed(() => inv.itemById(itemId.value)!)
function save() {
  const q = Number(qty.value)
  if (!(q > 0)) { ui.toast('Adj meg pozitív mennyiséget.'); return }
  inv.receive(itemId.value, q, date.value, note.value.trim())
  ui.close(); ui.toast(`Bevételezve: ${q} ${it.value.unit} – új készlet: ${it.value.stock} ${it.value.unit}`)
}
</script>

<template>
  <ModalShell title="Bevételezés">
    <div class="field"><label class="f">Anyag</label><select v-model="itemId" class="inp"><option v-for="i in data.db.items" :key="i.id" :value="i.id">{{ i.name }} ({{ i.unit }})</option></select></div>
    <div class="grid2">
      <div class="field"><label class="f">Beérkezett mennyiség</label><input v-model.number="qty" class="inp" type="number" min="1" inputmode="numeric"></div>
      <div class="field"><label class="f">Dátum</label><input v-model="date" class="inp" type="date"></div>
    </div>
    <div class="field"><label class="f">Megjegyzés</label><input v-model="note" class="inp" placeholder="pl. szállító, számlaszám"></div>
    <div class="hint" style="margin:0">Aktuális készlet: <b>{{ it.stock }} {{ it.unit }}</b> → bevételezés után: <b>{{ it.stock + (Number(qty) || 0) }} {{ it.unit }}</b> (célkészlet: {{ it.target }} {{ it.unit }})</div>
    <template #foot><button class="btn" @click="ui.close()">Mégse</button><button class="btn pri" @click="save">Bevételezés</button></template>
  </ModalShell>
</template>
