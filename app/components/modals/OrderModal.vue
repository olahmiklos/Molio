<script setup lang="ts">
// Rendelőlap egy beszállítónak: a program összeállítja, a munkatárs leadja (telefon, e-mail, webshop),
// majd itt jelzi, hogy megrendelte. A program maga nem küld rendelést.
import { useDataStore } from '~/stores/data'
import { useInventoryStore } from '~/stores/inventory'
import { useUiStore } from '~/stores/ui'
import { addDays, fmtDate, today } from '~/utils/dates'
const props = defineProps<{ supplier: string; onlyItem?: string }>()
const data = useDataStore()
const inv = useInventoryStore()
const ui = useUiStore()
const lines = ref(props.onlyItem
  ? [inv.itemById(props.onlyItem)!].map(i => ({ item: i.id, name: i.name, unit: i.unit, qty: inv.suggestions.find(s => s.item.id === i.id)?.qty || Math.max(1, Math.round(i.target - i.stock)) }))
  : inv.suggestions.filter(s => (s.item.supplier || 'Nincs beszállító') === props.supplier).map(s => ({ item: s.item.id, name: s.item.name, unit: s.item.unit, qty: s.qty })))
const who = ref('')
const note = ref('')
const ref_ = ref('')
const expected = ref(addDays(today(), Math.max(0, ...lines.value.map(l => inv.itemById(l.item)?.lead || 0))))
const msg = ref('')
const text = computed(() => [
  `Megrendelés – ${data.db.company.name}, ${data.db.sites[0]?.name || ''}`,
  `Szállítási cím: ${data.db.settings.address}`,
  `Dátum: ${fmtDate(today())}`, '',
  ...lines.value.filter(l => l.qty > 0).map(l => `• ${l.name}: ${l.qty} ${l.unit}`), '',
  `Kapcsolattartó: ${who.value || '…'} · ${data.db.settings.phone}`,
].join('\n'))
async function copy() {
  try { await navigator.clipboard.writeText(text.value); ui.toast('Rendelőlap a vágólapon – beillesztheted e-mailbe') } catch { ui.toast('A másolás itt nem engedélyezett – jelöld ki a szöveget kézzel') }
}
function done() {
  msg.value = ''
  if (!who.value.trim()) { msg.value = 'Írd be, ki adta le a rendelést.'; return }
  if (!lines.value.some(l => l.qty > 0)) { msg.value = 'Nincs rendelendő tétel.'; return }
  inv.placeOrder(props.supplier, lines.value.map(l => ({ item: l.item, qty: Number(l.qty) || 0 })), who.value.trim(), note.value.trim(), { ref: ref_.value.trim(), expected: expected.value })
  ui.close(); ui.toast('Megrendelés rögzítve – a javaslat frissült')
}
</script>

<template>
  <ModalShell :title="'Rendelőlap – ' + supplier" wide>
    <div class="hint" style="margin-top:0">A mennyiségek a javaslatból jönnek, de átírhatók. A rendelést <b>te adod le</b> a beszállítónál (telefonon, e-mailben vagy a webshopjában), utána kattints a „Megrendeltem” gombra.</div>
    <div class="scroll-x">
      <table class="t">
        <thead><tr><th>Anyag</th><th>Mennyiség</th></tr></thead>
        <tbody>
          <tr v-for="l in lines" :key="l.item"><td><b>{{ l.name }}</b></td><td class="nowrap"><input v-model.number="l.qty" class="inp" type="number" min="0" style="width:100px"> {{ l.unit }}</td></tr>
        </tbody>
      </table>
    </div>
    <label class="f" style="margin-top:12px">Rendelőlap szövege (másolható)</label>
    <pre class="ordtxt">{{ text }}</pre>
    <div class="grid2">
      <div class="field"><label class="f">Ki adta le? *</label><input v-model="who" class="inp" placeholder="pl. Fehér Kata (asszisztens)"></div>
      <div class="field"><label class="f">Megjegyzés</label><input v-model="note" class="inp" placeholder="pl. telefonon, visszaigazolás e-mailben"></div>
    </div>
    <div class="grid2">
      <div class="field"><label class="f">Rendelésszám (ha van)</label><input v-model="ref_" class="inp"></div>
      <div class="field"><label class="f">Várható beérkezés</label><input v-model="expected" type="date" class="inp"><div class="small muted">alapból a leghosszabb beszerzési idő szerint; késésnél a lista jelez</div></div>
    </div>
    <div v-if="msg" class="err">{{ msg }}</div>
    <template #foot>
      <button class="btn" @click="copy">Rendelőlap másolása</button>
      <div class="spacer" />
      <button class="btn" @click="ui.close()">Mégse</button>
      <button class="btn pri" @click="done"><AppIcon name="check" :size="16" />Megrendeltem</button>
    </template>
  </ModalShell>
</template>

<style scoped>
.ordtxt { background: #f6f8f9; border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; font-family: inherit; font-size: 13px; white-space: pre-wrap; margin: 4px 0 12px }
</style>
