import { setExportCtx } from '../lib/excel'
import { useEffect, useMemo, useState, useRef } from 'react'
import { useApp } from '../store'
import { ATAJOS, cambiarTipo, etiqueta, mover, rango } from '../lib/period'
import { MES_CORTO, iso, norm } from '../lib/format'

const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }
export const Icon = {
  resumen: (s = 22) => <svg width={s} height={s} viewBox="0 0 24 24" {...P}><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></svg>,
  movs: (s = 22) => <svg width={s} height={s} viewBox="0 0 24 24" {...P}><path d="M7 7h13M16 3l4 4-4 4M17 17H4M8 13l-4 4 4 4" /></svg>,
  pres: (s = 22) => <svg width={s} height={s} viewBox="0 0 24 24" {...P}><path d="M21 12A9 9 0 1 1 12 3v9z" /><path d="M15 3.5A9 9 0 0 1 20.5 9H15z" /></svg>,
  ajustes: (s = 22) => <svg width={s} height={s} viewBox="0 0 24 24" {...P}><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></svg>,
  admin: (s = 22) => <svg width={s} height={s} viewBox="0 0 24 24" {...P}><path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z" /><path d="M9 12l2 2 4-4" /></svg>,
  menu: (s = 20) => <svg width={s} height={s} viewBox="0 0 24 24" {...P}><path d="M4 7h16M4 12h16M4 17h16" /></svg>,
  search: (s = 18) => <svg width={s} height={s} viewBox="0 0 24 24" {...P}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>,
  filter: (s = 18) => <svg width={s} height={s} viewBox="0 0 24 24" {...P}><path d="M3 5h18l-7 8v6l-4 2v-8z" /></svg>,
  sort: (s = 16) => <svg width={s} height={s} viewBox="0 0 24 24" {...P}><path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4" /></svg>,
  plus: (s = 20) => <svg width={s} height={s} viewBox="0 0 24 24" {...P} strokeWidth={2.4}><path d="M12 5v14M5 12h14" /></svg>,
  up: (s = 18) => <svg width={s} height={s} viewBox="0 0 24 24" {...P}><path d="M12 15V3M7 8l5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" /></svg>,
  down: (s = 18) => <svg width={s} height={s} viewBox="0 0 24 24" {...P}><path d="M12 3v12M7 10l5 5 5-5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" /></svg>,
  close: (s = 18) => <svg width={s} height={s} viewBox="0 0 24 24" {...P} strokeWidth={2.2}><path d="M6 6l12 12M18 6L6 18" /></svg>,
  left: (s = 20) => <svg width={s} height={s} viewBox="0 0 24 24" {...P}><path d="M15 6l-6 6 6 6" /></svg>,
  right: (s = 20) => <svg width={s} height={s} viewBox="0 0 24 24" {...P}><path d="M9 6l6 6-6 6" /></svg>,
  chevron: (s = 16) => <svg width={s} height={s} viewBox="0 0 24 24" {...P}><path d="M6 9l6 6 6-6" /></svg>,
  alert: (s = 18) => <svg width={s} height={s} viewBox="0 0 24 24" {...P}><path d="M12 8v5M12 16.5v.5" /><circle cx="12" cy="12" r="9" /></svg>,
  check: (s = 18) => <svg width={s} height={s} viewBox="0 0 24 24" {...P} strokeWidth={2.2}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>,
  undo: (s = 18) => <svg width={s} height={s} viewBox="0 0 24 24" {...P}><path d="M9 14L4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>,
  edit: (s = 18) => <svg width={s} height={s} viewBox="0 0 24 24" {...P}><path d="M4 20h4L19 9l-4-4L4 16z" /></svg>,
  trash: (s = 18) => <svg width={s} height={s} viewBox="0 0 24 24" {...P}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>,
  lock: (s = 18) => <svg width={s} height={s} viewBox="0 0 24 24" {...P}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>,
  arrowUp: (s = 16) => <svg width={s} height={s} viewBox="0 0 24 24" {...P}><path d="M12 19V5M6 11l6-6 6 6" /></svg>,
  arrowDown: (s = 16) => <svg width={s} height={s} viewBox="0 0 24 24" {...P}><path d="M12 5v14M6 13l6 6 6-6" /></svg>,
}

