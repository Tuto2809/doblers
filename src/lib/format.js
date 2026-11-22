const eur0 = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, minimumFractionDigits: 0, useGrouping: 'always' })
const eur2 = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' })
const num0 = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0, useGrouping: 'always' })

export const fmt0 = n => eur0.format(Math.round(n || 0))
export const fmt2 = n => eur2.format(n || 0)
export const fmtN = n => num0.format(Math.round(n || 0))
export const fmtInput = n => (n || n === 0 ? Number(n).toLocaleString('es-ES', { useGrouping: 'always', maximumFractionDigits: 2 }) : '')
export const signed2 = n => (n > 0 ? '+' : '') + fmt2(n)
export const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0)

export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
export const MES_CORTO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
export const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s)

export const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const fromIso = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
export const fechaCorta = s => { const [y, m, d] = s.split('-'); return `${d}/${m}/${y}` }
export const fechaLarga = s => { const d = fromIso(s); return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }) }
export const hoyIso = () => iso(new Date())

export function norm(s) {
  return String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

export function parseImporte(x) {
  if (typeof x === 'number') return x
  if (x == null) return NaN
  let s = String(x).replace(/[€\s]/g, '').replace(/−/g, '-')
  if (!s) return NaN
  if (s.includes(',') && s.includes('.')) {
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  } else if (s.includes(',')) s = s.replace(',', '.')
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '') // 1.094 = mil noventa y cuatro
  const n = parseFloat(s)
  return isNaN(n) ? NaN : n
}

// Fecha desde Excel (número de serie, Date o texto dd/mm/aaaa o aaaa-mm-dd)
export function parseFecha(x) {
  if (x instanceof Date && !isNaN(x)) return iso(x)
  if (typeof x === 'number' && x > 20000 && x < 80000) {
    const d = new Date(Math.round((x - 25569) * 86400 * 1000))
    return iso(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  }
  const s = String(x ?? '').trim()
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/)
  if (m) { let y = Number(m[3]); if (y < 100) y += 2000; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` }
  return null
}

export const PALETA = ['#3B82F6', '#8B5CF6', '#14B8A6', '#F59E0B', '#EC4899', '#0EA5E9', '#F97316', '#10B981', '#A855F7', '#F43F5E', '#22C55E', '#94A3B8']
