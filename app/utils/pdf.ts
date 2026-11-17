// PDF ügyfélkarton (spec 2.2.4): a lapok vászonra rajzolva, saját PDF-íróval, külső könyvtár nélkül,
// így szerver nélkül is letölthető, és az ékezetes betűk helyesek.
// A belső megjegyzés nem kerül a PDF-re, az egészségügyi figyelmeztetés kiemelve rákerül.
import { fmtBirth, fmtDate, fmtLong, norm } from './dates'
import type { DB } from './types'
import { doctorName, typeNames } from './logic'
import { teethStr } from './teeth'
import { docTypeName } from './defaults'

export function pdfPages(db: DB, pid: string, date: string, imgs: Record<string, HTMLImageElement> = {}) {
  const p = db.patients.find(x => x.id === pid)!
  const recs = db.records.filter(r => r.patientId === pid && r.date === date).sort((a, b) => a.time.localeCompare(b.time))
  const W = 1240, H = 1754, M = 100, F = 'Raleway, "Segoe UI", Arial, sans-serif'
  const pages: HTMLCanvasElement[] = []
  let c!: HTMLCanvasElement, x!: CanvasRenderingContext2D, y = 0
  const footer = () => {
    x.fillStyle = '#94a3b8'; x.font = `18px ${F}`; x.textAlign = 'left'
    x.fillText(`${p.name} – ügyfélkarton, ${fmtDate(date)} · Molio`, M, H - 60)
    x.textAlign = 'right'; x.fillText(`${pages.length}. oldal`, W - M, H - 60); x.textAlign = 'left'
  }
  const newPage = () => {
    c = document.createElement('canvas'); c.width = W; c.height = H; x = c.getContext('2d')!
    x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); pages.push(c)
    const g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, '#3fa463'); g.addColorStop(1, '#2a8ccc'); x.fillStyle = g; x.fillRect(0, 0, W, 18)
    x.fillStyle = '#3fa463'; x.font = `bold 34px ${F}`; x.fillText(db.settings.clinic, M, 86)
    x.fillStyle = '#475569'; x.font = `22px ${F}`; x.fillText(`${db.settings.address}  ·  ${db.settings.phone}`, M, 120)
    x.strokeStyle = '#cbd5e1'; x.lineWidth = 2; x.beginPath(); x.moveTo(M, 145); x.lineTo(W - M, 145); x.stroke()
    y = 195
  }
  const ensure = (h: number) => { if (y + h > H - 150) { footer(); newPage() } }
  const wrap = (text: string, font: string, maxW: number) => {
    x.font = font; const out: string[] = []
    String(text).split('\n').forEach(par => {
      let line = ''
      par.split(/\s+/).forEach(w => { const t = line ? line + ' ' + w : w; if (x.measureText(t).width > maxW && line) { out.push(line); line = w } else line = t })
      out.push(line)
    })
    return out
  }
  const text = (t: string, font: string, color: string, lh: number, indent = 0) => {
    wrap(t, font, W - 2 * M - indent).forEach(l => { ensure(lh); x.font = font; x.fillStyle = color; x.fillText(l, M + indent, y); y += lh })
  }
  newPage()
  x.fillStyle = '#0f172a'; x.font = `bold 40px ${F}`; x.fillText('Ügyfélkarton – kezelési lap', M, y); y += 46
  x.fillStyle = '#475569'; x.font = `24px ${F}`; x.fillText(fmtLong(date), M, y); y += 50
  // páciens adatai
  x.fillStyle = '#f1f5f9'; x.fillRect(M, y - 34, W - 2 * M, 170)
  const kv = [['Név', p.name], ['Születési dátum', fmtBirth(p.birth)], ['TAJ-szám', p.taj || '–'], ['Telefon', p.phone], ['Lakcím', p.address || '–'], ['E-mail', p.email || '–']]
  kv.forEach(([k, v], i) => {
    const col = i % 2, row = Math.floor(i / 2), xx = M + 24 + col * 520, yy = y + row * 50
    x.fillStyle = '#64748b'; x.font = `19px ${F}`; x.fillText(k!, xx, yy)
    x.fillStyle = '#0f172a'; x.font = `bold 22px ${F}`
    let vv = String(v); while (x.measureText(vv).width > 480 && vv.length > 3) vv = vv.slice(0, -2); if (vv !== String(v)) vv += '…'
    x.fillText(vv, xx, yy + 24)
  })
  y += 160
  // egészségügyi figyelmeztetés – kiemelve, hogy a nyomtatott kartonon is látsszon
  if (p.healthWarning) {
    const lines = wrap(p.healthWarning, `bold 23px ${F}`, W - 2 * M - 300)
    const h = 26 + lines.length * 32
    x.fillStyle = '#fde6ea'; x.fillRect(M, y, W - 2 * M, h)
    x.fillStyle = '#e8344e'; x.fillRect(M, y, 8, h)
    x.font = `bold 19px ${F}`; x.fillText('EGÉSZSÉGÜGYI FIGYELMEZTETÉS', M + 26, y + 34)
    x.fillStyle = '#8f1325'; x.font = `bold 23px ${F}`
    lines.forEach((l, i) => x.fillText(l, M + 380, y + 34 + i * 32))
    y += h + 20
  }
  y += 30
  recs.forEach((r, i) => {
    ensure(160)
    x.strokeStyle = '#3fa463'; x.lineWidth = 3; x.beginPath(); x.moveTo(M, y - 30); x.lineTo(M, y + 6); x.stroke()
    x.fillStyle = '#3fa463'; x.font = `bold 28px ${F}`; x.fillText(`${i + 1}. kezelés – ${r.time}`, M + 16, y); y += 40
    text(`Orvos: ${doctorName(db, r.doctorId)}`, `22px ${F}`, '#334155', 32, 16)
    text(`Kezelés: ${typeNames(db, r.typeIds) || '–'}`, `22px ${F}`, '#334155', 32, 16)
    text(`Érintett fogak és felszínek: ${r.teeth.length ? teethStr(r.teeth, r.surfaces) : '–'}`, `22px ${F}`, '#334155', 32, 16)
    if (r.planned?.teeth.length) text(`Tervezett: ${teethStr(r.planned.teeth, r.planned.surfaces)}${r.extended ? ' – kezelés közben bővítve' : ''}`, `21px ${F}`, '#64748b', 30, 16)
    y += 8; text('Leírás', `bold 21px ${F}`, '#0f172a', 32, 16)
    text(r.text || '–', `22px ${F}`, '#0f172a', 32, 16)
    y += 8; text('Felhasznált anyagok', `bold 21px ${F}`, '#0f172a', 34, 16)
    if (r.materials.length) {
      r.materials.forEach(m => {
        const it = db.items.find(i => i.id === m.item) || { name: '?', unit: '' }
        ensure(32); x.font = `21px ${F}`; x.fillStyle = '#334155'
        let nm = '• ' + it.name; const maxW = W - 2 * M - 230
        if (x.measureText(nm).width > maxW) { while (x.measureText(nm + '…').width > maxW && nm.length > 4) nm = nm.slice(0, -1); nm += '…' }
        x.fillText(nm, M + 32, y); x.textAlign = 'right'; x.fillText(`${m.qty.toLocaleString('hu-HU')} ${it.unit}`, W - M - 20, y); x.textAlign = 'left'; y += 31
      })
    } else text('–', `21px ${F}`, '#334155', 31, 32)
    const atts = db.attachments.filter(a => a.recordId === r.id)
    if (atts.length) {
      y += 8; text('Csatolmányok', `bold 21px ${F}`, '#0f172a', 34, 16)
      atts.forEach(a => text(`• ${docTypeName(a.type)} – ${a.name}${a.note ? ' (' + a.note + ')' : ''}`, `20px ${F}`, '#334155', 30, 32))
      const pics = atts.filter(a => imgs[a.id])
      let cx = M + 32, rowH = 0
      pics.forEach(a => {
        const im = imgs[a.id]!, w = 300, h = Math.min(260, Math.round(w * im.naturalHeight / Math.max(1, im.naturalWidth)))
        if (cx + w > W - M) { y += rowH + 16; cx = M + 32; rowH = 0 }
        if (rowH === 0) ensure(h + 30)
        try { x.drawImage(im, cx, y, w, h) } catch { /* a kép nem rajzolható */ }
        x.strokeStyle = '#cbd5e1'; x.lineWidth = 1; x.strokeRect(cx, y, w, h)
        cx += w + 16; rowH = Math.max(rowH, h)
      })
      if (pics.length) y += rowH + 30
    }
    y += 34
  })
  ensure(170)
  y += 40
  x.strokeStyle = '#334155'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(W - M - 420, y + 60); x.lineTo(W - M, y + 60); x.stroke()
  x.fillStyle = '#475569'; x.font = `20px ${F}`; x.textAlign = 'center'
  const docs = [...new Set(recs.map(r => doctorName(db, r.doctorId)))].join(', ')
  x.fillText(`${docs || 'kezelőorvos'} aláírása`, W - M - 210, y + 90); x.textAlign = 'left'
  x.fillText(`Kelt: ${fmtDate(date)}`, M, y + 90)
  footer()
  return pages
}

