// A Whisper szakszó-listája (initial_prompt, spec v2.3, 7. pont): automatikusan áll elő, prioritás szerint; ha túl hosszú, az alapszótár ritkább elemei maradnak ki.
import { BASE_ROWS } from './base'
import type { Item, TreatmentType } from '../types'

export interface PromptCtx {
  /** az előjegyzett tételek típusai (legnagyobb prioritás) */
  plannedTypes: string[]
  types: TreatmentType[]
  items: Item[]
  learned: string[]
  max?: number
  /** v2.4 12. pont C2: a szakszó-szöveg formája – rövid, természetes mondatok (alap), a régi vesszős lista, vagy nincs szakszó-szöveg */
  style?: PromptStyle
  /** v2.4 15. pont: a személyes rövidítések nevei */
  macros?: string[]
}
export type PromptStyle = 'mondat' | 'lista' | 'nincs'
export const PROMPT_STYLES: Record<PromptStyle, string> = { mondat: 'rövid mondatos (alap)', lista: 'vesszős lista (v2.3)', nincs: 'nincs szakszó-szöveg' }
const plain = (s: string) => s.replace(/\s*\([^)]*\)/g, '').replace(/\s+\d[\d,.]*\s*(%|mm|ml|g)?.*$/i, '').trim()
export function buildPrompt(c: PromptCtx): string {
  if (c.style === 'nincs') return ''
  if (c.style !== 'lista') return buildSentencePrompt(c)
  const max = c.max ?? 520
  const out: string[] = [], seen = new Set<string>()
  const add = (w: string) => { const t = w.trim(); const k = t.toLowerCase(); if (t && !seen.has(k)) { seen.add(k); out.push(t) } }
  c.plannedTypes.forEach(id => { const t = c.types.find(x => x.id === id); if (t) { add(t.name.split(',')[0]!); t.mats.forEach(m => add(plain(c.items.find(i => i.id === m.item)?.name || ''))) } })
  c.learned.forEach(add)
  c.items.forEach(i => add(plain(i.name).split(' ').slice(0, 3).join(' ')))
  c.types.forEach(t => add(t.name.split(',')[0]!))
  ;['MO', 'MOD', 'DO', 'okkluzális', 'meziális', 'disztális', 'vesztibuláris', 'linguális', 'kofferdam', 'guttapercha'].forEach(add)
  BASE_ROWS.filter(r => ['Művelet', 'Anyag', 'Fogállapot', 'Felszín'].includes(r.cat)).forEach(r => add(r.official.replace(/ – .*$/, '')))
  const head = 'Fogászati kezelés diktálása. Fogszámok FDI szerint, pl. 36-os, 25-ös. Előforduló kifejezések: '
  let body = ''
  for (const w of out) { if ((head + body + w + '.').length > max) break; body += (body ? ', ' : '') + w }
  return head + body + '.'
}

const low = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)
/** v2.4 12. pont C2: rövid, természetes magyar mondatok a diktálás stílusában (a Whisper a vesszős felsorolást hajlamos utánozni – a B-009 egyik kódgyanúja) */
export function buildSentencePrompt(c: PromptCtx): string {
  const max = c.max ?? 420
  const out: string[] = ['Fogorvosi kezelés diktálása.', 'Fog harminchat, a 36-os fogon meziális és okkluzális kompozit tömés.', 'Érzéstelenítés két ampullával, kérek öt tampont.']
  const seen = new Set<string>()
  const add = (s: string) => { const k = s.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(s) } }
  c.plannedTypes.forEach(id => { const t = c.types.find(x => x.id === id); if (t) add(`Ma ${low(t.name.split(',')[0]!.replace(/\s*\(.*?\)/g, ''))} készül.`) })
  ;(c.macros || []).slice(0, 4).forEach(m => add(`${m.charAt(0).toUpperCase() + m.slice(1)}.`))
  c.learned.slice(0, 6).forEach(w => add(`${w.charAt(0).toUpperCase() + w.slice(1)}.`))
  ;['Jobb alsó hatos, gyökérkezelés, guttapercha csúcs.', 'Fogkő-eltávolítás, polírozás, polírpaszta.', 'Bal felső négyes, MOD tömés, kofferdam.'].forEach(add)
  let txt = ''
  for (const s of out) { if ((txt + ' ' + s).trim().length > max) break; txt = (txt + ' ' + s).trim() }
  return txt
}

/** a demóban használt modellek (a Worker alapértelmezései; a modellek kiválasztása a Cloudflare Workers AI kínálatából, kulcs nélkül) */
export const WHISPER_MODEL = '@cf/openai/whisper-large-v3-turbo'
export const LLM_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
export const AI_MODEL_LABEL = `Cloudflare Workers AI – ${LLM_MODEL}`
