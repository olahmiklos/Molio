// Hangfelvétel és hangelőkészítés a böngészőben (spec v2.3, 7., 11., 14. pont):
// mikrofon (zajcsökkentés, visszhangszűrés, automatikus hangerő kérése) → mintavétel 16 kHz mono → mélyzaj-szűrés (kb. 90 Hz alatt) → hangerő-egységesítés → WAV.
export interface AudioStats { seconds: number; peak: number; rms: number; speechRatio: number }

/** a nyers felvétel átalakítása: 16 kHz mono, felüláteresztő szűrő (alapból 90 Hz), csúcsra normalizálás; tiszta függvény (tesztelhető) */
export function prepareAudio(samples: Float32Array, rate: number, o: { highpassHz?: number; normalize?: boolean } = {}): { pcm: Float32Array; stats: AudioStats } {
  const OUT = 16000
  let x: Float32Array
  if (rate === OUT) x = Float32Array.from(samples)
  else {
    const n = Math.floor(samples.length * OUT / rate); x = new Float32Array(n)
    const r = rate / OUT
    for (let i = 0; i < n; i++) { const p = i * r, a = Math.floor(p), f = p - a; x[i] = (samples[a] ?? 0) * (1 - f) + (samples[a + 1] ?? samples[a] ?? 0) * f }
  }
  const hp = o.highpassHz ?? 90
  if (hp > 0) { // 2. rendű Butterworth felüláteresztő (biquad)
    const w0 = 2 * Math.PI * hp / OUT, c = Math.cos(w0), al = Math.sin(w0) / (2 * Math.SQRT1_2)
    const b0 = (1 + c) / 2, b1 = -(1 + c), b2 = (1 + c) / 2, a0 = 1 + al, a1 = -2 * c, a2 = 1 - al
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0
    for (let i = 0; i < x.length; i++) { const v = x[i]!, y = (b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = v; y2 = y1; y1 = y; x[i] = y }
  }
  let peak = 0, sum = 0
  for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]!); if (a > peak) peak = a; sum += x[i]! * x[i]! }
  const rms = Math.sqrt(sum / Math.max(1, x.length))
  // beszéd-arány: 50 ms-os ablakok, amelyek szintje a csúcshoz / zajszinthez képest érdemben fölötte van
  const win = OUT / 20, levels: number[] = []
  for (let i = 0; i + win <= x.length; i += win) { let s = 0; for (let k = 0; k < win; k++) s += x[i + k]! * x[i + k]!; levels.push(Math.sqrt(s / win)) }
  const sorted = [...levels].sort((a, b) => a - b), floor = sorted[Math.floor(sorted.length * 0.2)] || 0
  const thr = Math.max(0.006, floor * 3)
  const speechRatio = levels.length ? levels.filter(l => l > thr).length / levels.length : 0
  if (o.normalize !== false && peak > 0.005) { const g = Math.min(12, 0.9 / peak); for (let i = 0; i < x.length; i++) x[i]! *= g }
  return { pcm: x, stats: { seconds: x.length / OUT, peak, rms, speechRatio } }
}
/** 16 bites PCM WAV (16 kHz, mono); 30 másodperc kb. 1 MB */
export function toWav(pcm: Float32Array, rate = 16000): Uint8Array {
  const buf = new ArrayBuffer(44 + pcm.length * 2), v = new DataView(buf)
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }
  w(0, 'RIFF'); v.setUint32(4, 36 + pcm.length * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true)
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, pcm.length * 2, true)
  for (let i = 0; i < pcm.length; i++) { const s = Math.max(-1, Math.min(1, pcm[i]!)); v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true) }
  return new Uint8Array(buf)
}
/** a hangerőjelzés állapota a legutóbbi szintekből (11. pont): tartósan halk / túlvezérelt / nincs jel */
export type LevelState = 'ok' | 'quiet' | 'loud' | 'none'
export function levelState(hist: { t: number; rms: number; peak: number }[], now: number): LevelState {
  const last = (ms: number) => hist.filter(h => now - h.t <= ms)
  const l4 = last(4000)
  if (l4.length >= 20 && l4.every(h => h.rms < 0.002)) return 'none'
  const l25 = last(2500)
  if (l25.length >= 12 && l25.every(h => h.peak > 0.985)) return 'loud'
  if (l25.length >= 12 && l25.every(h => h.rms < 0.012)) return 'quiet'
  return 'ok'
}

export interface Capture { stop(): Promise<{ samples: Float32Array; rate: number }>; cancel(): void }
/** mikrofonfelvétel; a hangerőszintet 10 Hz-en jelzi vissza */
export async function startCapture(o: { noise: boolean; onLevel: (rms: number, peak: number) => void }): Promise<Capture> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: o.noise, noiseSuppression: o.noise, autoGainControl: o.noise } })
  const AC = (window as any).AudioContext || (window as any).webkitAudioContext
  const ctx: AudioContext = new AC()
  if (ctx.state === 'suspended') await ctx.resume().catch(() => {})
  const src = ctx.createMediaStreamSource(stream)
  const proc = ctx.createScriptProcessor(4096, 1, 1)
  const chunks: Float32Array[] = []
  let lastLvl = 0
  proc.onaudioprocess = e => {
    const d = e.inputBuffer.getChannelData(0); chunks.push(new Float32Array(d))
    const now = performance.now(); if (now - lastLvl < 100) return
    lastLvl = now; let s = 0, pk = 0
    for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]!); s += a * a; if (a > pk) pk = a }
    o.onLevel(Math.sqrt(s / d.length), pk)
  }
  const mute = ctx.createGain(); mute.gain.value = 0
  src.connect(proc); proc.connect(mute); mute.connect(ctx.destination)
  const close = () => { try { proc.disconnect(); src.disconnect() } catch { /* már leválasztva */ } stream.getTracks().forEach(t => t.stop()); void ctx.close().catch(() => {}) }
  return {
    async stop() {
      const rate = ctx.sampleRate; close()
      const n = chunks.reduce((a, c) => a + c.length, 0), out = new Float32Array(n); let p = 0
      chunks.forEach(c => { out.set(c, p); p += c.length })
      return { samples: out, rate }
    },
    cancel() { close() },
  }
}
export const b64 = (u: Uint8Array) => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s) }