function b64ToBytes(b64: string) { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u }
export function buildPdf(canvases: HTMLCanvasElement[]) {
  const enc = (s: string) => new TextEncoder().encode(s)
  const parts: Uint8Array[] = [], offs: number[] = []; let len = 0
  const push = (b: Uint8Array) => { parts.push(b); len += b.length }
  push(enc('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'))
  const n = canvases.length, nObj = 2 + n * 3
  const obj = (id: number, body: Uint8Array[]) => { offs[id] = len; push(enc(`${id} 0 obj\n`)); body.forEach(push); push(enc('\nendobj\n')) }
  obj(1, [enc('<< /Type /Catalog /Pages 2 0 R >>')])
  const kids = canvases.map((_, i) => `${3 + i * 3} 0 R`).join(' ')
  obj(2, [enc(`<< /Type /Pages /Kids [${kids}] /Count ${n} >>`)])
  canvases.forEach((cv, i) => {
    const pg = 3 + i * 3, im = pg + 1, ct = pg + 2
    const jpg = b64ToBytes(cv.toDataURL('image/jpeg', 0.9).split(',')[1]!)
    const cs = 'q 595.28 0 0 841.89 0 0 cm /Im0 Do Q'
    obj(pg, [enc(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 ${im} 0 R >> >> /Contents ${ct} 0 R >>`)])
    obj(im, [enc(`<< /Type /XObject /Subtype /Image /Width ${cv.width} /Height ${cv.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`), jpg, enc('\nendstream')])
    obj(ct, [enc(`<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`)])
  })
  const xref = len
  let t = `xref\n0 ${nObj + 1}\n0000000000 65535 f \n`
  for (let i = 1; i <= nObj; i++) t += String(offs[i]).padStart(10, '0') + ' 00000 n \n'
  t += `trailer\n<< /Size ${nObj + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  push(enc(t))
  return new Blob(parts as BlobPart[], { type: 'application/pdf' })
}

export const pdfFileName = (name: string, date: string) => `ugyfelkarton_${norm(name).replace(/[^a-z0-9]+/g, '_')}_${date}.pdf`
