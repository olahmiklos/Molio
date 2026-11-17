<script setup lang="ts">
import { useInventoryStore } from '~/stores/inventory'
import { useUiStore } from '~/stores/ui'
import { parseKw } from '~/utils/dates'
const props = defineProps<{ group?: string }>()
const inv = useInventoryStore()
const ui = useUiStore()
const f = ref({ group: props.group || '', name: '', unit: '', supplier: '', price: 0, lead: 7, target: null as number | null, stock: null as number | null, kw: '', lotTracked: false, implant: false, lot: '', expiry: '' })
const msg = ref('')
function save() {
  const v = f.value, kw = parseKw(v.kw)
  if (!v.group.trim() || !v.name.trim() || !v.unit.trim() || !(Number(v.target) > 0) || v.stock === null || isNaN(Number(v.stock)) || !kw.length) { msg.value = 'A *-gal jelölt mezőket tölts ki.'; return }
  if (v.lotTracked && Number(v.stock) > 0 && (!v.lot.trim() || !v.expiry)) { msg.value = 'A nyitókészlet gyártási számát és lejáratát is add meg.'; return }
  inv.addItem({ group: v.group.trim(), name: v.name.trim(), unit: v.unit.trim(), supplier: v.supplier.trim(), price: Math.max(0, Number(v.price) || 0), lead: Number(v.lead) || 0, target: Number(v.target), stock: Number(v.stock), kw, lotTracked: v.lotTracked || v.implant, implant: v.implant }, v.lot.trim() ? { lot: v.lot.trim(), expiry: v.expiry } : undefined)
  ui.close(); ui.toast('Anyag felvéve')
}
</script>

<template>
  <ModalShell :title="group ? 'Új típus: ' + group : 'Új anyag vagy anyagcsoport'" wide>
    <div class="grid2">
      <div class="field"><label class="f">Anyagcsoport * <span class="n">(meglévő vagy új név)</span></label><input v-model="f.group" class="inp" list="dl-groups2" placeholder="pl. Injekciós tűk"></div>
      <div class="field"><label class="f">Megnevezés *</label><input v-model="f.name" class="inp" placeholder="pl. Injekciós tű 25G hosszú"></div>
      <div class="field"><label class="f">Egység *</label><input v-model="f.unit" class="inp" placeholder="db, adag, ml, pár, ampulla…"></div>
      <div class="field"><label class="f">Beszállító</label><input v-model="f.supplier" class="inp" list="dl-sup2"></div>
      <div class="field"><label class="f">Beszerzési egységár (Ft)</label><input v-model.number="f.price" class="inp" type="number" min="0"></div>
      <div class="field"><label class="f">Beszerzési idő (nap) *</label><input v-model.number="f.lead" class="inp" type="number"></div>
      <div class="field"><label class="f">Célkészlet *</label><input v-model.number="f.target" class="inp" type="number"></div>
      <div class="field"><label class="f">Aktuális készlet *</label><input v-model.number="f.stock" class="inp" type="number"></div>
      <div class="field" style="grid-column:1 / -1">
        <label class="switch" :class="{ on: f.lotTracked }" @click.prevent="f.lotTracked = !f.lotTracked"><i />gyártási szám (LOT) és lejárat nyilvántartása</label>
        <label class="switch" :class="{ on: f.implant }" style="margin-left:14px" @click.prevent="f.implant = !f.implant; f.lotTracked = f.lotTracked || f.implant"><i />implantátum</label>
      </div>
      <template v-if="f.lotTracked">
        <div class="field"><label class="f">Nyitókészlet gyártási száma (LOT)</label><input v-model="f.lot" class="inp"></div>
        <div class="field"><label class="f">Lejárat</label><input v-model="f.expiry" class="inp" type="date"></div>
      </template>
      <div class="field" style="grid-column:1 / -1"><label class="f">Kulcsszavak a diktáláshoz *</label><input v-model="f.kw" class="inp" placeholder="pl. 25g*, vastag tu*"></div>
    </div>
    <datalist id="dl-groups2"><option v-for="g in inv.groups" :key="g" :value="g" /></datalist>
    <datalist id="dl-sup2"><option v-for="s in inv.suppliers" :key="s" :value="s" /></datalist>
    <p class="small muted">A kulcsszavak alapján ismeri fel a program a diktálásban. A * végű szó minden ragozott alakra illik (lakk* → lakkot, lakkal). Egy csoporton belül a konkrétabb kulcsszó nyer. Az anyagot a Beállítások / Kezelési csomagok részben teheted csomagba.</p>
    <div v-if="msg" class="err">{{ msg }}</div>
    <template #foot><button class="btn" @click="ui.close()">Mégse</button><button class="btn pri" @click="save">Felvétel</button></template>
  </ModalShell>
</template>