export function Modal({ titulo, onClose, children, wide, center, full }) {
  const ref = useRef(null)
  useEffect(() => {
    // Escape cierra solo la ventana de más arriba
    const h = e => { if (e.key !== 'Escape') return; const todas = document.querySelectorAll('.modal-wrap'); if (todas[todas.length - 1] === ref.current) onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div ref={ref} className={'modal-wrap' + (center ? ' center' : '')} onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <section role="dialog" aria-modal="true" aria-label={titulo} className={'modal' + (wide ? ' wide' : '') + (full ? ' full' : '')}>
        <span className="handle" />
        <div className="row between">
          <h2 style={{ fontSize: 21 }}>{titulo}</h2>
          <button className="btn icon" style={{ borderRadius: 22, border: 0 }} aria-label="Cerrar" onClick={onClose}>{Icon.close()}</button>
        </div>
        {children}
      </section>
    </div>
  )
}

export function Seg({ opciones, valor, onChange, full, label }) {
  return (
    <div role="group" aria-label={label} className={'seg' + (full ? ' full' : '')}>
      {opciones.map(([v, t]) => <button key={v} aria-pressed={valor === v} onClick={() => onChange(v)}>{t}</button>)}
    </div>
  )
}

/* ---------- Periodo ---------- */
export function PeriodoSelector({ compacto }) {
  const { periodo, setPeriodo, desktop } = useApp()
  const [abierto, setAbierto] = useState(false)
  const tipo = (
    <Seg label="Tipo de periodo" full={!desktop} valor={periodo.tipo} opciones={[['mes', 'Mes'], ['ano', 'Año'], ['pers', 'Personalizado']]}
      onChange={t => { setPeriodo(cambiarTipo(periodo, t)); if (t === 'pers') setAbierto(true) }} />
  )
  const nav = (
    <div data-tour="periodo" className="row card" style={{ padding: 3, borderRadius: 14, gap: 0, justifyContent: 'space-between', flex: desktop ? 'none' : 1 }}>
      <button className="btn icon" style={{ border: 0, background: 'none' }} aria-label="Periodo anterior" onClick={() => setPeriodo(mover(periodo, -1))}>{Icon.left()}</button>
      <button className="btn" style={{ border: 0, background: 'none', padding: '0 8px' }} onClick={() => setAbierto(true)}>{etiqueta(periodo)} {Icon.chevron()}</button>
      <button className="btn icon" style={{ border: 0, background: 'none' }} aria-label="Periodo siguiente" onClick={() => setPeriodo(mover(periodo, 1))}>{Icon.right()}</button>
    </div>
  )
  return (
    <>
      {desktop || compacto ? <div className="row wrap">{tipo}{nav}</div> : <div className="col">{tipo}<div className="row">{nav}</div></div>}
      {abierto && <PeriodoModal onClose={() => setAbierto(false)} />}
    </>
  )
}

function PeriodoModal({ onClose }) {
  const { periodo, setPeriodo } = useApp()
  const r0 = rango(periodo)
  const [tipo, setTipo] = useState(periodo.tipo)
  const [desde, setDesde] = useState(r0.desde)
  const [hasta, setHasta] = useState(r0.hasta)
  const [anyo, setAnyo] = useState(periodo.anyo)
  const [mes, setMes] = useState(periodo.mes)
  const aplicar = () => {
    if (tipo === 'pers') setPeriodo({ ...periodo, tipo, desde, hasta: hasta < desde ? desde : hasta, anyo: Number(hasta.slice(0, 4)) })
    else setPeriodo({ ...periodo, tipo, anyo, mes })
    onClose()
  }
  const da = Number(desde.slice(5, 7)) - 1, ha = Number(hasta.slice(5, 7)) - 1, ya = Number(desde.slice(0, 4)), yh = Number(hasta.slice(0, 4))
  const pickMes = i => {
    if (tipo !== 'pers') { setMes(i); return }
    const ini = iso(new Date(anyo, i, 1)), fin = iso(new Date(anyo, i + 1, 0))
    if (desde !== hasta && (desde.slice(0, 7) !== hasta.slice(0, 7) || desde.slice(8) !== '01')) { setDesde(ini); setHasta(fin) }
    else if (ini < desde) setDesde(ini)
    else setHasta(fin)
  }
  const enRango = i => tipo === 'pers' ? (() => { const k = anyo * 12 + i; return k >= ya * 12 + da && k <= yh * 12 + ha })() : i === mes && tipo === 'mes'
  return (
    <Modal titulo="Periodo" onClose={onClose}>
      <Seg full label="Tipo de periodo" valor={tipo} onChange={setTipo} opciones={[['mes', 'Mes'], ['ano', 'Año'], ['pers', 'Personalizado']]} />
      {tipo === 'pers' && (
        <>
          <div className="col"><span className="xs bold muted">Atajos</span>
            <div className="row wrap" style={{ gap: 8 }}>
              {ATAJOS().map(([t, r]) => <button key={t} className="chip" aria-pressed={r.desde === desde && r.hasta === hasta} onClick={() => { setDesde(r.desde); setHasta(r.hasta); setAnyo(Number(r.hasta.slice(0, 4))) }}>{t}</button>)}
            </div>
          </div>
          <div className="row" style={{ gap: 10 }}>
            <label className="field grow">Desde<input className="input" type="date" value={desde} onChange={e => e.target.value && setDesde(e.target.value)} /></label>
            <label className="field grow">Hasta<input className="input" type="date" value={hasta} onChange={e => e.target.value && setHasta(e.target.value)} /></label>
          </div>
        </>
      )}
      <div className="col">
        <div className="row between">
          <span className="xs bold muted">{tipo === 'pers' ? 'O elige meses' : tipo === 'ano' ? 'Año' : 'Mes'}</span>
          <div className="row" style={{ gap: 4 }}>
            <button className="btn icon sm" aria-label="Año anterior" onClick={() => setAnyo(anyo - 1)}>{Icon.left(16)}</button>
            <strong style={{ minWidth: 48, textAlign: 'center' }}>{anyo}</strong>
            <button className="btn icon sm" aria-label="Año siguiente" onClick={() => setAnyo(anyo + 1)}>{Icon.right(16)}</button>
          </div>
        </div>
        {tipo !== 'ano' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6 }}>
            {MES_CORTO.map((m, i) => <button key={m} className="chip" style={{ borderRadius: 10, height: 44 }} aria-pressed={enRango(i)} onClick={() => pickMes(i)}>{m}</button>)}
          </div>
        )}
      </div>
      <button className="btn primary" style={{ height: 52 }} onClick={aplicar}>Aplicar</button>
    </Modal>
  )
}

