import * as XLSX from 'xlsx'

export async function leerArchivo(file) {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array', cellDates: true, raw: false, codepage: 65001 })
  return wb.SheetNames.map(name => ({
    name,
    rows: XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: '' }).filter(r => r.some(c => String(c).trim() !== '')),
  }))
}

// Contexto de la exportación en curso (formato, perfil, usuario…), lo fija el diálogo de exportar
let ctx = null
export const setExportCtx = c => { ctx = c }
export const fechaHora = d => d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

// sheets: [{ name, rows: [[...cabecera], [...]], widths? }]
export async function descargarExcel(nombre, sheets, opts = {}) {
  const c = ctx; ctx = null
  const base = nombre.replace(/\.xlsx$/i, '')
  if (c?.formato === 'pdf') { const { generarPdf } = await import('./pdf'); return generarPdf(base, sheets, c, opts) }
  const wb = XLSX.utils.book_new()
  const meta = c ? [
    [`Cuentas Claras · ${c.perfil}`],
    [c.contenido],
    [`Exportado el ${fechaHora(c.fecha)} por ${c.usuario}`],
    [],
  ] : []
  if (c) wb.Props = { Title: `Cuentas Claras · ${c.perfil}`, Author: c.usuario, CreatedDate: c.fecha }
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet([...meta, ...s.rows])
    ws['!cols'] = (s.rows[0] || []).map((_, i) => ({ wch: s.widths?.[i] ?? Math.min(40, Math.max(10, ...s.rows.slice(0, 200).map(r => String(r[i] ?? '').length + 2))) }))
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31))
  }
  XLSX.writeFile(wb, base + '.xlsx')
}
