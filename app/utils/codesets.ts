// Fogászati kódkészletek és szinonimatábla (spec v2.1, 5. pont).
// A diktálás szabályalapú értelmezése és a későbbi AI-értelmezés zárt, strukturált kódkészletekre épül.
// A végleges rendszerben ezek adatbázis-táblák (prisma/schema.prisma: CodeSetVersion, Synonym stb.), nem dokumentumok;
// a demóban a szabványos részek teljes körűek, a műveletek és anyagok a Cooldent demócég néhány tipikus példája.
import { norm } from './dates'
import { PERMANENT_LOWER, PERMANENT_UPPER, PRIMARY_LOWER, PRIMARY_UPPER, quadrant, toothKind } from './teeth'
import type { DB, Synonym } from './types'

export const CODESET_VERSION = { version: '2.1.0', date: '2026-11-19' }

export const TOOTH_NAMES: Record<string, [string, string]> = {
  incisor: ['metszőfog', 'dens incisivus'], canine: ['szemfog', 'dens caninus'], premolar: ['kisőrlő', 'dens praemolaris'], molar: ['nagyőrlő', 'dens molaris'], pmolar: ['tejőrlő', 'dens molaris decidui'],
}
const QUAD_NAME: Record<number, string> = { 1: 'jobb felső', 2: 'bal felső', 3: 'bal alsó', 4: 'jobb alsó', 5: 'jobb felső (tej)', 6: 'bal felső (tej)', 7: 'bal alsó (tej)', 8: 'jobb alsó (tej)' }

/** fogak: FDI-számozás, magyar és latin név, kvadráns, típus, tejfog/maradó */
export function toothCodes() {
  const all = [...PERMANENT_UPPER, ...PERMANENT_LOWER, ...PRIMARY_UPPER, ...PRIMARY_LOWER]
  return all.sort((a, b) => a - b).map(n => {
    const kind = toothKind(n), nm = TOOTH_NAMES[kind]!
    return { code: n, hu: `${QUAD_NAME[quadrant(n)]} ${nm[0]}`, latin: nm[1], quadrant: quadrant(n), kind: nm[0], primary: n >= 51 }
  })
}
export const SURFACE_CODES = [
  { code: 'M', name: 'mesialis (meziális)', abbr: 'M' }, { code: 'D', name: 'distalis (disztális)', abbr: 'D' },
  { code: 'O', name: 'occlusalis / incisalis (rágófelszín / metszőél)', abbr: 'O / I' }, { code: 'V', name: 'buccalis / vestibularis / labialis', abbr: 'V / B' },
  { code: 'L', name: 'lingualis / palatinalis (orális)', abbr: 'L / P' },
  { code: 'MO', name: 'mesio-occlusalis', abbr: 'MO' }, { code: 'OD', name: 'occluso-distalis', abbr: 'OD' }, { code: 'MOD', name: 'mesio-occluso-distalis', abbr: 'MOD' },
]

/** szinonimatábla: elhangzó forma → kanonikus forma (a szöveg ékezet nélküli, kisbetűs alakján dolgozik) */
export const DEFAULT_SYNONYMS: Synonym[] = [
  { id: 'sy1', from: 'gyoker kezeles', to: 'gyokerkezeles', group: 'hangfelismerési javítás' },
  { id: 'sy2', from: 'fog ko', to: 'fogko', group: 'hangfelismerési javítás' },
  { id: 'sy3', from: 'bolcsesseg fog', to: 'bolcsessegfog', group: 'hangfelismerési javítás' },
  { id: 'sy4', from: 'elo keszites', to: 'elokeszites', group: 'hangfelismerési javítás' },
  { id: 'sy5', from: 'hianyzo', to: 'hianyzik', group: 'szinonima' },
  { id: 'sy6', from: 'kihuzott', to: 'extrahalt', group: 'szinonima' },
  { id: 'sy7', from: 'eltavolitottuk', to: 'kihuztuk', group: 'szinonima' },
  { id: 'sy8', from: 'mezio okkluzalis', to: 'mesialis okkluzalis', group: 'felszín' },
  { id: 'sy9', from: 'okkluzo disztalis', to: 'okkluzalis disztalis', group: 'felszín' },
  { id: 'sy10', from: 'kompozit tomest', to: 'kompozit tomes', group: 'szinonima' },
  { id: 'sy11', from: 'szajsebeszeti', to: 'sebeszi', group: 'szinonima' },
  { id: 'sy12', from: 'harminchatost', to: 'harminchatos', group: 'fogszám mondási változat' },
  { id: 'sy13', from: 'negyvennyolcast', to: 'negyvennyolcas', group: 'fogszám mondási változat' },
]
let active: Synonym[] = DEFAULT_SYNONYMS
export const setSynonyms = (list?: Synonym[]) => { active = list && list.length ? list : DEFAULT_SYNONYMS }
/** a diktált szöveg szinonimáinak és tipikus hangfelismerési tévesztéseinek javítása (ékezet nélküli alakon) */
export function applySynonyms(text: string, list: Synonym[] = active): string {
  let t = ' ' + norm(text) + ' '
  for (const s of list) {
    const from = norm(s.from).trim(); if (!from) continue
    const esc = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
    t = t.replace(new RegExp(`(?<![a-z0-9])${esc}(?![a-z0-9])`, 'g'), norm(s.to))
  }
  return t.trim()
}

export interface CodeTables {
  version: string
  date: string
  teeth: ReturnType<typeof toothCodes>
  surfaces: typeof SURFACE_CODES
  states: { code: string; name: string; kw: string[] }[]
  procedures: { code: string; name: string; toothBound: boolean; price: number; surfaceDependent: boolean }[]
  materials: { code: string; name: string; unit: string; lot: boolean }[]
  packages: { procedure: string; lines: { item: string; qty: number; per: string }[] }[]
  synonyms: Synonym[]
}
export function codeTables(db: DB): CodeTables {
  return {
    ...CODESET_VERSION,
    teeth: toothCodes(),
    surfaces: SURFACE_CODES,
    states: db.settings.statusDict.map(d => ({ code: d.id, name: d.name, kw: d.kw })),
    procedures: db.types.map(t => ({ code: t.id, name: t.name, toothBound: !!t.toothBound, price: t.price, surfaceDependent: !!t.priceBySurf })),
    materials: db.items.map(i => ({ code: i.id, name: i.name, unit: i.unit, lot: !!i.lotTracked })),
    packages: db.types.map(t => ({ procedure: t.id, lines: t.mats.map(m => ({ item: m.item, qty: m.qty, per: m.per })) })),
    synonyms: db.settings.synonyms || DEFAULT_SYNONYMS,
  }
}
