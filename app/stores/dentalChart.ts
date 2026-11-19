// Fogtérkép: a kiválasztott páciens fogainak állapota, fogankénti előzmény és színjelölés,
// a fogtérkép / röntgenkép nézet állapota (2.2.5, 2.2.6)
import { defineStore } from 'pinia'
import { useDataStore } from './data'
import { usePatientStore } from './patient'
import type { Dentition, Surface } from '~/utils/types'
import { doctorName, firstSentence } from '~/utils/logic'
import { allTeeth } from '~/utils/teeth'
import { STATUS_STYLE, XRAY_TYPES } from '~/utils/defaults'
import { isPendingSuggestion } from '~/utils/suggest'

export interface ToothHistory { date: string; typeId: string; typeName: string; color: string; doctor: string; text: string; surfaces: Surface[] }
export interface ToothView {
  n: number
  status: string[]
  history: ToothHistory[]
  /** felszínenkénti szín a korábbi kezelésekből */
  surf: Partial<Record<Surface, string>>
  canal: boolean
  crown: string | null
  missing: boolean
  implant: boolean
  rootOnly: boolean
  caries: boolean
  pontic: boolean
  ring: string | null
  /** nyitott javasolt kezelés van rajta (még nincs időpont) */
  suggested: boolean
}

export const useDentalChartStore = defineStore('dentalChart', () => {
  const data = useDataStore()
  const patients = usePatientStore()
  const view = ref<Record<string, { mode: 'chart' | 'xray'; xrayId: string | null }>>({})

  function model(pid: string, dentition?: Dentition, statusOverride?: Record<string, string[]>): Record<number, ToothView> {
    const db = data.db
    const p = patients.byId(pid); if (!p) return {}
    const d = dentition || p.dentition
    const st = statusOverride ? null : patients.latestStatus(pid, d)
    const recs = db.records.filter(r => r.patientId === pid).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    // a diktált státuszváltozás előnézete miatt a páciens pillanatképei is kellenek
    const out: Record<number, ToothView> = {}
    allTeeth(d).forEach(n => {
      const status = (statusOverride ? statusOverride[n] : st?.teeth[n]) || []
      const v: ToothView = { n, status, history: [], surf: {}, canal: false, crown: null, missing: false, implant: false, rootOnly: false, caries: false, pontic: false, ring: null, suggested: false }
      // állapot (státusz)
      if (status.includes('tomott')) v.surf.O = v.surf.O || '#2a8ccc'
      if (status.includes('gyokerkezelt')) v.canal = true
      if (status.includes('korona')) v.crown = '#f5b31f'
      if (status.includes('hidtag')) { v.crown = '#f5b31f'; v.pontic = true }
      if (status.includes('implantatum')) v.implant = true
      if (status.includes('hianyzik')) v.missing = true
      if (status.includes('gyokermaradvany')) v.rootOnly = true
      if (status.includes('szuvas')) v.caries = true
      // kezelési előzmények (időrendben, a későbbi felülírja); a tételes rekordoknál a fogra vonatkozó tételek számítanak
      const entries: (ToothHistory & { ord: string })[] = []
      recs.forEach(r => {
        const own = r.items?.length ? r.items.filter(i => i.tooth === n && i.state === 'done').map(i => ({ typeId: i.typeId, sf: i.surfaces as Surface[] })) : r.teeth.includes(n) ? r.typeIds.map(tid => ({ typeId: tid, sf: (r.surfaces?.[n] || []) as Surface[] })) : []
        own.forEach(({ typeId: tid, sf }) => {
          const t = db.types.find(x => x.id === tid); if (!t) return
          entries.push({ ord: r.date + r.time, date: r.date, typeId: tid, typeName: t.name, color: t.color, doctor: doctorName(db, r.doctorId), text: firstSentence(r.text), surfaces: sf })
          if (tid === 'tomes') { (sf.length ? sf : ['O' as Surface]).forEach(x => { v.surf[x] = t.color }); v.caries = false }
          else if (tid === 'gyoker') v.canal = true
          else if (tid === 'korona') v.crown = t.color
          else if (tid === 'huzas') v.missing = true
          else if (!['kontroll', 'fogko'].includes(tid)) v.ring = t.color
        })
      })
      // állapotváltozások (pl. diktálásból rögzített „hiányzik”) az előzményekben
      ;(p.statuses || []).filter(sn => sn.dentition === d && sn.changes?.[n]).forEach(sn => {
        const ch = sn.changes![n]!
        const lab = ch.to.map(x => STATUS_STYLE[x]?.label || x).join(', ') || 'ép'
        entries.push({ ord: sn.date + '99', date: sn.date, typeId: 'status', typeName: `Állapot: ${lab}`, color: '#64748b', doctor: '', text: sn.source === 'dictation' ? 'diktálásból rögzítve' : sn.source === 'treatment' ? 'kezelés után rögzítve' : 'fogazati státuszból rögzítve', surfaces: [] })
      })
      // javasolt, még nem elvégzett kezelés
      ;(db.suggestions || []).filter(sg => sg.patientId === pid && sg.tooth === n).forEach(sg => {
        const t = db.types.find(x => x.id === sg.typeId)
        entries.push({ ord: sg.createdAt + '98', date: sg.createdAt, typeId: 'suggested', typeName: `javasolva: ${t?.name || sg.typeId}`, color: '#f5891f', doctor: doctorName(db, sg.doctorId), text: sg.note || '', surfaces: sg.surfaces })
        if (isPendingSuggestion(sg)) v.suggested = true
      })
      entries.sort((a, b) => a.ord.localeCompare(b.ord)).reverse()
      v.history = entries.map(({ ord: _o, ...h }) => h)
      out[n] = v
    })
    return out
  }

  const xrays = (pid: string) => data.db.attachments
    .filter(a => a.patientId === pid && !a.sessKey && XRAY_TYPES.includes(a.type) && (a.mime || '').startsWith('image/'))
    .sort((a, b) => b.date.localeCompare(a.date))
  const sessionXrays = (pid: string, sessKey: string) => data.db.attachments
    .filter(a => a.patientId === pid && (a.sessKey === sessKey || !a.sessKey) && XRAY_TYPES.includes(a.type) && (a.mime || '').startsWith('image/'))
    .sort((a, b) => b.date.localeCompare(a.date))

  function viewOf(pid: string) {
    if (!view.value[pid]) view.value[pid] = { mode: 'chart', xrayId: null }
    return view.value[pid]!
  }

  return { model, xrays, sessionXrays, viewOf }
})
