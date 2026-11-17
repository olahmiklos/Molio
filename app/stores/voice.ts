// Diktálás a böngésző beépített magyar (hu-HU) beszédfelismerésével, folyamatos üzemmódban,
// köztes eredményekkel. Ha a böngésző nem támogatja, a szöveg gépelhető. (1.0 verzió: nincs AI)
import { defineStore } from 'pinia'

type Target = { get: () => string; set: (v: string) => void }

export const useVoiceStore = defineStore('voice', () => {
  const recording = ref(false)
  const message = ref('')
  const supported = ref(false)
  let rec: any = null
  let wanted = false
  let base = ''
  let finalText = ''
  let target: Target | null = null

  function detect() {
    if (typeof window === 'undefined') return false
    supported.value = !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    return supported.value
  }

  function start(t: Target) {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { message.value = 'Ez a böngésző nem támogatja a diktálást – gépeld be a szöveget.'; return }
    stop()
    target = t
    wanted = true
    base = t.get(); if (base && !/\s$/.test(base)) base += ' '
    finalText = ''
    const r = new SR(); rec = r
    r.lang = 'hu-HU'; r.continuous = true; r.interimResults = true
    r.onresult = (e: any) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const tx = e.results[i][0].transcript
        if (e.results[i].isFinal) finalText += tx.trim() + '. '; else interim += tx
      }
      target?.set(base + finalText + interim)
    }
    r.onerror = (e: any) => {
      const m: Record<string, string> = {
        'not-allowed': 'A mikrofon használata nincs engedélyezve. Engedélyezd a böngésző címsoránál.',
        'service-not-allowed': 'A böngésző nem engedi a beszédfelismerést. Gépeld be a szöveget.',
        network: 'A diktáláshoz internetkapcsolat kell.',
        'no-speech': 'Nem hallottam beszédet.',
        'audio-capture': 'Nem található mikrofon.',
      }
      message.value = m[e.error] || 'Hiba: ' + e.error
      if (['not-allowed', 'audio-capture', 'network', 'service-not-allowed'].includes(e.error)) wanted = false
    }
    r.onend = () => {
      if (wanted && target) {
        base = target.get(); if (base && !/\s$/.test(base)) base += ' '
        finalText = ''
        try { r.start() } catch { wanted = false }
      }
      recording.value = wanted
    }
    try { r.start(); recording.value = true; message.value = 'Hallgatlak… beszélj nyugodtan, a felismert szöveg megjelenik.' } catch { wanted = false; recording.value = false }
  }
  function stop() {
    wanted = false
    if (rec) { try { rec.stop() } catch { /* már leállt */ } }
    rec = null
    if (recording.value) message.value = 'Diktálás leállítva. A szöveg javítható.'
    recording.value = false
  }

  return { recording, message, supported, detect, start, stop }
})
