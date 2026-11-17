// PDF ügyfélkarton letöltése a böngészőben
import { useDataStore } from '~/stores/data'
import { useUiStore } from '~/stores/ui'
import { buildPdf, pdfFileName, pdfPages } from '~/utils/pdf'

export function usePdf() {
  const data = useDataStore()
  const ui = useUiStore()
  const files = useFiles()
  async function download(pid: string, date: string) {
    const db = data.db
    const p = db.patients.find(x => x.id === pid); if (!p) return
    if (document.fonts?.ready) await document.fonts.ready
    const recIds = new Set(db.records.filter(r => r.patientId === pid && r.date === date).map(r => r.id))
    const imgs: Record<string, HTMLImageElement> = {}
    for (const a of db.attachments.filter(a => a.recordId && recIds.has(a.recordId) && (a.mime || '').startsWith('image/'))) {
      const u = await files.urlOf(a.id); if (!u) continue
      const im = new Image()
      await new Promise(res => { im.onload = res; im.onerror = res; im.src = u })
      if (im.naturalWidth) imgs[a.id] = im
    }
    const blob = buildPdf(pdfPages(db, pid, date, imgs))
    const el = document.createElement('a')
    el.href = URL.createObjectURL(blob)
    el.download = pdfFileName(p.name, date)
    document.body.appendChild(el); el.click(); el.remove()
    setTimeout(() => URL.revokeObjectURL(el.href), 8000)
    ui.toast('PDF letöltve')
  }
  return { download }
}
