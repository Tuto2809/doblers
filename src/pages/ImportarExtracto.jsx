import { useMemo, useState } from 'react'
import { useApp } from '../store'
import { supabase } from '../lib/supabase'
import { Modal } from '../components/ui'
import { leerArchivo } from '../lib/excel'
import { fechaCorta, norm, parseFecha, parseImporte, signed2 } from '../lib/format'

const clave = s => norm(s).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !/^\d+$/.test(w)).slice(0, 3).join(' ')

// Una fila es cabecera si tiene una columna de fecha y otra de importe (o cargo/abono)
function leerCabecera(r) {
  const find = re => r.findIndex(c => re.test(c))
  const fechas = r.map((c, i) => [c, i]).filter(([c]) => /^fecha|^f\. ?(operacion|valor)|^date/.test(c))
  if (!fechas.length) return null
  const principal = fechas.find(([c]) => !/valor/.test(c)) || fechas[0]
  const m = {
    fecha: principal[1],
    concepto: find(/concepto|descripcion|detalle|movimiento|operacion$|beneficiario/),
    importe: find(/^importe|^cantidad|^amount/),
    cargo: find(/^cargo|^debe|^salida/),
    abono: find(/^abono|^haber|^entrada/),
    categoria: find(/^categor/),
    cuenta: find(/^cuenta/),
    etiquetas: find(/^etiqueta/),
    notas: find(/^notas?$|^comentario/),
    estado: find(/^estado|^situacion/),
  }
  if (m.importe < 0 && m.cargo < 0 && m.abono < 0) return null
  return m
}

// Detecta los bloques del extracto (p. ej. «Movimientos pendientes» y «Movimientos»), cada uno con su cabecera
function detectarSecciones(rows) {
  const secs = []
  let titulo = ''
  rows.forEach((row, i) => {
    const r = row.map(c => norm(c))
    const llenas = r.filter(Boolean)
    const cab = leerCabecera(r)
    if (cab) { secs.push({ fila: i, map: cab, titulo, pendiente: /pendiente/.test(titulo) }); titulo = ''; return }
    if (llenas.length === 1 && !parseFecha(row.find(c => String(c).trim()))) titulo = llenas[0]
  })
  if (!secs.length) secs.push({ fila: -1, titulo: '', pendiente: false, map: { fecha: 0, concepto: 1, importe: 2, cargo: -1, abono: -1, categoria: -1, cuenta: -1, etiquetas: -1, notas: -1, estado: -1 } })
  return secs.map((s, k) => ({ ...s, hasta: k + 1 < secs.length ? secs[k + 1].fila : rows.length }))
}

const nombreSeccion = s => (s.pendiente ? 'Pendientes' : s.titulo ? s.titulo.charAt(0).toUpperCase() + s.titulo.slice(1).replace(/\s*-?\d[\d.,]*\s*eur\s*$/i, '') : 'Movimientos')

