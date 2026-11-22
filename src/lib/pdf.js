import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { fmt0, fmt2 } from './format'
import { fechaHora } from './excel'

const ACCENT = [59, 76, 245], INK = [22, 25, 34], MUTED = [104, 112, 128], WARN = [180, 65, 11], ZEBRA = [245, 246, 251], LINE = [226, 229, 236]
// Las fuentes estándar del PDF no tienen algunos signos tipográficos
const limpio = v => String(v ?? '').replace(/[  ]/g, ' ').replace(/−/g, '-').replace(/[‘’]/g, "'").replace(/[“”«»]/g, '"').replace(/…/g, '...')

function celda(v, cab) {
  if (typeof v === 'number') {
    if (/%/.test(cab)) return `${Math.round(v)} %`
    if (/^(año|anyo|mes)$/i.test(cab)) return String(v)
    return Number.isInteger(v) ? fmt0(v) : fmt2(v)
  }
  if (v instanceof Date) return v.toLocaleDateString('es-ES')
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) { const [y, m, d] = v.split('-'); return `${d}/${m}/${y}` }
  return v ?? ''
}

export function generarPdf(nombre, sheets, c, opts = {}) {
  if (opts.unaPagina) return pdfUnaPagina(nombre, sheets, c)
  const maxCols = Math.max(...sheets.map(s => (s.rows[0] || []).length))
  const doc = new jsPDF({ orientation: maxCols > 7 ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 14
  doc.setProperties({ title: `Cuentas Claras · ${c.perfil}`, author: c.usuario, creator: 'Cuentas Claras' })

  const cabecera = () => {
    doc.setFillColor(...ACCENT); doc.rect(0, 0, W, 20, 'F')
    doc.setFillColor(255, 255, 255); doc.roundedRect(M, 5, 10, 10, 2.2, 2.2, 'F')
    doc.setTextColor(...ACCENT); doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text('€', M + 5, 11.9, { align: 'center' })
    doc.setTextColor(255, 255, 255); doc.setFontSize(13); doc.text('Cuentas Claras', M + 14, 11.8)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.text(limpio(c.perfil), W - M, 11.8, { align: 'right' })
  }
  const pie = (n, total) => {
    doc.setDrawColor(...LINE); doc.setLineWidth(0.3); doc.line(M, H - 11, W - M, H - 11)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...MUTED)
    doc.text(limpio(`Cuentas Claras · ${c.perfil} · Exportado el ${fechaHora(c.fecha)} por ${c.usuario}`), M, H - 6.5)
    doc.text(`Página ${n} de ${total}`, W - M, H - 6.5, { align: 'right' })
  }

  // Portada de la primera página: título y ficha de la exportación
  cabecera()
  let y = 31
  doc.setTextColor(...INK); doc.setFont('helvetica', 'bold'); doc.setFontSize(17)
  doc.text(limpio(c.titulo || nombre.replace(/^Cuentas Claras - /, '').replace(/ - \d{4}-\d{2}-\d{2}$/, '')), M, y)
  y += 5
  const ficha = [['Presupuesto', c.perfil], ['Contenido', c.contenido], ['Exportado el', fechaHora(c.fecha)], ['Exportado por', c.usuario]]
  doc.setFillColor(...ZEBRA); doc.setDrawColor(...LINE)
  const fichaLineas = ficha.map(([k, v]) => [k, doc.splitTextToSize(limpio(v), W - 2 * M - 40)])
  const altoFicha = 6 + fichaLineas.reduce((a, [, l]) => a + l.length * 4.4 + 1.2, 0)
  doc.roundedRect(M, y, W - 2 * M, altoFicha, 2.5, 2.5, 'FD')
  let fy = y + 6.5
  for (const [k, l] of fichaLineas) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...MUTED); doc.text(k.toUpperCase(), M + 5, fy)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...INK); doc.text(l, M + 38, fy)
    fy += l.length * 4.4 + 1.2
  }
  y += altoFicha + 9

  sheets.forEach((s, si) => {
    const [cab = [], ...cuerpo] = s.rows
    if (!cab.length) return
    if (y > H - 45) { doc.addPage(); cabecera(); y = 31 }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...INK); doc.text(limpio(s.name), M, y)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...MUTED); doc.text(`${cuerpo.length} fila${cuerpo.length === 1 ? '' : 's'}`, W - M, y, { align: 'right' })
    const numCol = cab.map((h, i) => cuerpo.slice(0, 50).some(r => typeof r[i] === 'number'))
    autoTable(doc, {
      startY: y + 3,
      margin: { left: M, right: M, top: 28, bottom: 16 },
      head: [cab.map(limpio)],
      body: cuerpo.map(r => cab.map((h, i) => limpio(celda(r[i], String(h))))),
      theme: 'plain',
      styles: { font: 'helvetica', fontSize: cab.length > 10 ? 7 : 8.5, cellPadding: { top: 2, bottom: 2, left: 2, right: 2 }, textColor: INK, overflow: 'linebreak', lineColor: LINE },
      headStyles: { fillColor: ACCENT, textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: ZEBRA },
      columnStyles: Object.fromEntries(numCol.map((n, i) => [i, n ? { halign: 'right' } : {}])),
      didParseCell: d => {
        if (d.section === 'head' && numCol[d.column.index]) d.cell.styles.halign = 'right'
        if (d.section === 'body' && typeof cuerpo[d.row.index]?.[d.column.index] === 'number' && cuerpo[d.row.index][d.column.index] < 0) d.cell.styles.textColor = WARN
        if (d.section === 'body' && /^(total|balance|saldo final)/i.test(String(cuerpo[d.row.index]?.[0] ?? ''))) d.cell.styles.fontStyle = 'bold'
      },
      didDrawPage: () => { if (doc.getNumberOfPages() > 1 || si > 0) cabecera() },
    })
    y = doc.lastAutoTable.finalY + 10
  })

  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) { doc.setPage(i); cabecera(); pie(i, total) }
  doc.save(nombre + '.pdf')
}

