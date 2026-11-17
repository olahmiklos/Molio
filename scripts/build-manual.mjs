// Felhasználói kézikönyv PDF-ben a docs/kezikonyv.md-ből (spec v2.0, 2.9).
// A buildkor fut (nuxt.config.ts → build:before hook, illetve `npm run manual`), így a kézikönyv minden
// kiadással frissül: az éles (main) oldalon akkor, amikor új verzió kerül a main ágra.
// Kimenet: public/kezikonyv/Molio_felhasznaloi_kezikonyv.pdf és public/kezikonyv/meta.json (nincs verziókezelve).
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import PDFDocument from 'pdfkit'

const require = createRequire(import.meta.url)
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const font = w => require.resolve(`@expo-google-fonts/raleway/${w}/Raleway_${w}.ttf`)
const C = { green: '#3fa463', blue: '#2a8ccc', slate: '#4e5661', text: '#2b3036', muted: '#7c858f', line: '#e3e8ec', note: '#e7f6ec' }

/** a kiadás adatai: verzió, specifikáció, dátum, ág */
export function manualMeta() {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
  const branch = process.env.WORKERS_CI_BRANCH || process.env.CF_PAGES_BRANCH || process.env.GITHUB_REF_NAME || ''
  const commit = (process.env.WORKERS_CI_COMMIT_SHA || process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA || '').slice(0, 7)
  const d = new Date()
  const MONTHS = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december']
  return {
    version: pkg.version,
    spec: pkg.molio?.spec || '',
    builtAt: d.toISOString(),
    builtAtText: `${d.getFullYear()}. ${MONTHS[d.getMonth()]} ${d.getDate()}.`,
    branch,
    commit,
    preview: !!branch && branch !== 'main',
  }
}