/* ---------- Orden y búsqueda ---------- */
// cols: [{ key, label, get?: fila => valor }]
export function useOrden(filas, cols, inicial, dirInicial = -1) {
  const [orden, setOrden] = useState({ key: inicial, dir: dirInicial })
  const ordenadas = useMemo(() => {
    const c = cols.find(c => c.key === orden.key)
    if (!c) return filas
    const get = c.get || (f => f[c.key])
    return [...filas].sort((a, b) => {
      const x = get(a), y = get(b)
      const r = typeof x === 'string' || typeof y === 'string' ? String(x ?? '').localeCompare(String(y ?? ''), 'es', { sensitivity: 'base' }) : (x ?? 0) - (y ?? 0)
      return r * orden.dir
    })
  }, [filas, cols, orden])
  const ordenar = key => setOrden(o => ({ key, dir: o.key === key ? -o.dir : (cols.find(c => c.key === key)?.asc ? 1 : -1) }))
  const ciclar = () => setOrden(o => {
    if (o.dir === -1) return { ...o, dir: 1 }
    const i = cols.findIndex(c => c.key === o.key)
    return { key: cols[(i + 1) % cols.length].key, dir: -1 }
  })
  return { ordenadas, orden, ordenar, ciclar, setOrden }
}

export const buscar = (filas, q, campos) => {
  const t = norm(q)
  if (!t) return filas
  const partes = t.split(/\s+/)
  return filas.filter(f => { const h = norm(campos(f).join(' ')); return partes.every(p => h.includes(p)) })
}

export function Th({ col, orden, ordenar, className, style }) {
  const on = orden.key === col.key
  return (
    <th scope="col" className={className} style={style} aria-sort={on ? (orden.dir > 0 ? 'ascending' : 'descending') : 'none'}>
      <button onClick={() => ordenar(col.key)}>{col.label} {on ? (orden.dir > 0 ? '↑' : '↓') : ''}</button>
    </th>
  )
}

