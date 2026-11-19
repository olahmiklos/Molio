// Diktálás a böngésző beépített magyar (hu-HU) beszédfelismerésével, folyamatos üzemmódban,
// köztes eredményekkel. Ha a böngésző nem támogatja, a szöveg gépelhető. (1.0 verzió: nincs AI)
import { defineStore } from 'pinia'
import { DICTATION_LIMIT_S } from '~/utils/meta'
import { useUiStore } from './ui'

type Target = { get: () => string; set: (v: string) => void }

export const useVoiceStore = defineStore('voice', () => {
  const recording = ref(false)
  const message = ref('')
  const supported = ref(false)
  /** a demóban egy megnyomásra legfeljebb DICTATION_LIMIT_S másodperc rögzíthető (spec v2.1, 1. pont) */
  const remaining = ref(0)
  let limitTimer: ReturnType<typeof setInterval> | null = null
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
    try {
      r.start(); recording.value = true
      message.value = `Ez a demó egyszerre csak ${DICTATION_LIMIT_S} másodperc rögzítését engedi. Hallgatlak…`
      useUiStore().toast(`Ez a demó egyszerre csak ${DICTATION_LIMIT_S} másodperc rögzítését engedi.`)
      remaining.value = DICTATION_LIMIT_S
      if (limitTimer) clearInterval(limitTimer)
      limitTimer = setInterval(() => {
        remaining.value--
        if (remaining.value <= 0) { stop(`A ${DICTATION_LIMIT_S} másodperces demó-korlát lejárt, a rögzítés automatikusan leállt. A szöveg javítható; új diktáláshoz nyomd meg újra a gombot.`) }
      }, 1000)
    } catch { wanted = false; recording.value = false }
  }
  function stop(msg?: string) {
    if (limitTimer) { clearInterval(limitTimer); limitTimer = null }
    remaining.value = 0
    wanted = false
    if (rec) { try { rec.stop() } catch { /* már leállt */ } }
    rec = null
    if (msg) message.value = msg
    else if (recording.value) message.value = 'Diktálás leállítva. A szöveg javítható.'
    recording.value = false
  }

  return { recording, message, supported, remaining, detect, start, stop }
})
