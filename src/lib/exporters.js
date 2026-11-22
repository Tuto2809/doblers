import { descargarExcel } from './excel'
import { tipoDe } from './calc'
import { MES_CORTO, hoyIso } from './format'

const nombreArchivo = (perfil, que) => `Cuentas Claras - ${perfil?.tipo === 'personal' ? 'Personal' : perfil?.nombre || ''} - ${que} - ${hoyIso()}`

export function hojaMovimientos(movs, cmap) {
  return {
    name: 'Movimientos',
    rows: [['Fecha', 'Concepto', 'Categoría', 'Tipo', 'Importe', 'Cuenta', 'Etiquetas', 'Notas'],
      ...movs.map(m => [m.fecha, m.concepto, cmap[m.categoria_id]?.nombre || 'Sin categoría', tipoDe(m, cmap) === 'gasto' ? 'Gasto' : 'Ingreso', Number(m.importe), m.cuenta || '', (m.etiquetas || []).join(', '), m.notas || ''])],
  }
}

export function hojaCategorias(cats) {
  return { name: 'Categorías', rows: [['Categoría', 'Tipo', 'Color', 'Activa'], ...cats.map(c => [c.nombre, c.tipo === 'gasto' ? 'Gasto' : 'Ingreso', c.color, c.activa ? 'Sí' : 'No'])] }
}

// Formato compatible con la importación: Categoría, Tipo, Ene..Dic, Anual
export function hojaPresupuesto(anyo, cats, idx, nombre) {
  const rows = [['Categoría', 'Tipo', ...MES_CORTO, 'Anual']]
  for (const c of cats) {
    const meses = MES_CORTO.map((_, i) => idx[`${c.id}|${anyo}|${i + 1}`] || 0)
    rows.push([c.nombre, c.tipo === 'gasto' ? 'Gasto' : 'Ingreso', ...meses, meses.reduce((a, b) => a + b, 0)])
  }
  return { name: nombre || `Presupuesto ${anyo}`, rows }
}

export function hojaReal(anyo, cats, movs, cmap, nombre) {
  const acc = {}
  for (const m of movs) {
    if (!m.fecha.startsWith(String(anyo)) || !m.categoria_id) continue
    const t = tipoDe(m, cmap), k = m.categoria_id + '|' + Number(m.fecha.slice(5, 7))
    acc[k] = (acc[k] || 0) + (t === 'gasto' ? -m.importe : m.importe)
  }
  const rows = [['Categoría', 'Tipo', ...MES_CORTO, 'Total']]
  for (const c of cats) {
    const meses = MES_CORTO.map((_, i) => Math.round((acc[`${c.id}|${i + 1}`] || 0) * 100) / 100)
    rows.push([c.nombre, c.tipo === 'gasto' ? 'Gasto' : 'Ingreso', ...meses, meses.reduce((a, b) => a + b, 0)])
  }
  return { name: nombre || `Real ${anyo}`, rows }
}

export function exportarTodo(perfil, cats, movs, presupuestos, idx, cmap) {
  const anyos = [...new Set([...presupuestos.map(p => p.anyo), ...movs.map(m => Number(m.fecha.slice(0, 4)))])].sort()
  const sheets = [hojaMovimientos(movs, cmap), hojaCategorias(cats)]
  for (const y of anyos) {
    sheets.push(hojaPresupuesto(y, cats, idx))
    sheets.push(hojaReal(y, cats, movs, cmap))
  }
  descargarExcel(nombreArchivo(perfil, 'completo'), sheets)
}

export function exportarHojas(perfil, que, sheets, opts) {
  descargarExcel(nombreArchivo(perfil, que), sheets, opts)
}