export default function ImportarExtracto({ onClose }) {
  const { perfilId, categorias, cmap, movimientos, recargar, setToast } = useApp()
  const [hojas, setHojas] = useState(null)
  const [hoja, setHoja] = useState(0)
  const [secs, setSecs] = useState([])
  const [secSel, setSecSel] = useState(0)
  const [cuenta, setCuenta] = useState('')
  const [incluir, setIncluir] = useState({})
  const [catSel, setCatSel] = useState({})
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const [vista, setVista] = useState('nuevos')
  const cuentas = useMemo(() => [...new Set(movimientos.map(m => m.cuenta).filter(Boolean))], [movimientos])

  const prepararHoja = (hs, h) => {
    const s = detectarSecciones(hs[h].rows)
    setSecs(s)
    setSecSel(Math.max(0, s.findIndex(x => !x.pendiente)))
    setIncluir({}); setCatSel({})
  }
  const abrir = async file => {
    setErr(null)
    try {
      const hs = await leerArchivo(file)
      if (!hs.length) throw new Error('El archivo está vacío.')
      setHojas(hs); setHoja(0); prepararHoja(hs, 0)
    } catch (e) { setErr('No he podido leer el archivo: ' + e.message) }
  }

  // Historial: concepto -> categoría más reciente
  const historial = useMemo(() => {
    const h = {}
    for (const m of movimientos) { const k = clave(m.concepto); if (k && m.categoria_id && !h[k]) h[k] = m.categoria_id }
    return h
  }, [movimientos])
  const porNombre = useMemo(() => Object.fromEntries(categorias.map(c => [norm(c.nombre), c.id])), [categorias])

  const filas = useMemo(() => {
    if (!hojas || !secs.length) return []
    const rows = hojas[hoja].rows
    // Movimientos ya apuntados, por importe: se emparejan uno a uno con fecha a ±3 días
    const porImporte = {}
    for (const m of movimientos) (porImporte[Number(m.importe).toFixed(2)] ||= []).push({ m, t: new Date(m.fecha).getTime(), usado: false })
    const emparejar = (fecha, imp) => {
      const lista = porImporte[imp.toFixed(2)]
      if (!lista) return null
      const t = new Date(fecha).getTime()
      let mejor = null
      for (const e of lista) { const d = Math.abs(e.t - t) / 86400000; if (!e.usado && d <= 3 && (!mejor || d < mejor.d)) mejor = { e, d } }
      if (!mejor) return null
      mejor.e.usado = true
      return mejor.e.m
    }
    // Lo anterior a (último movimiento apuntado − 2 días) se da por revisado: así no reaparecen
    // las transferencias internas u otros movimientos que se dejaron fuera a propósito
    const ultima = movimientos.reduce((mx, m) => (m.fecha > mx ? m.fecha : mx), '')
    const corte = ultima ? new Date(new Date(ultima).getTime() - 2 * 86400000).toISOString().slice(0, 10) : ''
    const out = []
    secs.forEach((s, k) => {
      const map = s.map
      rows.slice(s.fila + 1, s.hasta).forEach((r, j) => {
        const fecha = parseFecha(r[map.fecha])
        let imp = map.importe >= 0 ? parseImporte(r[map.importe]) : NaN
        if (isNaN(imp) && (map.cargo >= 0 || map.abono >= 0)) {
          const c = map.cargo >= 0 ? parseImporte(r[map.cargo]) : NaN, a = map.abono >= 0 ? parseImporte(r[map.abono]) : NaN
          imp = isNaN(c) && isNaN(a) ? NaN : (isNaN(a) ? 0 : Math.abs(a)) - (isNaN(c) ? 0 : Math.abs(c))
        }
        const concepto = String(r[map.concepto] ?? '').trim()
        if (!fecha || isNaN(imp) || imp === 0) return
        const pendiente = s.pendiente || (map.estado >= 0 && /pendiente/.test(norm(r[map.estado])))
        const existente = pendiente ? null : emparejar(fecha, imp)
        const dup = !!existente
        const anterior = !dup && !pendiente && !!corte && fecha < corte
        const nomCat = map.categoria >= 0 ? norm(r[map.categoria]) : ''
        const catArchivo = nomCat ? porNombre[nomCat] || '' : ''
        out.push({
          i: `${k}-${j}`, fecha, concepto, importe: Math.round(imp * 100) / 100, dup, pendiente, existente, anterior,
          sug: catArchivo || historial[clave(concepto)] || '', deArchivo: !!catArchivo,
          catNoEncontrada: !!nomCat && !catArchivo && nomCat !== 'sin categoria',
          cuentaF: map.cuenta >= 0 ? String(r[map.cuenta] ?? '').trim() : '',
          tagsF: map.etiquetas >= 0 ? String(r[map.etiquetas] ?? '').split(',').map(t => t.trim()).filter(Boolean) : [],
          notasF: map.notas >= 0 ? String(r[map.notas] ?? '').trim() : '',
        })
      })
    })
    return out
  }, [hojas, hoja, secs, movimientos, historial, porNombre])
  const corte = useMemo(() => { const u = movimientos.reduce((mx, m) => (m.fecha > mx ? m.fecha : mx), ''); return u ? new Date(new Date(u).getTime() - 2 * 86400000).toISOString().slice(0, 10) : '' }, [movimientos])

  // Por defecto: desmarcados los pendientes y los que ya existen
  const incl = f => incluir[f.i] ?? (!f.dup && !f.pendiente && !f.anterior)
  const cat = f => catSel[f.i] ?? f.sug
  const nIncl = filas.filter(incl).length
  const pendientes = filas.filter(f => f.pendiente)
  const grupos = { nuevos: filas.filter(f => !f.dup && !f.pendiente && !f.anterior), existen: filas.filter(f => f.dup), pendientes, anteriores: filas.filter(f => f.anterior), todos: filas }
  const visibles = grupos[vista]
  const marcarVisibles = v => setIncluir(x => ({ ...x, ...Object.fromEntries(visibles.map(f => [f.i, v])) }))
  const marcarPendientes = v => setIncluir(x => ({ ...x, ...Object.fromEntries(pendientes.map(f => [f.i, v])) }))

  const importar = async () => {
    const nuevos = filas.filter(incl).map(f => ({ perfil_id: perfilId, fecha: f.fecha, concepto: f.concepto, importe: f.importe, categoria_id: cat(f) || null, cuenta: f.cuentaF || cuenta.trim(), etiquetas: f.tagsF, notas: f.notasF || null }))
    if (!nuevos.length) return
    setBusy(true)
    for (let i = 0; i < nuevos.length; i += 500) {
      const { error } = await supabase.from('pf_movimientos').insert(nuevos.slice(i, i + 500))
      if (error) { setBusy(false); setErr(error.message); return }
    }
    setBusy(false)
    setToast(`${nuevos.length} movimientos importados`)
    await recargar()
    onClose()
  }

  const sec = secs[secSel]
  const map = sec?.map
  const setMap = m => setSecs(ss => ss.map((s, k) => (k === secSel ? { ...s, map: m } : s)))
  const cabecera = hojas && sec ? (hojas[hoja].rows[sec.fila] || hojas[hoja].rows[0] || []).map((c, i) => [i, String(c || `Columna ${i + 1}`)]) : []
  const selCol = (k, label, opcional) => (
    <label className="field grow" style={{ minWidth: 140 }}>{label}
      <select className="select" value={map[k]} onChange={e => setMap({ ...map, [k]: Number(e.target.value) })}>
        {opcional && <option value={-1}>— No usar —</option>}
        {cabecera.map(([i, t]) => <option key={i} value={i}>{t}</option>)}
      </select>
    </label>
  )

  return (
    <Modal titulo="Importar extracto del banco" onClose={onClose} wide full={!!hojas}>
      {!hojas ? (
        <>
          <p className="muted small" style={{ margin: 0 }}>Sube el extracto en Excel (.xlsx o .xls) o CSV. Detecto las columnas de fecha, concepto e importe (o cargo y abono) y, si las hay, categoría, cuenta, etiquetas y notas. Si el extracto separa los movimientos pendientes, los distingo y los dejo sin marcar, igual que los que ya tienes en la app.</p>
          <label className="btn primary" style={{ height: 52 }}>Elegir archivo<input type="file" accept=".xlsx,.xls,.csv" className="sr" onChange={e => e.target.files[0] && abrir(e.target.files[0])} /></label>
        </>
      ) : (
        <>
          <div className="row wrap" style={{ gap: 10 }}>
            {hojas.length > 1 && <label className="field grow">Hoja<select className="select" value={hoja} onChange={e => { const h = Number(e.target.value); setHoja(h); prepararHoja(hojas, h) }}>{hojas.map((h, i) => <option key={i} value={i}>{h.name}</option>)}</select></label>}
            <label className="field grow" style={{ maxWidth: 420 }}>Cuenta para los nuevos<input className="input" list="pf-cuentas-imp" value={cuenta} onChange={e => setCuenta(e.target.value)} placeholder="Ej.: Cuenta principal" /><datalist id="pf-cuentas-imp">{cuentas.map(c => <option key={c} value={c} />)}</datalist></label>
          </div>

          <details className="card" style={{ padding: '10px 14px' }}>
            <summary className="small bold" style={{ cursor: 'pointer' }}>
              Columnas detectadas{secs.length > 1 ? ` · ${secs.length} bloques: ${secs.map(nombreSeccion).join(' y ')}` : ''} <span className="muted">(ajustar si algo no cuadra)</span>
            </summary>
            <div className="col" style={{ gap: 10, marginTop: 12 }}>
              <div className="row wrap" style={{ gap: 10 }}>
                {secs.length > 1 && <label className="field grow">Bloque<select className="select" value={secSel} onChange={e => setSecSel(Number(e.target.value))}>{secs.map((s, k) => <option key={k} value={k}>{nombreSeccion(s)}</option>)}</select></label>}
                <label className="field grow">Fila de cabecera<input className="input" type="number" min={1} value={sec.fila + 1} onChange={e => setSecs(ss => ss.map((s, k) => (k === secSel ? { ...s, fila: Math.max(0, Number(e.target.value) - 1), map: leerCabecera((hojas[hoja].rows[Math.max(0, Number(e.target.value) - 1)] || []).map(c => norm(c))) || s.map } : s)))} /></label>
                {secs.length > 1 && <label className="row small" style={{ gap: 8, alignSelf: 'flex-end', minHeight: 44 }}><input type="checkbox" checked={sec.pendiente} onChange={() => setSecs(ss => ss.map((s, k) => (k === secSel ? { ...s, pendiente: !s.pendiente } : s)))} style={{ width: 18, height: 18, accentColor: 'var(--accent)' }} />Son movimientos pendientes</label>}
              </div>
              <div className="row wrap" style={{ gap: 10 }}>
                {selCol('fecha', 'Fecha')}{selCol('concepto', 'Concepto')}{selCol('importe', 'Importe', true)}{selCol('cargo', 'Cargo', true)}{selCol('abono', 'Abono', true)}
              </div>
              <div className="row wrap" style={{ gap: 10 }}>
                {selCol('categoria', 'Categoría (opcional)', true)}{selCol('cuenta', 'Cuenta (opcional)', true)}{selCol('etiquetas', 'Etiquetas (opcional)', true)}{selCol('notas', 'Notas (opcional)', true)}{selCol('estado', 'Estado (opcional)', true)}
              </div>
            </div>
          </details>

          <div className="row wrap" style={{ gap: 8 }}>
            {[['nuevos', 'Nuevos'], ['existen', 'Ya en la app'], ['anteriores', 'Anteriores'], ['pendientes', 'Pendientes'], ['todos', 'Todos']].filter(([k]) => (k !== 'pendientes' || pendientes.length) && (k !== 'anteriores' || grupos.anteriores.length)).map(([k, t]) => (
              <button key={k} className="chip" aria-pressed={vista === k} onClick={() => setVista(k)}>{t} · {grupos[k].length}</button>
            ))}
            <span className="grow" />
            {visibles.length > 0 && <><button className="btn sm" onClick={() => marcarVisibles(true)}>Marcar estos</button><button className="btn sm" onClick={() => marcarVisibles(false)}>Desmarcar estos</button></>}
          </div>
          <span className="xs muted">
            {vista === 'nuevos' && `No están en la app. Se importan con la categoría sugerida según el historial (${grupos.nuevos.filter(f => f.sug).length} de ${grupos.nuevos.length} con sugerencia); puedes cambiarla antes de importar.`}
            {vista === 'existen' && 'Coinciden en importe y fecha (±3 días) con un movimiento ya apuntado. Salen sin marcar para no duplicarlos.'}
            {vista === 'anteriores' && `Fechas anteriores al ${fechaCorta(corte)} (dos días antes del último movimiento apuntado) que no coinciden con nada de la app, como las transferencias internas que se dejaron fuera. Salen sin marcar; marca los que sí quieras añadir.`}
            {vista === 'pendientes' && 'Aún no confirmados por el banco: pueden cambiar de importe o desaparecer. Salen sin marcar; cuando se confirmen aparecerán en el próximo extracto.'}
            {vista === 'todos' && `${filas.length} movimientos en el archivo.`}
            {filas.some(f => f.catNoEncontrada) && ` ${filas.filter(f => f.catNoEncontrada).length} traen una categoría que no existe en este perfil y quedan sin categoría.`}
          </span>
          <div className="tablewrap card fill">
            <table className="t" style={{ minWidth: 640 }}>
              <thead><tr><th><span className="sr">Importar</span></th><th>Fecha</th><th>Concepto</th><th>Categoría</th><th className="num">Importe</th></tr></thead>
              <tbody>
                {visibles.map(f => (
                  <tr key={f.i} style={{ opacity: incl(f) ? 1 : 0.5 }}>
                    <td><input type="checkbox" aria-label={'Importar ' + f.concepto} checked={incl(f)} onChange={() => setIncluir({ ...incluir, [f.i]: !incl(f) })} style={{ width: 18, height: 18, accentColor: 'var(--accent)' }} /></td>
                    <td className="nowrap">{fechaCorta(f.fecha)}{f.pendiente && <span className="pill" style={{ marginLeft: 6 }}>Pendiente</span>}{f.dup && <span className="pill warn" style={{ marginLeft: 6 }}>Ya existe</span>}{f.anterior && <span className="pill" style={{ marginLeft: 6 }}>Anterior</span>}</td>
                    <td style={{ maxWidth: 380 }}><span className="ellipsis" style={{ display: 'block' }}>{f.concepto}</span>{f.existente && <span className="xs muted ellipsis" style={{ display: 'block' }}>Ya apuntado: {f.existente.concepto || '(sin concepto)'} · {fechaCorta(f.existente.fecha)}{f.existente.categoria_id && cmap[f.existente.categoria_id] ? ' · ' + cmap[f.existente.categoria_id].nombre : ''}</span>}</td>
                    <td><select className="select" style={{ height: 34, fontSize: 13 }} value={cat(f)} onChange={e => setCatSel({ ...catSel, [f.i]: e.target.value })}>
                      <option value="">Sin categoría</option>
                      {categorias.filter(c => c.activa && c.tipo === (f.importe < 0 ? 'gasto' : 'ingreso')).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                      {cat(f) && cmap[cat(f)] && cmap[cat(f)].tipo !== (f.importe < 0 ? 'gasto' : 'ingreso') && <option value={cat(f)}>{cmap[cat(f)].nombre}</option>}
                    </select></td>
                    <td className={'num bold' + (f.importe > 0 ? ' ok' : '')}>{signed2(f.importe)}</td>
                  </tr>
                ))}
                {!filas.length && <tr><td colSpan={5} className="empty">No encuentro movimientos con esa configuración. Abre «Columnas detectadas» y revisa la fila de cabecera y las columnas.</td></tr>}
                {filas.length > 0 && !visibles.length && <tr><td colSpan={5} className="empty">No hay movimientos en este grupo.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
      {err && <div className="error">{err}</div>}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn" onClick={onClose}>Cancelar</button>
        {hojas && <button className="btn primary" disabled={!nIncl || busy} onClick={importar}>{busy ? 'Importando…' : `Importar ${nIncl} movimientos`}</button>}
      </div>
    </Modal>
  )
}
