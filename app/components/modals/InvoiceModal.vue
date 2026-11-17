<script setup lang="ts">
// Számla előkészítése a nap kezeléseiből – a demóban szemléltetés. A végleges rendszerben a számlát
// a csatolt számlázó program (pl. Számlázz.hu, Billingo) állítja ki és jelenti a NAV Online Számla rendszerébe.
import { useDataStore } from '~/stores/data'
import { useOfficeStore } from '~/stores/office'
import { useUiStore } from '~/stores/ui'
import { fmtDate, fmtFt } from '~/utils/dates'
import { FUNDS, PAY_METHODS } from '~/utils/office'
import { typeNames } from '~/utils/logic'
import type { Invoice } from '~/utils/types'
const props = defineProps<{ patientId: string; date: string }>()
const data = useDataStore()
const office = useOfficeStore()
const ui = useUiStore()
const db = computed(() => data.db)
const p = computed(() => db.value.patients.find(x => x.id === props.patientId)!)
const existing = computed(() => office.invoiceFor(props.patientId, props.date))
const recs = computed(() => db.value.records.filter(r => r.patientId === props.patientId && r.date === props.date))
const lines = ref(recs.value.filter(r => r.fee).map(r => ({ name: typeNames(db.value, r.typeIds) + (r.teeth.length ? ` (${r.teeth.join(', ')})` : ''), qty: 1, price: r.fee })))
const payerName = ref(p.value.name)
const payerAddress = ref(p.value.address)
const method = ref<Invoice['method']>('card')
const fund = ref(FUNDS[0]!)
const total = computed(() => lines.value.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0), 0))
const busy = ref(false)
function issue() {
  if (!lines.value.length || total.value <= 0) { ui.toast('Nincs számlázható tétel'); return }
  busy.value = true
  setTimeout(() => {
    const inv = office.issueInvoice({ date: props.date, patientId: props.patientId, recordIds: recs.value.map(r => r.id), payerName: payerName.value, payerAddress: payerAddress.value, method: method.value, fund: method.value === 'fund' ? fund.value : '', lines: lines.value.map(l => ({ ...l, qty: Number(l.qty) || 0, price: Number(l.price) || 0 })), total: total.value })
    busy.value = false; ui.close(); ui.toast(`Számla előkészítve (demó): ${inv.no}`)
  }, 700)
}
</script>

<template>
  <ModalShell :title="existing ? 'Számla – ' + existing.no : 'Számla előkészítése'" wide>
    <div class="ai-note" style="margin-top:0">
      <b>Szemléltetés – a demó nem állít ki valódi számlát.</b> A végleges rendszerben a Molio a kezelésekből összeállítja a tételeket, a számlát pedig a csatolt számlázó program
      (pl. Számlázz.hu vagy Billingo) állítja ki és jelenti a NAV-nak. Egészségpénztári fizetésnél a pénztár nevére szóló számla készül.
      Az áfakezelést (a fogorvosi ellátás jellemzően tárgyi adómentes) a könyvelővel egyeztetve kell beállítani.
    </div>
    <template v-if="existing">
      <div class="kv" style="grid-template-columns:180px 1fr">
        <div>Számlaszám</div><div><b>{{ existing.no }}</b> (demó)</div>
        <div>Kelt</div><div>{{ fmtDate(existing.date) }}</div>
        <div>Vevő</div><div>{{ existing.payerName }}<br><span class="muted small">{{ existing.payerAddress }}</span></div>
        <div>Fizetési mód</div><div>{{ PAY_METHODS[existing.method] }}<template v-if="existing.fund"> – {{ existing.fund }}</template></div>
      </div>
      <table class="t" style="margin-top:10px"><tbody>
        <tr v-for="(l, i) in existing.lines" :key="i"><td>{{ l.name }}</td><td class="nowrap">{{ l.qty }} ×</td><td class="nowrap" style="text-align:right">{{ fmtFt(l.price) }}</td></tr>
        <tr><td colspan="2"><b>Összesen</b></td><td class="nowrap" style="text-align:right"><b>{{ fmtFt(existing.total) }}</b></td></tr>
      </tbody></table>
    </template>
    <template v-else>
      <div class="small muted" style="margin-bottom:8px">{{ fmtDate(date) }} · {{ recs.length }} kezelés</div>
      <div class="scroll-x">
        <table class="t">
          <thead><tr><th>Tétel</th><th>Menny.</th><th>Egységár (Ft)</th><th /></tr></thead>
          <tbody>
            <tr v-for="(l, i) in lines" :key="i">
              <td><input v-model="l.name" class="inp" style="min-width:240px"></td>
              <td><input v-model.number="l.qty" class="inp" type="number" min="1" style="width:70px"></td>
              <td><input v-model.number="l.price" class="inp" type="number" min="0" step="1000" style="width:120px"></td>
              <td><button class="btn sm danger" @click="lines.splice(i, 1)">×</button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="row" style="margin:8px 0 12px"><button class="btn sm" @click="lines.push({ name: 'Egyéb tétel', qty: 1, price: 0 })">+ Tétel</button><div class="spacer" /><span class="muted">Összesen:</span><span class="fee">{{ fmtFt(total) }}</span></div>
      <div class="grid2">
        <div class="field"><label class="f">Vevő neve</label><input v-model="payerName" class="inp"></div>
        <div class="field"><label class="f">Vevő címe</label><input v-model="payerAddress" class="inp"></div>
        <div class="field"><label class="f">Fizetési mód</label><select v-model="method" class="inp"><option v-for="(n, k) in PAY_METHODS" :key="k" :value="k">{{ n }}</option></select></div>
        <div v-if="method === 'fund'" class="field"><label class="f">Egészségpénztár</label><select v-model="fund" class="inp"><option v-for="f in FUNDS" :key="f" :value="f">{{ f }}</option></select></div>
      </div>
      <p v-if="p.internalNote" class="small muted" style="margin:0">Belső megjegyzés: {{ p.internalNote }}</p>
    </template>
    <template #foot>
      <div class="spacer" />
      <button class="btn" @click="ui.close()">Bezárás</button>
      <button v-if="!existing" class="btn pri" :disabled="busy" @click="issue">{{ busy ? 'Küldés a számlázóba…' : 'Számla kiállítása (szimulált)' }}</button>
    </template>
  </ModalShell>
</template>
