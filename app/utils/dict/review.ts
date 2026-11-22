// A diktálás utáni ⚠ ellenőrzések (spec v2.3: 5., 9., 15. pont): kétértelmű mennyiség, az előjegyzett kezelés felhasználása, ellenőrzés a fogtérképpel, életszerűségi vizsgálat.
// Minden jelzés ugyanabban az egyetlen ⚠ ellenőrzésben jelenik meg (v2.2 4. pont), soha nem íródik csendben.
import { anyKw, findTeeth, ordinalOf, tokenize } from '../parser'
import type { Item, TreatmentType } from '../types'
import { toothLabel } from '../teeth'
import type { DictFlag } from './pipeline'

export interface PairLite { tooth: number | null; typeId: string }
export interface ReviewCtx {
  text: string
  done: PairLite[]
  planItems: PairLite[]
  /** a kezelés végső (elvégzett) tételei diktálási sorrendben, a kézzel hozzáadottakkal együtt */
  finalItems: PairLite[]
  status: Record<string, string[]>
  types: TreatmentType[]
  catalog: Item[]
  qty: Record<string, number>
  pkg: Record<string, number>
  history: { item: string; qty: number }[]
  compat: Record<string, string[]>
  decimalUnits?: string[]
}
export const DEFAULT_COMPAT: Record<string, string[]> = { tomes: ['hianyzik', 'implantatum'], gyoker: ['hianyzik', 'implantatum'], korona: ['hianyzik'], huzas: ['hianyzik'], implant: ['implantatum'] }
export const DECIMAL_UNITS = ['ml', 'g', 'adag']
const tn = (types: TreatmentType[], id: string) => types.find(t => t.id === id)?.name || id
const tnl = (types: TreatmentType[], id: string) => tn(types, id).toLowerCase()
const STATE_NAME: Record<string, string> = { hianyzik: 'hiányzik', implantatum: 'implantátumos', gyokermaradvany: 'gyökérmaradvány', extrahalt: 'extrahált', korona: 'koronás', tomott: 'tömött', gyokerkezelt: 'gyökérkezelt', szuvas: 'szuvas', ep: 'ép' }

/** 9. pont: hiányos fogszám („hatos”) – csak a pozíció hangzott el, kvadráns nélkül */
export function orphanPositions(text: string): { pos: number; word: string; idx: number }[] {
  const toks = tokenize(text), ms = findTeeth(toks), used = new Set<number>()
  ms.forEach(m => { for (let k = m.start; k <= m.end; k++) used.add(k) })
  const out: { pos: number; word: string; idx: number }[] = []
  toks.forEach((t, i) => {
    if (used.has(i) || t === '|') return
    const pos = ordinalOf(t); if (!pos || pos > 8) return
    // „három hatos injekció”: szám előtte → kiszerelés-változat / tizedes (5. pont), nem fogszám
    const prev = toks[i - 1] || ''
    if (/^\d+$/.test(prev) || ['egy', 'ket', 'harom', 'negy', 'ot', 'hat', 'het', 'nyolc', 'kilenc', 'tiz'].includes(prev)) return
    out.push({ pos, word: t, idx: i })
  })
  return out
}

