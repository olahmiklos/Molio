// A röntgenszerű, ívelt fogtérkép geometriája (panorámaröntgenhez hasonló elrendezés, spec 2.2.5)
import type { Dentition } from './types'
import { archOf, isPrimary, onViewerLeft, toothKind, type ToothKind } from './teeth'

export const CHART_W = 1000
export const CHART_H = 540

interface Dim { w: number; ch: number; rl: number; roots: 1 | 2 }
function dims(n: number): Dim {
  const u = n % 10, k = toothKind(n), upper = [1, 2, 5, 6].includes(Math.floor(n / 10))
  if (isPrimary(n)) {
    const W = { 1: 50, 2: 44, 3: 50, 4: 66, 5: 74 } as Record<number, number>
    return { w: W[u]!, ch: k === 'pmolar' ? 44 : 50, rl: k === 'pmolar' ? 70 : 92, roots: k === 'pmolar' ? 2 : 1 }
  }
  const W = { 1: 46, 2: 40, 3: 44, 4: 43, 5: 43, 6: 58, 7: 54, 8: 49 } as Record<number, number>
  const CH = { incisor: 44, canine: 47, premolar: 39, molar: 36 } as Record<ToothKind, number>
  const RL = { incisor: 80, canine: 102, premolar: 84, molar: upper ? 72 : 80 } as Record<ToothKind, number>
  return { w: W[u]!, ch: CH[k], rl: RL[k] - (u === 8 ? 10 : 0), roots: k === 'molar' || (upper && u === 4) ? 2 : 1 }
}

function crownPath(n: number, d: Dim) {
  const { w, ch } = d, k = toothKind(n)
  const cw = w * 0.36, hw = w / 2, ow = w * 0.44
  let edge: string
  if (k === 'incisor') edge = `L ${-ow} -3 Q ${-ow * 0.5} 1 0 0 Q ${ow * 0.5} 1 ${ow} -3`
  else if (k === 'canine') edge = `L ${-ow} -11 Q ${-ow * 0.45} -3 0 1 Q ${ow * 0.45} -3 ${ow} -11`
  else if (k === 'premolar') edge = `L ${-ow} -7 Q ${-ow * 0.5} 3 0 -5 Q ${ow * 0.5} 3 ${ow} -7`
  else edge = `L ${-ow} -6 Q ${-ow * 0.67} 2 ${-ow * 0.33} -4 Q 0 2 ${ow * 0.2} -4 Q ${ow * 0.6} 2 ${ow} -6`
  return `M ${-cw} ${-ch} C ${-hw} ${-ch * 0.82} ${-hw} ${-ch * 0.38} ${-ow} ${-ch * 0.18} ${edge} C ${hw} ${-ch * 0.38} ${hw} ${-ch * 0.82} ${cw} ${-ch} Q 0 ${-ch + ch * 0.14} ${-cw} ${-ch} Z`
}

function rootPath(d: Dim, primary: boolean) {
  const { ch, rl } = d
  const rw = d.w * (primary && d.roots === 2 ? 0.42 : 0.34)
  const a = -ch - rl
  if (d.roots === 1) {
    return { path: `M ${-rw} ${-ch} C ${-rw * 0.98} ${-ch - rl * 0.5} ${-rw * 0.38} ${a + rl * 0.08} 0 ${a} C ${rw * 0.38} ${a + rl * 0.08} ${rw * 0.98} ${-ch - rl * 0.5} ${rw} ${-ch} Z`, apices: [[0, a + 6]] as [number, number][] }
  }
  const sp = primary ? 1.35 : 1.05
  return {
    path: `M ${-rw} ${-ch} C ${-rw * 1.1 * sp} ${-ch - rl * 0.5} ${-rw * 0.95 * sp} ${a + rl * 0.1} ${-rw * 0.62 * sp} ${a} C ${-rw * 0.35 * sp} ${a} ${-rw * 0.25} ${-ch - rl * 0.4} 0 ${-ch - rl * 0.3} C ${rw * 0.25} ${-ch - rl * 0.4} ${rw * 0.35 * sp} ${a} ${rw * 0.62 * sp} ${a} C ${rw * 0.95 * sp} ${a + rl * 0.1} ${rw * 1.1 * sp} ${-ch - rl * 0.5} ${rw} ${-ch} Z`,
    apices: [[-rw * 0.62 * sp, a + 6], [rw * 0.62 * sp, a + 6]] as [number, number][],
  }
}

export interface ToothGeo {
  n: number
  x: number
  y: number
  angle: number
  upper: boolean
  /** a meziális oldal a fog helyi koordinátáiban a +x irányban van-e */
  mesialRight: boolean
  w: number
  ch: number
  rl: number
  crown: string
  root: string
  canals: string[]
  labelX: number
  labelY: number
}

/** a fogsor elhelyezése két ívben (felső és alsó), a valódi fogívnek megfelelően */
export function chartGeometry(dentition: Dentition): ToothGeo[] {
  const { upper, lower } = archOf(dentition)
  const primary = dentition === 'primary'
  const gap = primary ? 6 : 4
  const place = (row: number[], isUp: boolean): ToothGeo[] => {
    const ds = row.map(n => dims(n))
    const total = ds.reduce((s, d) => s + d.w, 0) + gap * (row.length - 1) + 6
    let x = CHART_W / 2 - total / 2
    const hw = total / 2
    return row.map((n, i) => {
      const d = ds[i]!
      if (i === row.length / 2) x += 6 // középvonal
      const cx = x + d.w / 2
      x += d.w + gap
      const u = (cx - CHART_W / 2) / hw
      const yc = 252 + 30 * (1 - u * u) // mosolyív: középen lejjebb
      const slope = (-60 * u) / hw
      const ang = (Math.atan(slope) * 180) / Math.PI
      const y = isUp ? yc - 7 : yc + 7
      const r = rootPath(d, primary)
      const canals = r.apices.map(([ax, ay]) => `M 0 ${-d.ch * 0.42} Q ${ax * 0.35} ${-d.ch - 8} ${ax} ${ay}`)
      const reach = d.ch + d.rl + 20
      const rad = (ang * Math.PI) / 180
      // a felirat a gyökércsúcson túl, a fog tengelyében
      const lx = cx + (isUp ? 1 : -1) * Math.sin(rad) * reach
      const ly = y + (isUp ? -1 : 1) * Math.cos(rad) * reach
      return { n, x: cx, y, angle: ang, upper: isUp, mesialRight: onViewerLeft(n), w: d.w, ch: d.ch, rl: d.rl, crown: crownPath(n, d), root: r.path, canals, labelX: lx, labelY: isUp ? ly : ly + 8 }
    })
  }
  return [...place(upper, true), ...place(lower, false)]
}
