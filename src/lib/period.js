import { iso, fromIso, MESES, cap } from './format'

// Periodo: { tipo: 'mes'|'ano'|'pers', anyo, mes (0-11), desde, hasta }
export function periodoInicial() {
  const d = new Date()
  return { tipo: 'mes', anyo: d.getFullYear(), mes: d.getMonth(), desde: iso(new Date(d.getFullYear(), d.getMonth(), 1)), hasta: iso(d) }
}

export function rango(p) {
  if (p.tipo === 'mes') return { desde: iso(new Date(p.anyo, p.mes, 1)), hasta: iso(new Date(p.anyo, p.mes + 1, 0)) }
  if (p.tipo === 'ano') return { desde: `${p.anyo}-01-01`, hasta: `${p.anyo}-12-31` }
  return { desde: p.desde, hasta: p.hasta }
}

export function etiqueta(p) {
  if (p.tipo === 'mes') return `${cap(MESES[p.mes])} ${p.anyo}`
  if (p.tipo === 'ano') return `Año ${p.anyo}`
  const a = fromIso(p.desde), b = fromIso(p.hasta)
  const f = d => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '')
  return `${f(a)} – ${f(b)} ${b.getFullYear()}`
}

export function mover(p, delta) {
  if (p.tipo === 'mes') { const d = new Date(p.anyo, p.mes + delta, 1); return { ...p, anyo: d.getFullYear(), mes: d.getMonth() } }
  if (p.tipo === 'ano') return { ...p, anyo: p.anyo + delta }
  const a = fromIso(p.desde), b = fromIso(p.hasta)
  const dias = Math.round((b - a) / 86400000) + 1
  const na = new Date(a); na.setDate(na.getDate() + delta * dias)
  const nb = new Date(b); nb.setDate(nb.getDate() + delta * dias)
  return { ...p, desde: iso(na), hasta: iso(nb), anyo: nb.getFullYear() }
}

export function cambiarTipo(p, tipo) {
  if (tipo === 'pers' && p.tipo !== 'pers') { const r = rango(p); return { ...p, tipo, desde: r.desde, hasta: r.hasta } }
  return { ...p, tipo }
}

// Años que abarca el periodo (para cargar presupuestos)
export function anyos(p) {
  const r = rango(p)
  const out = []
  for (let y = Number(r.desde.slice(0, 4)); y <= Number(r.hasta.slice(0, 4)); y++) out.push(y)
  return out
}

// Fracción de cada mes incluida en el rango -> [{anyo, mes(1-12), f}]
export function mesesEnRango(desde, hasta) {
  const a = fromIso(desde), b = fromIso(hasta)
  const out = []
  let y = a.getFullYear(), m = a.getMonth()
  while (y < b.getFullYear() || (y === b.getFullYear() && m <= b.getMonth())) {
    const ini = new Date(y, m, 1), fin = new Date(y, m + 1, 0)
    const s = a > ini ? a : ini, e = b < fin ? b : fin
    const dias = Math.round((e - s) / 86400000) + 1
    out.push({ anyo: y, mes: m + 1, f: dias / fin.getDate() })
    m++; if (m > 11) { m = 0; y++ }
  }
  return out
}

export const ATAJOS = () => {
  const d = new Date(), y = d.getFullYear(), m = d.getMonth()
  const r = (a, b) => ({ desde: iso(a), hasta: iso(b) })
  const q = Math.floor(m / 3) * 3
  return [
    ['Este mes', r(new Date(y, m, 1), new Date(y, m + 1, 0))],
    ['Mes anterior', r(new Date(y, m - 1, 1), new Date(y, m, 0))],
    ['Últimos 3 meses', r(new Date(y, m - 2, 1), new Date(y, m + 1, 0))],
    ['Trimestre actual', r(new Date(y, q, 1), new Date(y, q + 3, 0))],
    ['Año en curso', r(new Date(y, 0, 1), new Date(y, 11, 31))],
    ['Año anterior', r(new Date(y - 1, 0, 1), new Date(y - 1, 11, 31))],
  ]
}
