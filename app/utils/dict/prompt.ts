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
}
const plain = (s: string) => s.replace(/\s*\([^)]*\)/g, '').replace(/\s+\d[\d,.]*\s*(%|mm|ml|g)?.*$/i, '').trim()
export function buildPrompt(c: PromptCtx): string {
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

/** a demóban használt modellek (a Worker alapértelmezései; a modellek kiválasztása a Cloudflare Workers AI kínálatából, kulcs nélkül) */
export const WHISPER_MODEL = '@cf/openai/whisper-large-v3-turbo'
export const LLM_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
export const AI_MODEL_LABEL = `Cloudflare Workers AI – ${LLM_MODEL}`
