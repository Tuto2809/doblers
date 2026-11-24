import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../store'
import { supabase } from '../lib/supabase'
import { ExportDialog, Icon, Modal, PeriodoSelector, Th, Toolbar, buscar, useOrden } from '../components/ui'
import { enRango, tipoDe } from '../lib/calc'
import { etiqueta, rango } from '../lib/period'
import { cap, fechaCorta, fechaLarga, fmt2, parseImporte, signed2 } from '../lib/format'
import { exportarHojas, exportarTodo, hojaMovimientos } from '../lib/exporters'
import MovimientoForm from './MovimientoForm'
import ImportarExtracto from './ImportarExtracto'

const VACIO = { tipo: 'todos', cats: [], cuentas: [], tags: [], min: '', max: '' }

// Desplegable de filtro (fuera del componente para no perder el foco al escribir)
function Despl({ id, label, n, children, ancho = 320, abierto, setAbierto }) {
  return (
    <div style={{ position: 'relative' }}>
      <button className={'chip' + (n ? ' on' : '')} aria-pressed={!!n} aria-expanded={abierto === id} onClick={() => setAbierto(abierto === id ? null : id)}>{label}{n ? ` · ${n}` : ''} ▾</button>
      {abierto === id && <>
        <div style={{ position: 'fixed', inset: 0, zIndex: 30 }} onClick={() => setAbierto(null)} />
        <div className="card pad col" style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 31, width: ancho, gap: 10, boxShadow: '0 14px 40px rgba(20,25,60,.18)' }}>{children}</div>
      </>}
    </div>
  )
}

