import { mesesEnRango } from './period'

export const catMap = cats => Object.fromEntries(cats.map(c => [c.id, c]))

// 'gasto' | 'ingreso' según la categoría (o el signo si no tiene)
export function tipoDe(m, cmap) {
  const c = m.categoria_id && cmap[m.categoria_id]
  if (c) return c.tipo
  return m.importe < 0 ? 'gasto' : 'ingreso'
}

// Importe en positivo dentro de su tipo (un abono en una categoría de gasto resta gasto)
export const valor = (m, tipo) => (tipo === 'gasto' ? -Number(m.importe) : Number(m.importe))

export function enRango(movs, desde, hasta) {
  return movs.filter(m => m.fecha >= desde && m.fecha <= hasta)
}

export function totales(movs, cmap) {
  let ingresos = 0, gastos = 0
  for (const m of movs) {
    const t = tipoDe(m, cmap)
    if (t === 'gasto') gastos += valor(m, t); else ingresos += valor(m, t)
  }
  return { ingresos, gastos, ahorro: ingresos - gastos }
}

// presupuestos: filas {categoria_id, anyo, mes, importe}
export function indicePresupuesto(pres) {
  const idx = {}
  for (const p of pres) idx[`${p.categoria_id}|${p.anyo}|${p.mes}`] = Number(p.importe)
  return idx
}

export function presupuestoRango(idx, catId, desde, hasta) {
  let s = 0
  for (const { anyo, mes, f } of mesesEnRango(desde, hasta)) s += (idx[`${catId}|${anyo}|${mes}`] || 0) * f
  return s
}

export function porCategoria(movs, cats, idx, desde, hasta, cmap) {
  const real = {}
  let sinCat = { gasto: 0, ingreso: 0, n: 0 }
  for (const m of movs) {
    const t = tipoDe(m, cmap)
    if (m.categoria_id && cmap[m.categoria_id]) real[m.categoria_id] = (real[m.categoria_id] || 0) + valor(m, t)
    else { sinCat[t] += valor(m, t); sinCat.n++ }
  }
  const filas = cats.map(c => {
    const pres = presupuestoRango(idx, c.id, desde, hasta)
    const r = real[c.id] || 0
    return { cat: c, presupuesto: pres, real: r, desviacion: r - pres, pct: pres ? (r / pres) * 100 : (r ? 100 : 0) }
  })
  return { filas, sinCat }
}

// Previsión de gasto a fin de mes (solo si el periodo es el mes en curso)
export function prevision(gastado, desde, hasta) {
  const hoy = new Date()
  const a = new Date(desde), b = new Date(hasta)
  if (hoy < a || hoy > new Date(b.getTime() + 86400000)) return null
  const total = Math.round((b - a) / 86400000) + 1
  const pasados = Math.max(1, Math.round((hoy - a) / 86400000) + 1)
  return (gastado / pasados) * total
}

// Liquidez del año mes a mes. modo: 'mixto' (real en meses pasados, previsto en el futuro,
// y en el mes en curso lo mayor entre real y presupuesto), 'pres' (solo presupuesto) o 'real'
export const ajustesDe = (saldos, anyo) => Array.from({ length: 12 }, (_, i) => saldos[`${anyo}|${i + 1}`])

// ajustes: número (saldo inicial del año) o array de 12 con el saldo inicial fijado a mano de cada mes
export function liquidez(anyo, movs, cats, idx, cmap, ajustes = 0, modo = 'mixto') {
  if (!Array.isArray(ajustes)) ajustes = [ajustes]
  const hoy = new Date(), ha = hoy.getFullYear(), hm = hoy.getMonth()
  const real = Array.from({ length: 12 }, () => ({ ingresos: 0, gastos: 0 }))
  const pre = `${anyo}-`
  for (const m of movs) {
    if (!m.fecha?.startsWith(pre)) continue
    const t = tipoDe(m, cmap), k = Number(m.fecha.slice(5, 7)) - 1
    if (t === 'gasto') real[k].gastos += valor(m, t); else real[k].ingresos += valor(m, t)
  }
  let saldo = Number(ajustes[0]) || 0
  return real.map((r, i) => {
    let pIng = 0, pGas = 0
    for (const c of cats) { const v = idx[`${c.id}|${anyo}|${i + 1}`] || 0; if (c.tipo === 'gasto') pGas += v; else pIng += v }
    const estado = anyo < ha || (anyo === ha && i < hm) ? 'real' : anyo === ha && i === hm ? 'actual' : 'futuro'
    let ingresos, gastos, fuente
    if (modo === 'pres') { ingresos = pIng; gastos = pGas; fuente = 'prev' }
    else if (modo === 'real') { ingresos = r.ingresos; gastos = r.gastos; fuente = 'real' }
    else if (estado === 'real') { ingresos = r.ingresos; gastos = r.gastos; fuente = 'real' }
    else if (estado === 'actual') { ingresos = Math.max(r.ingresos, pIng); gastos = Math.max(r.gastos, pGas); fuente = 'actual' }
    else { ingresos = pIng; gastos = pGas; fuente = 'prev' }
    const calc = saldo
    const aj = i > 0 && modo !== 'pres' ? ajustes[i] : undefined
    const ini = aj !== undefined && aj !== null ? Number(aj) : saldo
    saldo = ini + ingresos - gastos
    return { i, ini, calc, ajustado: aj !== undefined && aj !== null, ingresos, gastos, ahorro: ingresos - gastos, fin: saldo, fuente, real: r, pIng, pGas }
  })
}
