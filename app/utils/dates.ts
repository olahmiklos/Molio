// Dátum- és szövegsegédek (helyi idő szerinti YYYY-MM-DD formátum)

export const pad = (n: number) => String(n).padStart(2, '0')
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const fromYmd = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y!, m! - 1, d!) }
export const addDays = (s: string, n: number) => { const d = fromYmd(s); d.setDate(d.getDate() + n); return ymd(d) }
/** b - a napokban */
export const dayDiff = (a: string, b: string) => Math.round((fromYmd(b).getTime() - fromYmd(a).getTime()) / 86400000)
/** hétfő = 1 … vasárnap = 7 */
export const dow = (s: string) => { const g = fromYmd(s).getDay(); return g === 0 ? 7 : g }
export const today = () => ymd(new Date())
export const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes() }
export const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h! * 60 + m! }
export const fromMin = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`

export const MONTHS = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december']
export const MON_S = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.']
export const DAYS = ['hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat', 'vasárnap']

export const fmtLong = (s: string) => { const d = fromYmd(s); return `${d.getFullYear()}. ${MONTHS[d.getMonth()]} ${d.getDate()}., ${DAYS[dow(s) - 1]}` }
export const fmtDate = (s: string) => { const d = fromYmd(s); return `${d.getFullYear()}. ${MON_S[d.getMonth()]} ${d.getDate()}.` }
export const fmtShort = (s: string) => { const d = fromYmd(s); return `${MON_S[d.getMonth()]} ${d.getDate()}.` }
export const fmtBirth = (s: string) => (s ? s.replace(/-/g, '. ') + '.' : '')
export const fmtDT = (d: Date) => `${fmtShort(ymd(d))} ${pad(d.getHours())}:${pad(d.getMinutes())}`
export const ageOn = (birth: string, at: string) => (birth ? Math.floor(dayDiff(birth, at) / 365.25) : null)

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
/** kisbetűs, ékezet nélküli alak */
export const norm = (s: unknown) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
export const fmtNum = (n: number) => (Math.round(n * 10) / 10).toLocaleString('hu-HU')
export const fmtFt = (n: number) => Math.round(n || 0).toLocaleString('hu-HU') + ' Ft'
export const fmtSize = (b: number) => (b >= 1048576 ? fmtNum(b / 1048576) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' kB')
export const shortName = (n: string) => { const p = String(n || '').trim().split(/\s+/); return p.length > 1 ? p[0] + ' ' + p[1]![0] + '.' : p[0] || '' }
export const parseKw = (s: string) => s.split(',').map(x => norm(x).trim()).filter(Boolean)
export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