// Versión compacta: A4 horizontal, todo en una página (las tablas se ponen lado a lado si caben y la letra se ajusta)
function pdfUnaPagina(nombre, sheets, c) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 10
  doc.setProperties({ title: `Cuentas Claras · ${c.perfil}`, author: c.usuario, creator: 'Cuentas Claras' })
  // Cabecera compacta
  doc.setFillColor(...ACCENT); doc.rect(0, 0, W, 14, 'F')
  doc.setFillColor(255, 255, 255); doc.roundedRect(M, 3.5, 7, 7, 1.6, 1.6, 'F')
  doc.setTextColor(...ACCENT); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text('€', M + 3.5, 8.4, { align: 'center' })
  doc.setTextColor(255, 255, 255); doc.setFontSize(11); doc.text('Cuentas Claras', M + 10, 8.6)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.text(limpio(c.perfil), W - M, 8.6, { align: 'right' })
  doc.setTextColor(...INK); doc.setFont('helvetica', 'bold'); doc.setFontSize(13)
  doc.text(limpio(c.titulo || nombre.replace(/^Cuentas Claras - /, '').replace(/ - \d{4}-\d{2}-\d{2}$/, '')), M, 21.5)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...MUTED)
  doc.text(doc.splitTextToSize(limpio(`${c.contenido}  ·  Exportado el ${fechaHora(c.fecha)} por ${c.usuario}`), W - 2 * M)[0], M, 26)
  const top = 30, bottom = H - 9
  doc.setDrawColor(...LINE); doc.setLineWidth(0.3); doc.line(M, H - 7, W - M, H - 7)
  doc.setFontSize(6.5); doc.text(limpio(`Cuentas Claras · ${c.perfil} · Exportado el ${fechaHora(c.fecha)} por ${c.usuario}`), M, H - 3.8)

  const tablas = sheets.filter(s => (s.rows[0] || []).length)
  // Todas las tablas lado a lado. Se mide el texto a 8 pt para repartir el ancho y elegir la letra que hace que todo quepa
  const GAP = 6, util = W - 2 * M - (tablas.length - 1) * GAP
  const datos = tablas.map(t => { const [cab, ...cuerpo] = t.rows; return { t, cab, cuerpo, txt: cuerpo.map(r => cab.map((h, i) => limpio(typeof r[i] === 'number' && !/%/.test(h) ? fmt0(r[i]) : celda(r[i], String(h))))) } })
  doc.setFontSize(8)
  for (const d of datos) {
    d.anchos = d.cab.map((h, i) => { doc.setFont('helvetica', 'bold'); let m = doc.getTextWidth(limpio(h)); doc.setFont('helvetica', 'normal'); for (const r of d.txt) m = Math.max(m, doc.getTextWidth(r[i])); return m + 2.4 })
    d.necesario = d.anchos.reduce((x, v) => x + v, 0)
  }
  const sumaNec = datos.reduce((x, d) => x + d.necesario, 0)
  const fsAncho = 8 * Math.min(1.06, util / sumaNec)
  let xx = M
  const bloques = datos.map(d => { const w = util * d.necesario / sumaNec; const b = { ...d, x: xx, w, lado: true }; xx += w + GAP; return b })
  const filasTot = Math.max(...bloques.map(b => b.t.rows.length))
  const titulos = 7
  const hFila = Math.max(2.4, Math.min(6, (bottom - top - titulos) / filasTot))
  const fs = Math.max(4.5, Math.min(8.5, fsAncho, (hFila - 1.2) / 0.3528 / 1.15))
  const pad = Math.max(0.35, (hFila - fs * 0.3528 * 1.15) / 2)
  let y = top
  for (const b of bloques) {
    const { cab, cuerpo } = b
    const k = fs / 8
    const y0 = b.lado ? top : y
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...INK); doc.text(limpio(b.t.name), b.x, y0 + 3)
    const numCol = cab.map((h, i) => cuerpo.slice(0, 50).some(r => typeof r[i] === 'number'))
    autoTable(doc, {
      startY: y0 + 5, margin: { left: b.x, right: W - b.x - b.w, top, bottom: H - bottom }, tableWidth: b.w,
      head: [cab.map(limpio)], body: b.txt,
      theme: 'plain', pageBreak: 'avoid', rowPageBreak: 'avoid',
      styles: { font: 'helvetica', fontSize: fs, cellPadding: { top: pad, bottom: pad, left: 1.2 * k, right: 1.2 * k }, textColor: INK, overflow: 'linebreak', minCellHeight: 0 },
      headStyles: { fillColor: ACCENT, textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: ZEBRA },
      columnStyles: Object.fromEntries(numCol.map((n, i) => [i, { cellWidth: b.anchos[i] * (b.w / b.necesario), ...(n ? { halign: 'right' } : {}) }])),
      didParseCell: d => {
        if (d.section === 'head' && numCol[d.column.index]) d.cell.styles.halign = 'right'
        if (d.section === 'body' && typeof cuerpo[d.row.index]?.[d.column.index] === 'number' && cuerpo[d.row.index][d.column.index] < 0) d.cell.styles.textColor = WARN
      },
    })
    if (!b.lado) y = doc.lastAutoTable.finalY + 4
  }
  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) { doc.setPage(i); doc.setFontSize(6.5); doc.setTextColor(...MUTED); doc.text(`Página ${i} de ${total}`, W - M, H - 3.8, { align: 'right' }) }
  doc.save(nombre + '.pdf')
}