export function Toolbar({ q, setQ, placeholder, nFiltros, onFiltros, cols, orden, ciclar, setOrden, extra, ordenInicial, onLimpiar }) {
  const { desktop } = useApp()
  const col = cols?.find(c => c.key === orden?.key)
  const ordenCambiado = ordenInicial && orden && (orden.key !== ordenInicial.key || orden.dir !== ordenInicial.dir)
  const hayAlgo = !!q || nFiltros > 0 || ordenCambiado
  const limpiar = () => { setQ(''); if (ordenInicial && setOrden) setOrden(ordenInicial); onLimpiar?.() }
  return (
    <div className="col" style={{ gap: 6 }}>
      <div className="row" style={{ gap: 8 }}>
        <label className="search grow">
          {Icon.search()}<span className="sr">Buscar</span>
          <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={placeholder} />
          {q && <button type="button" className="btn icon sm" style={{ border: 0, background: 'none', width: 32, height: 32 }} aria-label="Borrar búsqueda" onClick={() => setQ('')}>{Icon.close(16)}</button>}
        </label>
        {onFiltros && (
          <button className="btn icon" style={{ position: 'relative' }} aria-label="Filtros" onClick={onFiltros}>
            {Icon.filter()}{nFiltros > 0 && <span className="badge">{nFiltros}</span>}
          </button>
        )}
        {extra}
        {hayAlgo && desktop && <button className="btn" onClick={limpiar}>{Icon.close(16)} Limpiar todo</button>}
      </div>
      {hayAlgo && !desktop && (
        <div className="row between small" style={{ padding: '6px 4px 0' }}>
          <span className="muted">{(a => a.join(' · ') + (a.length > 1 || nFiltros > 1 ? ' activos' : ' activo'))([q && 'búsqueda', nFiltros > 0 && `${nFiltros} filtro${nFiltros > 1 ? 's' : ''}`, ordenCambiado && 'orden'].filter(Boolean)).replace(/^./, c => c.toUpperCase())}</span>
          <button className="btn sm" onClick={limpiar}>{Icon.close(14)} Limpiar todo</button>
        </div>
      )}
      {cols && !desktop && (
        <div className="row" style={{ gap: 6 }}>
          {Icon.sort()}
          <label className="small muted row" style={{ gap: 6 }}>Orden
            <select className="select" style={{ height: 32, width: 'auto', padding: '0 6px', fontWeight: 600, fontSize: 13 }} value={orden.key} onChange={e => setOrden({ key: e.target.value, dir: cols.find(c => c.key === e.target.value)?.asc ? 1 : -1 })}>
              {cols.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </label>
          <button className="btn sm ghost" onClick={() => setOrden({ ...orden, dir: -orden.dir })} aria-label={orden.dir > 0 ? 'Orden ascendente; cambiar' : 'Orden descendente; cambiar'}>{orden.dir > 0 ? Icon.arrowUp() : Icon.arrowDown()} {col?.asc ? (orden.dir > 0 ? 'A→Z' : 'Z→A') : (orden.dir > 0 ? 'menor primero' : 'mayor primero')}</button>
        </div>
      )}
    </div>
  )
}

/* ---------- Exportar ---------- */
export function ExportDialog({ onClose, descVista, descTodo, nota, onExport, titulo }) {
  const { me, perfil } = useApp()
  const [modo, setModo] = useState('vista')
  const [formato, setFormato] = useState(() => { try { return localStorage.getItem('pf-export-formato') || 'xlsx' } catch { return 'xlsx' } })
  const op = (v, t, d) => (
    <button className="kpi" aria-pressed={modo === v} onClick={() => setModo(v)} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
      <span style={{ width: 20, height: 20, flex: 'none', marginTop: 1, borderRadius: 10, border: `2px solid ${modo === v ? 'var(--accent)' : 'var(--muted)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ width: 10, height: 10, borderRadius: 5, background: modo === v ? 'var(--accent)' : 'transparent' }} />
      </span>
      <span className="col" style={{ gap: 3 }}><strong>{t}</strong><span className="small muted" style={{ lineHeight: 1.4 }}>{d}</span></span>
    </button>
  )
  function exportar() {
    try { localStorage.setItem('pf-export-formato', formato) } catch {}
    const nomPerfil = perfil ? (perfil.tipo === 'personal' ? `Personal de ${me?.nombre || ''}`.trim() : perfil.nombre) : '—'
    setExportCtx({ formato, perfil: nomPerfil, usuario: me?.nombre || me?.email || '—', fecha: new Date(), titulo, contenido: modo === 'vista' ? `Lo que ves en pantalla. ${descVista}` : `Todo completo. ${descTodo}` })
    onExport(modo); onClose()
  }
  return (
    <Modal titulo="Exportar" onClose={onClose} center>
      <div className="col" style={{ gap: 6 }}>
        <span className="small muted">Formato</span>
        <Seg label="Formato" valor={formato} onChange={setFormato} opciones={[['xlsx', 'Excel'], ['pdf', 'PDF']]} />
        <span className="xs muted">{formato === 'pdf' ? 'Documento con el diseño de Cuentas Claras, listo para imprimir o enviar.' : 'Hoja de cálculo para seguir trabajando con los datos.'} Incluye el presupuesto, la fecha de exportación y quién la pide.</span>
      </div>
      {op('vista', 'Lo que ves en pantalla', descVista)}
      {op('todo', 'Todo completo', descTodo)}
      {nota && <span className="xs muted">{nota}</span>}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn primary" onClick={exportar}>{Icon.down()} Descargar {formato === 'pdf' ? 'PDF' : 'Excel'}</button>
      </div>
    </Modal>
  )
}

export function Cargando() {
  return <div className="empty">Cargando…</div>
}

export function Toast() {
  const { toast } = useApp()
  return toast ? <div className="toast" role="status">{toast}</div> : null
}
