<script setup lang="ts">
// Raktár: készlet, 60 napos előrejelzés, rendelési határidő, sürgősség szerinti sorrend (spec 2.3, 2.3.1)
import { useInventoryStore } from '~/stores/inventory'
import { useUiStore } from '~/stores/ui'
import { addDays, fmtDate, fmtFt, today } from '~/utils/dates'
import { HORIZON } from '~/utils/logic'
import ItemModal from '~/components/modals/ItemModal.vue'
import ReceiptModal from '~/components/modals/ReceiptModal.vue'
import NewItemModal from '~/components/modals/NewItemModal.vue'
const inv = useInventoryStore()
const ui = useUiStore()
const t0 = today()
</script>

<template>
  <div>
    <div class="pagehead">
      <h1>Raktár</h1><span class="pill">Budai telephely</span><span class="muted small">készletérték: {{ fmtFt(inv.stockValue) }}</span>
      <div class="spacer" />
      <button class="btn" @click="ui.open(ReceiptModal, {})">Bevételezés</button>
      <button class="btn pri" @click="ui.open(NewItemModal, {})"><AppIcon name="plus" :size="16" />Új anyag</button>
    </div>
    <div class="hint">
      Előrejelzés a <b>{{ fmtDate(t0) }} – {{ fmtDate(addDays(t0, HORIZON)) }}</b> között lefoglalt kezelések alapján (60 nap). „Rendeld meg legkésőbb” = a várható elfogyás napja mínusz a beszerzési idő.
      <span class="dot red" />elmúlt vagy 3 napon belül <span class="dot yellow" />7 napon belül <span class="dot green" />ráér
    </div>
    <div class="card flush scroll-x">
      <table class="t">
        <thead><tr><th>Anyag</th><th>Aktuális készlet</th><th class="hide-m">Várható fogyás (60 nap)</th><th>Elfogy kb.</th><th class="hide-m">Beszerzési idő</th><th>Rendeld meg legkésőbb</th><th class="hide-m" /></tr></thead>
        <tbody>
          <tr v-for="{ it, f } in inv.rows" :key="it.id" class="click" @click="ui.open(ItemModal, { id: it.id })">
            <td><b>{{ it.name }}</b><br><span class="muted small">{{ it.group }} · {{ it.supplier || 'nincs beszállító' }}</span></td>
            <td class="nowrap">
              <b>{{ it.stock }} {{ it.unit }}</b> <span class="muted small">/ {{ it.target }} ({{ Math.round(it.target ? it.stock / it.target * 100 : 0) }}%)</span>
              <div class="bar"><i :class="{ low: f.low }" :style="`width:${Math.max(0, Math.min(100, it.target ? it.stock / it.target * 100 : 0))}%`" /></div>
              <span v-if="f.neg" class="badge b-red">Készlet-eltérés, leltár indokolt</span><span v-else-if="f.low" class="badge b-red">10% alatt</span>
            </td>
            <td class="hide-m">{{ f.planned ? `${f.planned} ${it.unit}` : '–' }}</td>
            <td class="nowrap">{{ f.runOut ? fmtDate(f.runOut) : '60 napon belül nem' }}</td>
            <td class="hide-m">{{ it.lead }} nap</td>
            <td class="nowrap"><span class="dot" :class="f.level" /><template v-if="f.orderBy"><b>{{ fmtDate(f.orderBy) }}</b> <span v-if="f.orderBy < t0" class="badge b-red">határidő elmúlt</span></template><span v-else class="muted">ráér</span></td>
            <td class="hide-m"><button class="btn sm" @click.stop="ui.open(ReceiptModal, { itemId: it.id })">Bevételezés</button></td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="muted small">Kattints egy anyagra a mozgásnaplóhoz, a heti fogyás grafikonjához és a beállításaihoz. A készlet telephelyszinten vezetett.</p>
  </div>
</template>