export default function Movimientos() {
  const app = useApp()
  const { desktop, perfil, categorias, cmap, movimientos, presupuestos, idxPres, periodo, filtroInicial, setFiltroInicial, setToast, recargar } = app
  const [q, setQ] = useState('')
  const [f, setF] = useState(VACIO)
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false)
  const [editar, setEditar] = useState(null) // movimiento | 'nuevo'
  const [importar, setImportar] = useState(false)
  const [exp, setExp] = useState(false)
  const [sel, setSel] = useState({})
  const [limite, setLimite] = useState(150)
  const [masivo, setMasivo] = useState(null) // 'cat' | 'tag'

  const [desdeResumen, setDesdeResumen] = useState(false)
  useEffect(() => {
    if (filtroInicial) {
      setF({ ...VACIO, cats: filtroInicial.cat ? [filtroInicial.cat] : [] })
      setDesdeResumen(true)
      setFiltroInicial(null)
    }
  }, [filtroInicial, setFiltroInicial])

  const { desde, hasta } = rango(periodo)
  const delPeriodo = useMemo(() => enRango(movimientos, desde, hasta), [movimientos, desde, hasta])
  const cuentas = useMemo(() => [...new Set(movimientos.map(m => m.cuenta).filter(Boolean))].sort(), [movimientos])
  const tags = useMemo(() => [...new Set(movimientos.flatMap(m => m.etiquetas || []))].sort(), [movimientos])

  const filtradas = useMemo(() => {
    const min = parseImporte(f.min), max = parseImporte(f.max)
    let r = delPeriodo.filter(m => {
      const t = tipoDe(m, cmap)
      if (f.tipo === 'gasto' && t !== 'gasto') return false
      if (f.tipo === 'ingreso' && t !== 'ingreso') return false
      if (f.cats.length && !f.cats.includes(m.categoria_id && cmap[m.categoria_id] ? m.categoria_id : '__sin')) return false
      if (f.cuentas.length && !f.cuentas.includes(m.cuenta)) return false
      if (f.tags.length && !f.tags.some(x => (m.etiquetas || []).includes(x))) return false
      const a = Math.abs(m.importe)
      if (!isNaN(min) && a < min) return false
      if (!isNaN(max) && a > max) return false
      return true
    })
    return buscar(r, q, m => [m.concepto, cmap[m.categoria_id]?.nombre || 'sin categoria', m.cuenta, (m.etiquetas || []).join(' '), m.notas, fechaCorta(m.fecha), String(m.importe), fmt2(m.importe)])
  }, [delPeriodo, f, q, cmap])

  const cols = useMemo(() => [
    { key: 'fecha', label: 'Fecha' },
    { key: 'concepto', label: 'Concepto', asc: true },
    { key: 'categoria', label: 'Categoría', get: m => cmap[m.categoria_id]?.nombre || '', asc: true },
    { key: 'etiquetas', label: 'Etiquetas', get: m => (m.etiquetas || []).join(', '), asc: true },
    { key: 'importe', label: 'Importe' },
  ], [cmap])
  const { ordenadas, orden, ordenar, setOrden } = useOrden(filtradas, cols, 'fecha')
  const visibles = ordenadas.slice(0, limite)

  const entradas = filtradas.filter(m => m.importe > 0).reduce((s, m) => s + m.importe, 0)
  const salidas = filtradas.filter(m => m.importe < 0).reduce((s, m) => s + m.importe, 0)
  const nF = (f.tipo !== 'todos') + f.cats.length + f.cuentas.length + f.tags.length + (f.min !== '') + (f.max !== '')
  const selIds = Object.keys(sel).filter(k => sel[k])
  const todosSel = visibles.length > 0 && visibles.every(m => sel[m.id])

  const toggle = (k, v) => setF(x => ({ ...x, [k]: x[k].includes(v) ? x[k].filter(y => y !== v) : [...x[k], v] }))

  const aplicarMasivo = async (campo, valor) => {
    const ids = selIds
    if (!ids.length) return
    let error
    if (campo === 'categoria_id') ({ error } = await supabase.from('pf_movimientos').update({ categoria_id: valor }).in('id', ids))
    else if (campo === 'tag') {
      const nuevos = movimientos.filter(m => ids.includes(m.id)).map(m => ({ id: m.id, etiquetas: [...new Set([...(m.etiquetas || []), valor])] }))
      for (const n of nuevos) { const r = await supabase.from('pf_movimientos').update({ etiquetas: n.etiquetas }).eq('id', n.id); if (r.error) { error = r.error; break } }
    } else if (campo === 'borrar') ({ error } = await supabase.from('pf_movimientos').delete().in('id', ids))
    if (error) { setToast('Error: ' + error.message); return }
    setToast(`${ids.length} movimiento${ids.length > 1 ? 's' : ''} actualizado${ids.length > 1 ? 's' : ''}`)
    setSel({}); setMasivo(null)
    await recargar()
  }

  const exportar = modo => {
    if (modo === 'todo') return exportarTodo(perfil, categorias, movimientos, presupuestos, idxPres, cmap)
    const filtrosTxt = [
      ['Periodo', etiqueta(periodo)], ['Búsqueda', q || '—'], ['Tipo', f.tipo === 'todos' ? 'Todos' : f.tipo === 'gasto' ? 'Gastos' : 'Ingresos'],
      ['Categorías', f.cats.map(c => c === '__sin' ? 'Sin categoría' : cmap[c]?.nombre).join(', ') || 'Todas'], ['Cuentas', f.cuentas.join(', ') || 'Todas'],
      ['Etiquetas', f.tags.join(', ') || 'Todas'], ['Importe mín.', f.min || '—'], ['Importe máx.', f.max || '—'],
      ['Orden', `${cols.find(c => c.key === orden.key)?.label} ${orden.dir > 0 ? 'ascendente' : 'descendente'}`], ['Movimientos', ordenadas.length],
    ]
    exportarHojas(perfil, 'movimientos ' + etiqueta(periodo), [hojaMovimientos(ordenadas, cmap), { name: 'Filtros aplicados', rows: [['Filtro', 'Valor'], ...filtrosTxt] }])
  }

  // Barra de filtros encima de la lista (escritorio): desplegables compactos
  const [abierto, setAbierto] = useState(null)
  const [qCat, setQCat] = useState('')
  const nombreCat = id => (id === '__sin' ? 'Sin categoría' : cmap[id]?.nombre || '?')
  const barraFiltros = (
    <div className="col" style={{ gap: 8 }}>
      <div className="row wrap" style={{ gap: 8, alignItems: 'center' }}>
        {[['todos', 'Todos'], ['gasto', 'Gastos'], ['ingreso', 'Ingresos']].map(([v, t]) => <button key={v} className="chip" aria-pressed={f.tipo === v} onClick={() => setF({ ...f, tipo: v })}>{t}</button>)}
        <span style={{ width: 1, height: 24, background: 'var(--border)', margin: '0 4px' }} />
        <Despl abierto={abierto} setAbierto={setAbierto} id="cats" label="Categorías" n={f.cats.length} ancho={360}>
          <input className="input" autoFocus placeholder="Buscar categoría…" value={qCat} onChange={e => setQCat(e.target.value)} style={{ height: 38 }} />
          <div className="row wrap" style={{ gap: 6, maxHeight: 300, overflow: 'auto' }}>
            {[...categorias.map(c => [c.id, c.nombre]), ['__sin', 'Sin categoría']].filter(([, n]) => !qCat || n.toLowerCase().includes(qCat.toLowerCase())).map(([id, n]) => <button key={id} className="chip" aria-pressed={f.cats.includes(id)} onClick={() => toggle('cats', id)}>{n}</button>)}
          </div>
          {f.cats.length > 0 && <button className="btn sm ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setF({ ...f, cats: [] })}>Quitar categorías</button>}
        </Despl>
        {tags.length > 0 && <Despl abierto={abierto} setAbierto={setAbierto} id="tags" label="Etiquetas" n={f.tags.length}>
          <div className="row wrap" style={{ gap: 6, maxHeight: 300, overflow: 'auto' }}>{tags.map(c => <button key={c} className="chip" aria-pressed={f.tags.includes(c)} onClick={() => toggle('tags', c)}>{c}</button>)}</div>
        </Despl>}
        {cuentas.length > 1 && <Despl abierto={abierto} setAbierto={setAbierto} id="cuentas" label="Cuenta" n={f.cuentas.length}>
          <div className="row wrap" style={{ gap: 6 }}>{cuentas.map(c => <button key={c} className="chip" aria-pressed={f.cuentas.includes(c)} onClick={() => toggle('cuentas', c)}>{c}</button>)}</div>
        </Despl>}
        <Despl abierto={abierto} setAbierto={setAbierto} id="importe" label="Importe" n={(f.min ? 1 : 0) + (f.max ? 1 : 0)} ancho={300}>
          <div className="row" style={{ gap: 8 }}>
            <label className="field grow">Mín. (€)<input className="input" inputMode="decimal" value={f.min} onChange={e => setF({ ...f, min: e.target.value })} placeholder="0" /></label>
            <label className="field grow">Máx. (€)<input className="input" inputMode="decimal" value={f.max} onChange={e => setF({ ...f, max: e.target.value })} placeholder="Sin límite" /></label>
          </div>
        </Despl>
        {nF > 0 && <button className="btn sm ghost" onClick={() => setF(VACIO)}>Limpiar filtros</button>}
      </div>
      {f.cats.length > 0 && (
        <div className="row wrap" style={{ gap: 6 }}>
          {f.cats.map(id => <button key={id} className="pill" style={{ border: 0, cursor: 'pointer' }} onClick={() => toggle('cats', id)} title="Quitar">{nombreCat(id)} ✕</button>)}
        </div>
      )}
    </div>
  )

  const panelFiltros = (
    <div className="col" style={{ gap: 18 }}>
      <div className="col"><span className="xs bold muted upper">Tipo</span>
        <div className="row wrap" style={{ gap: 8 }}>{[['todos', 'Todos'], ['gasto', 'Gastos'], ['ingreso', 'Ingresos']].map(([v, t]) => <button key={v} className="chip" aria-pressed={f.tipo === v} onClick={() => setF({ ...f, tipo: v })}>{t}</button>)}</div>
      </div>
      <div className="col"><span className="xs bold muted upper">Categorías</span>
        <div className="row wrap" style={{ gap: 8 }}>
          {[...categorias.map(c => [c.id, c.nombre]), ['__sin', 'Sin categoría']].map(([id, n]) => <button key={id} className="chip" aria-pressed={f.cats.includes(id)} onClick={() => toggle('cats', id)}>{n}</button>)}
        </div>
      </div>
      {cuentas.length > 0 && <div className="col"><span className="xs bold muted upper">Cuenta</span>
        <div className="row wrap" style={{ gap: 8 }}>{cuentas.map(c => <button key={c} className="chip" aria-pressed={f.cuentas.includes(c)} onClick={() => toggle('cuentas', c)}>{c}</button>)}</div></div>}
      {tags.length > 0 && <div className="col"><span className="xs bold muted upper">Etiquetas</span>
        <div className="row wrap" style={{ gap: 8 }}>{tags.map(c => <button key={c} className="chip" aria-pressed={f.tags.includes(c)} onClick={() => toggle('tags', c)}>{c}</button>)}</div></div>}
      <div className="col"><span className="xs bold muted upper">Importe</span>
        <div className="row" style={{ gap: 8 }}>
          <label className="field grow">Mín. (€)<input className="input" inputMode="decimal" value={f.min} onChange={e => setF({ ...f, min: e.target.value })} placeholder="0" /></label>
          <label className="field grow">Máx. (€)<input className="input" inputMode="decimal" value={f.max} onChange={e => setF({ ...f, max: e.target.value })} placeholder="Sin límite" /></label>
        </div>
      </div>
      <button className="btn" onClick={() => setF(VACIO)}>Limpiar filtros</button>
    </div>
  )

  const catTag = m => {
    const c = cmap[m.categoria_id]
    if (!c) return <span className="pill warn">Sin categoría</span>
    return <span className={'pill' + (c.tipo === 'ingreso' ? ' ok' : '')}>{c.nombre}</span>
  }

  const listaMovil = () => {
    if (!visibles.length) return <div className="empty card">No hay movimientos con estos criterios.</div>
    const porFecha = orden.key === 'fecha'
    const grupos = []
    for (const m of visibles) {
      const k = porFecha ? m.fecha : '_'
      if (!grupos.length || grupos[grupos.length - 1].k !== k) grupos.push({ k, items: [] })
      grupos[grupos.length - 1].items.push(m)
    }
    return grupos.map(g => (
      <section key={g.k} className="col" style={{ gap: 8 }}>
        {porFecha && <div className="group-title sticky-title"><span>{cap(fechaLarga(g.k))}</span><span>{signed2(g.items.reduce((s, m) => s + m.importe, 0))}</span></div>}
        <div className="list">
          {g.items.map(m => {
            const c = cmap[m.categoria_id], inc = m.importe > 0
            return (
              <button key={m.id} className="listrow" onClick={() => setEditar(m)}>
                <span className="avatar" style={{ borderRadius: 12, background: !c ? 'var(--warn-soft)' : inc ? 'var(--ok-soft)' : 'var(--accent-soft)', color: !c ? 'var(--warn)' : inc ? 'var(--ok)' : 'var(--accent)' }}>{c ? c.nombre[0] : '?'}</span>
                <span className="col grow" style={{ gap: 3 }}>
                  <span className="ellipsis bold" style={{ fontSize: 14 }}>{m.concepto || '(sin concepto)'}</span>
                  <span className={'xs ' + (c ? 'muted' : 'warn bold')}>{c ? c.nombre : 'Sin categoría · asignar'}{!porFecha ? ' · ' + fechaCorta(m.fecha) : ''}{m.etiquetas?.length ? ' · ' + m.etiquetas.join(', ') : ''}</span>
                </span>
                <span className={'bold nowrap' + (inc ? ' ok' : '')}>{signed2(m.importe)}</span>
              </button>
            )
          })}
        </div>
      </section>
    ))
  }

  const tabla = (
    <div className="tablewrap">
      <table className="t" style={{ minWidth: desktop ? 0 : 820, tableLayout: 'fixed', width: '100%' }}>
        <colgroup><col style={{ width: 44 }} /><col style={{ width: 118 }} /><col /><col style={{ width: '20%' }} /><col style={{ width: '15%' }} /><col style={{ width: 130 }} /></colgroup>
        <thead><tr>
          <th style={{ width: 36 }}><input type="checkbox" aria-label="Seleccionar todos" checked={todosSel} onChange={() => setSel(todosSel ? {} : Object.fromEntries(visibles.map(m => [m.id, true])))} style={{ width: 18, height: 18, accentColor: 'var(--accent)' }} /></th>
          {cols.map(c => <Th key={c.key} col={c} orden={orden} ordenar={ordenar} className={c.key === 'importe' ? 'num' : ''} />)}
        </tr></thead>
        <tbody>
          {visibles.map(m => (
            <tr key={m.id} className={'clickable' + (sel[m.id] ? ' sel' : '')} onClick={() => setEditar(m)}>
              <td onClick={e => e.stopPropagation()}><input type="checkbox" aria-label={'Seleccionar ' + m.concepto} checked={!!sel[m.id]} onChange={() => setSel(s => ({ ...s, [m.id]: !s[m.id] }))} style={{ width: 18, height: 18, accentColor: 'var(--accent)' }} /></td>
              <td className="muted nowrap">{fechaCorta(m.fecha)}</td>
              <td className="bold"><span className="ellipsis" style={{ display: 'block' }} title={m.concepto}>{m.concepto || '(sin concepto)'}</span></td>
              <td style={{ overflow: 'hidden' }}>{catTag(m)}</td>
              <td className="muted"><span className="ellipsis" style={{ display: 'block' }}>{(m.etiquetas || []).join(', ') || '—'}</span></td>
              <td className={'num bold' + (m.importe > 0 ? ' ok' : '')}>{signed2(m.importe)}</td>
            </tr>
          ))}
          {!visibles.length && <tr><td colSpan={6} className="empty">No hay movimientos con estos criterios.</td></tr>}
        </tbody>
      </table>
    </div>
  )

  return (
    <>
      <header className={desktop ? 'row wrap between' : 'col'} style={{ gap: 14 }}>
        <div className="row between" style={{ gap: 10 }}>
          <div className="col" style={{ gap: 4 }}>
            {desdeResumen && <button className="btn ghost sm" style={{ alignSelf: 'flex-start', padding: '0 6px', marginLeft: -6, height: 30 }} onClick={() => { app.setTab('resumen'); window.scrollTo({ top: 0 }) }}>← Volver al resumen</button>}
            <h1>Movimientos</h1>
          </div>
          {!desktop && <div className="row" style={{ gap: 8 }}>
            <button data-tour="importar" className="btn icon" aria-label="Importar extracto" onClick={() => setImportar(true)}>{Icon.down()}</button>
            <button data-tour="exportar" className="btn icon" aria-label="Exportar" onClick={() => setExp(true)}>{Icon.up()}</button>
          </div>}
        </div>
        <div className="row wrap" style={{ gap: 10 }}>
          <PeriodoSelector />
          {desktop && <>
            <button data-tour="importar" className="btn" onClick={() => setImportar(true)}>{Icon.down()} Importar extracto</button>
            <button data-tour="exportar" className="btn" onClick={() => setExp(true)}>{Icon.up()} Exportar</button>
            <button data-tour="nuevo-mov" className="btn primary" onClick={() => setEditar('nuevo')}>{Icon.plus(18)} Añadir</button>
          </>}
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: desktop ? 'repeat(4, minmax(0,1fr))' : 'repeat(2, minmax(0,1fr))', gap: 10 }}>
        {[['Entradas', '+' + fmt2(entradas), 'ok'], ['Salidas', fmt2(salidas), ''], ['Neto', signed2(entradas + salidas), ''], ['Movimientos', String(filtradas.length), '']].slice(0, desktop ? 4 : 2).map(([l, v, c]) => (
          <div key={l} className="card" style={{ padding: '12px 14px' }}><div className="xs muted">{l}</div><strong className={c} style={{ fontSize: desktop ? 20 : 17 }}>{v}</strong></div>
        ))}
      </div>

      <div className="col" style={{ gap: 16 }}>
        <section data-tour="lista-movs" className={desktop ? 'card pad col' : 'col'} style={{ gap: 12 }}>
          {desktop && barraFiltros}
          <Toolbar onLimpiar={() => setF(VACIO)} ordenInicial={{ key: 'fecha', dir: -1 }} q={q} setQ={setQ} placeholder="Buscar en concepto, categoría, etiqueta, importe…" nFiltros={nF} onFiltros={desktop ? null : () => setFiltrosAbiertos(true)} cols={cols} orden={orden} setOrden={setOrden} />
          {!desktop && (
            <div className="row" style={{ gap: 8, overflowX: 'auto' }}>
              {[['todos', 'Todos'], ['gasto', 'Gastos'], ['ingreso', 'Ingresos']].map(([v, t]) => <button key={v} className="chip" aria-pressed={f.tipo === v && !f.cats.includes('__sin')} onClick={() => setF({ ...f, tipo: v, cats: f.cats.filter(c => c !== '__sin') })}>{t}</button>)}
              <button className="chip" aria-pressed={f.cats.includes('__sin')} onClick={() => toggle('cats', '__sin')}>Sin categoría</button>
            </div>
          )}
          {desktop && selIds.length > 0 && (
            <div className="row wrap" style={{ gap: 8, padding: '8px 10px', background: 'var(--row-sel)', borderRadius: 12 }}>
              <strong className="small">{selIds.length} seleccionados</strong>
              <button className="btn sm" onClick={() => setMasivo('cat')}>Asignar categoría</button>
              <button className="btn sm" onClick={() => setMasivo('tag')}>Etiquetar</button>
              <button className="btn sm danger" onClick={() => { if (confirm(`¿Borrar ${selIds.length} movimientos?`)) aplicarMasivo('borrar') }}>Borrar</button>
              <button className="btn sm ghost" onClick={() => setSel({})}>Quitar selección</button>
            </div>
          )}
          {desktop ? tabla : listaMovil()}
          <div className="row between small muted">
            <span>Mostrando {visibles.length} de {filtradas.length}{filtradas.length !== delPeriodo.length ? ` (${delPeriodo.length} en el periodo)` : ''}</span>
            {ordenadas.length > limite && <button className="btn sm" onClick={() => setLimite(limite + 300)}>Mostrar más</button>}
          </div>
        </section>
      </div>

      {!desktop && <button data-tour="nuevo-mov" className="btn primary" aria-label="Añadir movimiento" onClick={() => setEditar('nuevo')} style={{ position: 'fixed', right: 18, bottom: 96, width: 60, height: 60, borderRadius: 20, zIndex: 14, boxShadow: '0 8px 24px rgba(20,30,120,.3)' }}>{Icon.plus(26)}</button>}

      {filtrosAbiertos && <Modal titulo="Filtrar" onClose={() => setFiltrosAbiertos(false)}>{panelFiltros}<button className="btn primary" style={{ height: 52 }} onClick={() => setFiltrosAbiertos(false)}>Ver {filtradas.length} movimientos</button></Modal>}
      {editar && <MovimientoForm mov={editar === 'nuevo' ? null : editar} cuentas={cuentas} onClose={() => setEditar(null)} />}
      {importar && <ImportarExtracto onClose={() => setImportar(false)} />}
      {exp && <ExportDialog onClose={() => setExp(false)} onExport={exportar}
        descVista={`${etiqueta(periodo)} con los filtros, la búsqueda y el orden actuales · ${filtradas.length} movimientos.`}
        descTodo="Todos los movimientos del perfil, de todos los años y con todas las columnas, más el presupuesto de cada año."
        nota="Con «lo que ves», el archivo lleva una hoja que indica el periodo y los filtros aplicados." />}
      {masivo && <Masivo tipo={masivo} categorias={categorias} tags={tags} n={selIds.length} onClose={() => setMasivo(null)} onOk={v => aplicarMasivo(masivo === 'cat' ? 'categoria_id' : 'tag', v)} />}
    </>
  )
}

function Masivo({ tipo, categorias, tags, n, onClose, onOk }) {
  const [v, setV] = useState(tipo === 'cat' ? '' : '')
  return (
    <Modal titulo={tipo === 'cat' ? `Asignar categoría a ${n}` : `Etiquetar ${n} movimientos`} onClose={onClose} center>
      {tipo === 'cat' ? (
        <label className="field">Categoría<select className="select" value={v} onChange={e => setV(e.target.value)}>
          <option value="">— Elegir —</option>
          <optgroup label="Gastos">{categorias.filter(c => c.tipo === 'gasto' && c.activa).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</optgroup>
          <optgroup label="Ingresos">{categorias.filter(c => c.tipo === 'ingreso' && c.activa).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</optgroup>
        </select></label>
      ) : (
        <label className="field">Etiqueta<input className="input" list="pf-tags" value={v} onChange={e => setV(e.target.value)} placeholder="Ej.: Vacaciones" /><datalist id="pf-tags">{tags.map(t => <option key={t} value={t} />)}</datalist></label>
      )}
      <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={!v.trim()} onClick={() => onOk(v.trim())}>Aplicar</button></div>
    </Modal>
  )
}