/* ---------- egyszerű Markdown-értelmező: #, ##, ###, bekezdés, - lista, 1. lista, > kiemelés, **félkövér** ---------- */
function parse(md) {
  const blocks = []
  let para = []
  const flush = () => { if (para.length) { blocks.push({ t: 'p', text: para.join(' ') }); para = [] } }
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trimEnd()
    let m
    if (!line.trim()) { flush(); continue }
    if ((m = line.match(/^(#{1,3})\s+(.*)$/))) { flush(); blocks.push({ t: 'h' + m[1].length, text: m[2] }); continue }
    if ((m = line.match(/^[-*]\s+(.*)$/))) { flush(); blocks.push({ t: 'li', text: m[1] }); continue }
    if ((m = line.match(/^(\d+)\.\s+(.*)$/))) { flush(); blocks.push({ t: 'ol', n: m[1], text: m[2] }); continue }
    if ((m = line.match(/^>\s?(.*)$/))) { flush(); const last = blocks[blocks.length - 1]; if (last?.t === 'q') last.text += ' ' + m[1]; else blocks.push({ t: 'q', text: m[1] }); continue }
    para.push(line.trim())
  }
  flush()
  return blocks
}

/** **félkövér** szakaszok kiírása egy bekezdésben */
function rich(doc, text, opts = {}, base = 'R', x = doc.page.margins.left, y = doc.y) {
  const parts = text.split(/(\*\*[^*]+\*\*)/).filter(Boolean)
  parts.forEach((p, i) => {
    const bold = p.startsWith('**') && p.endsWith('**')
    const o = { ...opts, continued: i < parts.length - 1 }
    doc.font(bold ? 'B' : base)
    if (i === 0) doc.text(bold ? p.slice(2, -2) : p, x, y, o)
    else doc.text(bold ? p.slice(2, -2) : p, o)
  })
}

export async function buildManual({ quiet = false } = {}) {
  const meta = manualMeta()
  const outDir = join(ROOT, 'public', 'kezikonyv')
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })
  const outPdf = join(outDir, 'Molio_felhasznaloi_kezikonyv.pdf')
  // a Raleway betűkészletben nincs → jel: a menüutakhoz › kerül
  const blocks = parse(readFileSync(join(ROOT, 'docs', 'kezikonyv.md'), 'utf8').replace(/→/g, '›'))

  const doc = new PDFDocument({ size: 'A4', margins: { top: 64, bottom: 70, left: 62, right: 62 }, bufferPages: true, info: { Title: 'Molio – Felhasználói kézikönyv', Author: 'Molio', Subject: `Molio ${meta.version}` } })
  doc.registerFont('R', font('400Regular'))
  doc.registerFont('M', font('500Medium'))
  doc.registerFont('B', font('700Bold'))
  doc.registerFont('X', font('800ExtraBold'))
  const done = new Promise((res, rej) => { const s = createWriteStream(outPdf); s.on('finish', res); s.on('error', rej); doc.pipe(s) })
  const W = doc.page.width, L = doc.page.margins.left, CW = W - L - doc.page.margins.right

  // címlap
  doc.rect(0, 0, W, 10).fill(C.green)
  const logo = join(ROOT, 'public', 'pwa-512.png')
  if (existsSync(logo)) doc.image(logo, L, 150, { width: 90 })
  doc.fillColor(C.slate).font('X').fontSize(54).text('Mol', L, 260, { continued: true }).fillColor(C.green).text('io')
  doc.fillColor(C.text).font('B').fontSize(26).text('Felhasználói kézikönyv', L, 335)
  doc.fillColor(C.muted).font('M').fontSize(13).text('Fogorvosi rendelőkezelő program – bemutató (demó) verzió', L, 372)
  doc.moveTo(L, 410).lineTo(L + CW, 410).lineWidth(1).strokeColor(C.line).stroke()
  doc.fillColor(C.text).font('R').fontSize(12)
  const kv = [['Programverzió', meta.version], ['Specifikáció', meta.spec], ['A kézikönyv kelte', meta.builtAtText + (meta.commit ? ` (${meta.commit})` : '')]]
  kv.forEach(([k, v], i) => { doc.fillColor(C.muted).font('M').text(k, L, 430 + i * 24, { width: 150 }); doc.fillColor(C.text).font('B').text(v, L + 160, 430 + i * 24) })
  if (meta.preview) {
    doc.roundedRect(L, 520, CW, 50, 8).fill('#fff1dc')
    doc.fillColor('#b45309').font('B').fontSize(12).text(`Teszt-előnézet (ág: ${meta.branch}) – ez nem a kiadott verzió kézikönyve.`, L + 16, 538)
  }
  doc.fillColor(C.muted).font('R').fontSize(10).text('A kézikönyv a programmal együtt frissül: minden új kiadásnál újra elkészül. A legfrissebb változat a programban a Súgó oldalon tölthető le.', L, 720, { width: CW })

  // tartalomjegyzék helye (kitöltés a végén)
  doc.addPage(); const tocPage = doc.bufferedPageRange().count - 1
  const toc = []
  let chapter = 0, section = 0

  const ensure = h => { if (doc.y + h > doc.page.height - doc.page.margins.bottom) doc.addPage() }
  for (const b of blocks) {
    if (b.t === 'h1') {
      chapter++; section = 0
      doc.addPage()
      const title = `${chapter}. ${b.text}`
      toc.push({ level: 1, title, page: doc.bufferedPageRange().count })
      doc.outline.addItem(title)
      doc.rect(L, doc.y, 46, 5).fill(C.green)
      doc.moveDown(0.6).fillColor(C.text).font('X').fontSize(24).text(title, L, doc.y, { width: CW })
      doc.moveDown(0.5)
    } else if (b.t === 'h2') {
      section++
      ensure(70)
      doc.moveDown(0.6)
      const title = `${chapter}.${section}. ${b.text}`
      toc.push({ level: 2, title, page: doc.bufferedPageRange().count })
      doc.fillColor(C.green).font('B').fontSize(15).text(title, L, doc.y, { width: CW })
      doc.moveDown(0.3)
    } else if (b.t === 'h3') {
      ensure(50); doc.moveDown(0.3)
      doc.fillColor(C.slate).font('B').fontSize(12.5).text(b.text, L, doc.y, { width: CW }); doc.moveDown(0.2)
    } else if (b.t === 'p') {
      ensure(30)
      doc.fillColor(C.text).fontSize(10.8); rich(doc, b.text, { width: CW, lineGap: 2.5, align: 'left' }); doc.moveDown(0.55)
    } else if (b.t === 'li' || b.t === 'ol') {
      ensure(24)
      const y = doc.y
      doc.fillColor(C.green).font('B').fontSize(10.8).text(b.t === 'li' ? '•' : b.n + '.', L + 6, y, { width: 18 })
      doc.fillColor(C.text).fontSize(10.8); rich(doc, b.text, { width: CW - 26, lineGap: 2.5 }, 'R', L + 26, y)
      // a felsorolás szövege a jel mellett kezdődik
      doc.moveDown(0.3)
    } else if (b.t === 'q') {
      doc.font('R').fontSize(10.8)
      const h = doc.heightOfString(b.text.replace(/\*\*/g, ''), { width: CW - 32, lineGap: 2.5 }) + 20
      ensure(h + 10)
      const y = doc.y
      doc.roundedRect(L, y, CW, h, 6).fill(C.note)
      doc.rect(L, y, 4, h).fill(C.green)
      doc.fillColor(C.text).fontSize(10.8); rich(doc, b.text, { width: CW - 32, lineGap: 2.5 }, 'M', L + 18, y + 10)
      doc.y = y + h; doc.moveDown(0.6)
    }
  }

  // tartalomjegyzék
  doc.switchToPage(tocPage)
  doc.fillColor(C.text).font('X').fontSize(24).text('Tartalom', L, doc.page.margins.top)
  doc.moveDown(0.8)
  toc.forEach(t => {
    if (t.level === 1) doc.moveDown(0.25)
    doc.fillColor(t.level === 1 ? C.text : C.slate).font(t.level === 1 ? 'B' : 'R').fontSize(t.level === 1 ? 11.5 : 10.2)
    const x = L + (t.level === 1 ? 0 : 18)
    doc.text(t.title, x, doc.y, { width: CW - 60 - (x - L), lineBreak: false })
    doc.text(String(t.page), L + CW - 40, doc.y - doc.currentLineHeight(), { width: 40, align: 'right' })
    doc.moveDown(t.level === 1 ? 0.35 : 0.2)
  })

  // élőláb minden oldalon (a címlap kivételével)
  const range = doc.bufferedPageRange()
  for (let i = 1; i < range.count; i++) {
    doc.switchToPage(i)
    const bottom = doc.page.margins.bottom; doc.page.margins.bottom = 0
    doc.moveTo(L, doc.page.height - 48).lineTo(L + CW, doc.page.height - 48).lineWidth(0.6).strokeColor(C.line).stroke()
    doc.fillColor(C.muted).font('R').fontSize(8.5)
      .text(`Molio ${meta.version} – Felhasználói kézikönyv · ${meta.builtAtText}${meta.preview ? ' · teszt-előnézet' : ''}`, L, doc.page.height - 40, { width: CW - 60, lineBreak: false })
      .text(`${i + 1}. oldal`, L + CW - 60, doc.page.height - 40, { width: 60, align: 'right', lineBreak: false })
    doc.page.margins.bottom = bottom
  }
  doc.end()
  await done
  writeFileSync(join(outDir, 'meta.json'), JSON.stringify({ ...meta, pages: range.count, file: 'Molio_felhasznaloi_kezikonyv.pdf' }, null, 2))
  if (!quiet) console.log(`[kézikönyv] ${outPdf} – ${range.count} oldal, ${meta.version}${meta.preview ? ' (teszt-előnézet: ' + meta.branch + ')' : ''}`)
  return meta
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildManual().catch(e => { console.error(e); process.exit(1) })
}