export function reviewFlags(c: ReviewCtx): DictFlag[] {
  const flags: DictFlag[] = []
  const typeCtx = { types: c.types, items: c.catalog }
  void typeCtx
  const planTeeth = c.planItems.filter(p => p.tooth)

  /* 9. pont – hiányos fogszám kiegészítése az előjegyzésből */
  orphanPositions(c.text).forEach((o, k) => {
    const fits = [...new Set(planTeeth.map(p => p.tooth!).filter(n => n % 10 === o.pos))]
    const key = `pre:pos:${o.word}:${k}`
    if (fits.length) flags.push({ key, kind: 'prebooked', title: `„${o.word}” – melyik fog?`, detail: fits.length === 1 ? 'Előjegyzésből kiegészítve: ' + toothLabel(fits[0]!) : 'Több előjegyzett fog is illik rá.', suggested: String(fits[0]), choices: [...fits.map(n => ({ id: String(n), label: `${n}-es fog`, hint: 'előjegyzett' })), { id: 'none', label: 'Egyik sem' }], data: { tooth: fits, pos: o.pos } })
    else flags.push({ key, kind: 'prebooked', title: `„${o.word}” – melyik fog?`, detail: 'Csak a pozíció hangzott el, előjegyzett fog nincs hozzá.', choices: [...[1, 2, 3, 4].map(q => ({ id: String(q * 10 + o.pos), label: `${q * 10 + o.pos}-es fog` })), { id: 'none', label: 'Egyik sem' }], data: { pos: o.pos } })
  })

  /* 9. pont – fog nélküli művelet hozzárendelése az előjegyzett tételhez */
  c.done.filter(d => d.tooth === null && c.types.find(t => t.id === d.typeId)?.toothBound).forEach(d => {
    const fits = [...new Set(planTeeth.filter(p => p.typeId === d.typeId).map(p => p.tooth!))]
    if (!fits.length) return
    flags.push({ key: `pre:op:${d.typeId}`, kind: 'prebooked', title: `${tn(c.types, d.typeId)} – melyik fogon?`, detail: fits.length === 1 ? 'Előjegyzésből kiegészítve: ' + toothLabel(fits[0]!) + ' – ' + tnl(c.types, d.typeId) : 'Több előjegyzett fogon szerepel ez a művelet.', suggested: String(fits[0]), choices: [...fits.map(n => ({ id: String(n), label: `${n}-es fog`, hint: 'előjegyzett' })), { id: 'none', label: 'Egyik sem' }], data: { typeId: d.typeId, tooth: fits } })
  })

  /* 9. pont – fog nélküli anyag az előjegyzett tételhez (a csomagjában szerepel) */
  const noTooth = c.done.length === 0 && Object.keys(c.qty).length > 0
  if (noTooth && c.planItems.length) {
    Object.keys(c.qty).forEach(id => {
      const owners = c.planItems.filter(p => c.types.find(t => t.id === p.typeId)?.mats.some(m => m.item === id))
      if (owners.length !== 1) return
      const it = c.catalog.find(i => i.id === id)
      flags.push({ key: `pre:mat:${id}`, kind: 'prebooked', info: true, title: `${it?.name || id}: előjegyzésből kiegészítve`, detail: `A(z) ${owners[0]!.tooth ? owners[0]!.tooth + '-es fog – ' : ''}${tnl(c.types, owners[0]!.typeId)} tételhez rendelve (az anyag a csomagjában szerepel).`, choices: [{ id: 'ok', label: 'Rendben' }] })
    })
  }

  /* 5. pont – kétértelmű mennyiség: „három hatos injekció” = 3 db 6-os / 3,6 */
  const toks = tokenize(c.text)
  const NUMV: Record<string, number> = { egy: 1, ket: 2, harom: 3, negy: 4, ot: 5, hat: 6, het: 7, nyolc: 8, kilenc: 9, tiz: 10 }
  const numW = Object.keys(NUMV)
  toks.forEach((t, i) => {
    if (!/^\d+$/.test(t) && !numW.includes(t)) return
    const ord = ordinalOf(toks[i + 1]); if (!ord) return
    const items = c.catalog.filter(it => anyKw(toks, i + 2, it.kw) || anyKw(toks, i + 3, it.kw))
    const it = items[0]; if (!it) return
    const n = /^\d+$/.test(t) ? Number(t) : NUMV[t]!
    const variants = it.variants || []
    if (variants.includes(ord)) return // a katalógusból egyértelmű: n db az ord-os változatból (nincs ⚠), a napló rögzíti
    const dec = parseFloat(`${n}.${ord}`)
    const unit = (c.decimalUnits || DECIMAL_UNITS).includes(it.unit)
    if (!unit) { flags.push({ key: `qty:${it.id}:${i}`, kind: 'qty', info: true, title: `„${n} ${toks[i + 1]} ${it.name.split(' ')[0]}” – ${n} ${it.unit}`, detail: `A tizedes (${String(dec).replace('.', ',')}) ennél az anyagnál (${it.unit}) nem lehetséges; a „${toks[i + 1]}” változat nincs a katalógusban, ezért ${n} ${it.unit} kerül be.`, choices: [{ id: 'ok', label: 'Rendben' }], data: { item: it.id, qty: n } }); return }
    flags.push({ key: `qty:${it.id}:${i}`, kind: 'qty', title: `„${n} ${toks[i + 1]}” – melyik mennyiség?`, detail: `${it.name}`, suggested: String(n), choices: [{ id: String(n), label: `${n} ${it.unit}, ${ord}-os` }, { id: String(dec), label: `${String(dec).replace('.', ',')} ${it.unit}` }], data: { item: it.id, qty: n, alt: dec, pattern: `qty:${it.id}:${ord}:${n} ${toks[i + 1]}` } })
  })
  // tizedes mennyiség darabos anyagnál nem lehetséges
  Object.entries(c.qty).forEach(([id, q]) => {
    const it = c.catalog.find(i => i.id === id)
    if (!it || Number.isInteger(q) || (c.decimalUnits || DECIMAL_UNITS).includes(it.unit)) return
    flags.push({ key: `qty:dec:${id}`, kind: 'qty', title: `${String(q).replace('.', ',')} ${it.unit} – tizedes mennyiség`, detail: `${it.name}: ez az anyag darabos, tizedes mennyiség nem lehetséges.`, suggested: String(Math.round(q)), choices: [{ id: String(Math.round(q)), label: `${Math.round(q)} ${it.unit} (kerekítve)` }, { id: String(Math.floor(q)), label: `${Math.floor(q)} ${it.unit}` }], data: { item: id } })
  })

  /* 5. pont, 8. alpont – életszerűségi ellenőrzés */
  Object.entries(c.qty).forEach(([id, q]) => {
    const it = c.catalog.find(i => i.id === id); if (!it) return
    const h = c.history.filter(x => x.item === id).map(x => x.qty).sort((a, b) => a - b)
    const ref = h.length >= 3 ? h[h.length - 1]! : (c.pkg[id] || 0)
    if (!ref || q <= Math.max(ref * 3, ref + 8)) return
    flags.push({ key: `life:${id}`, kind: 'life', title: `${q} ${it.unit} ${it.name.split(' ')[0]} – szokatlanul sok`, detail: `${h.length >= 3 ? 'Eddigi legtöbb egy kezelésben' : 'A csomag szerinti mennyiség'}: ${ref} ${it.unit}.`, suggested: String(ref), choices: [{ id: 'ok', label: `Marad: ${q}` }, { id: String(ref), label: `Javítás: ${ref}` }], data: { item: id } })
  })

  /* 15. pont – ellenőrzés a fogtérképpel */
  const state: Record<string, string[]> = JSON.parse(JSON.stringify(c.status || {}))
  c.finalItems.filter(i => i.tooth).forEach(i => {
    const n = i.tooth!, st = state[n] || []
    const bad = (c.compat[i.typeId] || []).filter(s => st.includes(s))
    if (bad.length) {
      const alts = altTeeth(n).filter(a => !(c.compat[i.typeId] || []).some(s => (state[a] || []).includes(s)))
        .sort((a, b) => Number(c.planItems.some(p => p.tooth === b && p.typeId === i.typeId)) - Number(c.planItems.some(p => p.tooth === a && p.typeId === i.typeId))).slice(0, 3)
      flags.push({ key: `chart:${n}:${i.typeId}`, kind: 'chart', title: `A ${n}-os fog a fogtérképen ${STATE_NAME[bad[0]!] || bad[0]} – biztosan a ${n}-os?`, detail: `${tn(c.types, i.typeId)} – a fogtérkép szerint ezen a fogon ez a művelet nem szokásos.`, suggested: String(n),
        choices: [{ id: String(n), label: `${n}-os (marad)` }, ...alts.map(a => ({ id: String(a), label: `${a}-os${c.planItems.some(p => p.tooth === a && p.typeId === i.typeId) ? ' (előjegyezve)' : ''}` }))], data: { tooth: n, typeId: i.typeId } })
    }
    // a most elvégzett művelet utáni állapot (pl. „kihúztam, majd implantátumot tettem be” nem jelez tévesen)
    const after = c.types.find(t => t.id === i.typeId)?.statusAfter
    if (after) state[n] = [after]
  })
  return flags
}
/** egyetlen számjegy eltérés: kvadráns- vagy pozíciócsere (26 ↔ 36 ↔ 46, 36 ↔ 37) */
export function altTeeth(n: number): number[] {
  const q = Math.floor(n / 10), p = n % 10, out: number[] = []
  const primary = q >= 5
  const base = primary ? 4 : 0
  for (let k = 1; k <= 4; k++) { const nq = k + base; if (nq !== q) out.push(nq * 10 + p) }
  ;[p - 1, p + 1].forEach(np => { if (np >= 1 && np <= (primary ? 5 : 8)) out.push(q * 10 + np) })
  return out
}
