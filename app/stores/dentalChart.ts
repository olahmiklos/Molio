// Fogtérkép: a kiválasztott páciens fogainak állapota, fogankénti előzmény és színjelölés,
// a fogtérkép / röntgenkép nézet állapota (2.2.5, 2.2.6)
import { defineStore } from 'pinia'
import { useDataStore } from './data'
import { usePatientStore } from './patient'
import type { Dentition, Surface } from '~/utils/types'
import { doctorName, firstSentence } from '~/utils/logic'
import { allTeeth } from '~/utils/teeth'
import { XRAY_TYPES } from '~/utils/defaults'

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
    const out: Record<number, ToothView> = {}
    allTeeth(d).forEach(n => {
      const status = (statusOverride ? statusOverride[n] : st?.teeth[n]) || []
      const v: ToothView = { n, status, history: [], surf: {}, canal: false, crown: null, missing: false, implant: false, rootOnly: false, caries: false, pontic: false, ring: null }
      // állapot (státusz)
      if (status.includes('tomott')) v.surf.O = v.surf.O || '#2a8ccc'
      if (status.includes('gyokerkezelt')) v.canal = true
      if (status.includes('korona')) v.crown = '#f5b31f'
      if (status.includes('hidtag')) { v.crown = '#f5b31f'; v.pontic = true }
      if (status.includes('implantatum')) v.implant = true
      if (status.includes('hianyzik')) v.missing = true
      if (status.includes('gyokermaradvany')) v.rootOnly = true
      if (status.includes('szuvas')) v.caries = true
      // kezelési előzmények (időrendben, a későbbi felülírja)
      recs.filter(r => r.teeth.includes(n)).forEach(r => {
        const sf = (r.surfaces?.[n] || []) as Surface[]
        r.typeIds.forEach(tid => {
          const t = db.types.find(x => x.id === tid); if (!t) return
          v.history.push({ date: r.date, typeId: tid, typeName: t.name, color: t.color, doctor: doctorName(db, r.doctorId), text: firstSentence(r.text), surfaces: sf })
          if (tid === 'tomes') { (sf.length ? sf : ['O' as Surface]).forEach(x => { v.surf[x] = t.color }); v.caries = false }
          else if (tid === 'gyoker') v.canal = true
          else if (tid === 'korona') v.crown = t.color
          else if (tid === 'huzas') v.missing = true
          else if (!['kontroll', 'fogko'].includes(tid)) v.ring = t.color
        })
      })
      v.history.reverse()
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
