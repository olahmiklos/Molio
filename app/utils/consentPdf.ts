// Aláírt beleegyező nyilatkozat PDF-ben (ugyanazzal a saját PDF-íróval, mint az ügyfélkarton)
import { fmtBirth, fmtLong, norm } from './dates'
import type { DB } from './types'
import { buildPdf } from './pdf'

export function consentPdf(db: DB, o: { patientId: string; title: string; text: string; doctor: string; signedAt: Date }, sig: HTMLCanvasElement) {
  const p = db.patients.find(x => x.id === o.patientId)!
  const W = 1240, H = 1754, M = 110, F = 'Raleway, "Segoe UI", Arial, sans-serif'
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const x = c.getContext('2d')!
  x.fillStyle = '#fff'; x.fillRect(0, 0, W, H)
  const g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, '#3fa463'); g.addColorStop(1, '#2a8ccc'); x.fillStyle = g; x.fillRect(0, 0, W, 18)
  x.fillStyle = '#3fa463'; x.font = `bold 34px ${F}`; x.fillText(db.settings.clinic, M, 86)
  x.fillStyle = '#475569'; x.font = `22px ${F}`; x.fillText(`${db.settings.address}  ·  ${db.settings.phone}`, M, 120)
  x.strokeStyle = '#cbd5e1'; x.lineWidth = 2; x.beginPath(); x.moveTo(M, 145); x.lineTo(W - M, 145); x.stroke()
  let y = 210
  x.fillStyle = '#0f172a'; x.font = `bold 38px ${F}`; x.fillText(o.title, M, y); y += 56
  x.fillStyle = '#f1f5f9'; x.fillRect(M, y - 32, W - 2 * M, 96)
  x.fillStyle = '#64748b'; x.font = `19px ${F}`; x.fillText('Páciens', M + 24, y); x.fillText('Születési dátum', M + 520, y); x.fillText('TAJ-szám', M + 800, y)
  x.fillStyle = '#0f172a'; x.font = `bold 23px ${F}`; x.fillText(p.name, M + 24, y + 30); x.fillText(fmtBirth(p.birth), M + 520, y + 30); x.fillText(p.taj || '–', M + 800, y + 30)
  y += 110
  if (p.healthWarning) { x.fillStyle = '#e8344e'; x.font = `bold 21px ${F}`; x.fillText('⚕ ' + p.healthWarning, M, y); y += 44 }
  x.font = `23px ${F}`; x.fillStyle = '#1e293b'
  o.text.split('\n').forEach(par => {
    if (!par.trim()) { y += 16; return }
    let line = ''
    par.split(/\s+/).forEach(w => {
      const t = line ? line + ' ' + w : w
      if (x.measureText(t).width > W - 2 * M && line) { x.fillText(line, M, y); y += 34; line = w } else line = t
    })
    if (line) { x.fillText(line, M, y); y += 34 }
  })
  y = Math.max(y + 40, H - 520)
  x.fillStyle = '#475569'; x.font = `21px ${F}`
  x.fillText(`Kelt: Budapest, ${fmtLong(o.signedAt.toISOString().slice(0, 10))}, ${o.signedAt.toTimeString().slice(0, 5)}`, M, y); y += 40
  x.fillText(`A tájékoztatást adó orvos: ${o.doctor}`, M, y); y += 30
  const sw = 600, sh = Math.round(sw * sig.height / sig.width)
  x.drawImage(sig, W - M - sw, y, sw, sh)
  x.strokeStyle = '#334155'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(W - M - sw, y + sh + 4); x.lineTo(W - M, y + sh + 4); x.stroke()
  x.textAlign = 'center'; x.fillText('a páciens (törvényes képviselő) aláírása', W - M - sw / 2, y + sh + 36); x.textAlign = 'left'
  x.fillStyle = '#94a3b8'; x.font = `17px ${F}`
  x.fillText('Elektronikusan, tableten aláírva a Molio programban. Bemutató (demó) dokumentum – a szöveg mintaszöveg.', M, H - 60)
  return buildPdf([c])
}
export const consentFileName = (name: string, date: string) => `nyilatkozat_${norm(name).replace(/[^a-z0-9]+/g, '_')}_${date}.pdf`
