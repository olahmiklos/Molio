// Fogazat, FDI-számozás és fogfelszínek
import type { Dentition, Surface, SurfaceMap } from './types'

/** a fogív sorrendje a képernyőn (a páciens jobb oldala a néző bal oldalán) */
export const PERMANENT_UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28]
export const PERMANENT_LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38]
export const PRIMARY_UPPER = [55, 54, 53, 52, 51, 61, 62, 63, 64, 65]
export const PRIMARY_LOWER = [85, 84, 83, 82, 81, 71, 72, 73, 74, 75]

export const archOf = (d: Dentition) =>
  d === 'primary' ? { upper: PRIMARY_UPPER, lower: PRIMARY_LOWER } : { upper: PERMANENT_UPPER, lower: PERMANENT_LOWER }
export const allTeeth = (d: Dentition) => { const a = archOf(d); return [...a.upper, ...a.lower] }

export const isPermanent = (n: number) => n >= 11 && n <= 48 && n % 10 >= 1 && n % 10 <= 8 && Math.floor(n / 10) <= 4
export const isPrimary = (n: number) => n >= 51 && n <= 85 && n % 10 >= 1 && n % 10 <= 5
export const validTooth = (n: number) => isPermanent(n) || isPrimary(n)
export const dentitionOf = (n: number): Dentition => (isPrimary(n) ? 'primary' : 'permanent')
export const quadrant = (n: number) => Math.floor(n / 10)
export const isUpper = (n: number) => [1, 2, 5, 6].includes(quadrant(n))
/** a néző szemszögéből a bal oldalon (páciens jobb oldala) van-e */
export const onViewerLeft = (n: number) => [1, 4, 5, 8].includes(quadrant(n))
export const isFront = (n: number) => n % 10 <= 3

export type ToothKind = 'incisor' | 'canine' | 'premolar' | 'molar' | 'pmolar'
export function toothKind(n: number): ToothKind {
  const u = n % 10
  if (isPrimary(n)) return u <= 2 ? 'incisor' : u === 3 ? 'canine' : 'pmolar'
  return u <= 2 ? 'incisor' : u === 3 ? 'canine' : u <= 5 ? 'premolar' : 'molar'
}

/** magyar ragozás: „36-os”, „21-es”, „38-as” */
export function toothSuffix(n: number) {
  return ({ 1: 'es', 2: 'es', 3: 'as', 4: 'es', 5: 'ös', 6: 'os', 7: 'es', 8: 'as' } as Record<number, string>)[n % 10] || 'es'
}
export const toothLabel = (n: number) => `${n}-${toothSuffix(n)} fog`

export const SURFACE_ORDER: Surface[] = ['M', 'O', 'D', 'V', 'L']
export const SURFACE_NAMES: Record<Surface, string> = {
  M: 'meziális',
  O: 'rágófelszín (okkluzális)',
  D: 'disztális',
  V: 'vesztibuláris (bukkális/labiális)',
  L: 'orális (lingvális/palatinális)',
}
/** a frontfogaknál a rágófelszín helyett metszőél (I) */
export const surfaceCode = (n: number, s: Surface) => (s === 'O' && isFront(n) ? 'I' : s)
export const surfaceName = (n: number, s: Surface) => (s === 'O' && isFront(n) ? 'metszőél (incizális)' : SURFACE_NAMES[s])
/** „36 MO” formátum a szokásos sorrendben (M, O, D, V, L) */
export function surfaceStr(n: number, list?: Surface[]) {
  const s = SURFACE_ORDER.filter(x => list?.includes(x)).map(x => surfaceCode(n, x)).join('')
  return s ? `${n} ${s}` : `${n}`
}
export function teethStr(teeth: number[], surfaces?: SurfaceMap) {
  return teeth.slice().sort((a, b) => a - b).map(t => surfaceStr(t, surfaces?.[t])).join(', ')
}
export const surfaceCount = (surfaces: SurfaceMap | undefined, teeth: number[]) =>
  teeth.reduce((s, t) => s + (surfaces?.[t]?.length || 0), 0)

/** az ív sorrendjében vett tartomány („13-tól 23-ig”) */
export function toothRange(a: number, b: number): number[] | null {
  for (const arr of [PERMANENT_UPPER, PERMANENT_LOWER, PRIMARY_UPPER, PRIMARY_LOWER]) {
    const i = arr.indexOf(a), j = arr.indexOf(b)
    if (i >= 0 && j >= 0) return arr.slice(Math.min(i, j), Math.max(i, j) + 1)
  }
  return null
}

/** a születési dátumból javasolt fogazat */
export function suggestDentition(age: number | null, limit: number): Dentition {
  return age !== null && age < limit ? 'primary' : 'permanent'
}
