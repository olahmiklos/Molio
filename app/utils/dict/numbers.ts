// Tizedes és tört mennyiségek (spec v2.3, 4. pont: SZ-106…109): „három egész hat”, „három vessző hat”, „másfél”, „két és fél”, „fél”.
// A tokenizáló a pontot és a vesszőt mondathatárnak veszi, ezért a tizedes szám betűkódolt tokenként utazik (qx<egész>y<tört>, a=0 … j=9); a parser numVal() visszafejti.
const W: Record<string, number> = { nulla: 0, egy: 1, egyet: 1, ket: 2, ketto: 2, kettot: 2, harom: 3, harmat: 3, negy: 4, negyet: 4, ot: 5, otot: 5, hat: 6, hatot: 6, het: 7, hetet: 7, nyolc: 8, nyolcat: 8, kilenc: 9, kilencet: 9, tiz: 10 }
const L = 'abcdefghij'
const enc = (n: number) => String(n).split('').map(d => L[Number(d)]).join('')
const dec = (s: string) => Number(s.split('').map(c => (c === 'f' ? 5 : L.indexOf(c))).join(''))
export const DEC_RE = /^qx([a-j]+)y([a-jf]+)$/
export function decodeDecimal(tok: string): number | null { const m = DEC_RE.exec(tok); return m ? dec(m[1]!) + dec(m[2]!) / Math.pow(10, m[2]!.length) : null }
const val = (w: string) => (/^\d+$/.test(w) ? Number(w) : W[w])
const NUMS = '\\d+|' + Object.keys(W).sort((a, b) => b.length - a.length).join('|')
/** a szöveg (ékezet nélküli, kisbetűs) tizedes / tört mennyiségeinek egységesítése */
export function fuseNumbers(t: string): string {
  t = t.replace(new RegExp(`(?<![a-z0-9])(${NUMS})\\s+(?:egesz|vesszo)\\s+(${NUMS})(?:\\s+tized)?(?![a-z0-9])`, 'g'), (m, a: string, b: string) => {
    const x = val(a), y = val(b); return x === undefined || y === undefined ? m : ` qx${enc(x)}y${enc(y)} `
  })
  t = t.replace(new RegExp(`(?<![a-z0-9])(${NUMS})\\s+es\\s+fel(?![a-z0-9])`, 'g'), (m, a: string) => { const x = val(a); return x === undefined ? m : ` qx${enc(x)}yf ` })
  t = t.replace(/(?<![a-z0-9])masfel(?![a-z0-9])/g, ' qxbyf ')
  t = t.replace(/(?<![a-z0-9])fel(?![a-z0-9])(?!\s+ev)/g, ' qxayf ')
  return t
}
