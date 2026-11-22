<script setup lang="ts">
// 1. pont: üzenet csatornájának kiválasztása gombokkal (nem legördülő menüvel). Bekapcsolva zöld + pipa; hiányzó elérhetőségnél szürke, magyarázó tippel.
const props = defineProps<{ sms: boolean; email: boolean; phone?: string; mail?: string }>()
const emit = defineEmits<{ 'update:sms': [boolean]; 'update:email': [boolean] }>()
const ok = { sms: computed(() => !!props.phone?.trim()), email: computed(() => !!props.mail?.trim()) }
function toggle(k: 'sms' | 'email') {
  if (!ok[k].value) return
  if (k === 'sms') emit('update:sms', !props.sms)
  else emit('update:email', !props.email)
}
</script>

<template>
  <div class="row channel-picker" role="group" aria-label="Csatorna">
    <button type="button" class="chip" :class="{ on: sms && ok.sms.value, disabled: !ok.sms.value }" :aria-pressed="sms && ok.sms.value" :disabled="!ok.sms.value"
      :title="ok.sms.value ? 'SMS: ' + phone : 'Nincs telefonszám megadva a páciensnél'" data-ch="sms" @click="toggle('sms')">
      <span v-if="sms && ok.sms.value" aria-hidden="true">✓</span>📱 SMS
    </button>
    <button type="button" class="chip" :class="{ on: email && ok.email.value, disabled: !ok.email.value }" :aria-pressed="email && ok.email.value" :disabled="!ok.email.value"
      :title="ok.email.value ? 'E-mail: ' + mail : 'Nincs e-mail-cím megadva a páciensnél'" data-ch="email" @click="toggle('email')">
      <span v-if="email && ok.email.value" aria-hidden="true">✓</span>✉ E-mail
    </button>
    <span v-if="!ok.sms.value" class="small muted">telefonszám nincs megadva</span>
    <span v-if="!ok.email.value" class="small muted">e-mail-cím nincs megadva</span>
    <span v-if="!(sms && ok.sms.value) && !(email && ok.email.value) && (ok.sms.value || ok.email.value)" class="small" style="color:var(--orange)">Válasszon csatornát</span>
  </div>
</template>
