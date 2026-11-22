import { useMemo, useState } from 'react'
import { useApp } from '../store'
import { tipoDe, valor } from '../lib/calc'
import { fmt0, fmt2, norm } from '../lib/format'
import { Modal } from './ui'
import MovimientoForm from '../pages/MovimientoForm'

const fechaTxt = f => new Date(f + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })

// Ventana con los movimientos que forman una cifra del Resumen, sin salir de la pantalla
// filtro: { cat?: id | '__sin', desde, hasta }
export default function DetalleMovs({ titulo, subtitulo, filtro, presupuesto, onClose, onAbrirEnMovimientos }) {
  const { movimientos, cmap, desktop } = useApp()
  const [q, setQ] = useState('')
  const [orden, setOrden] = useState('fecha')
  const [editar, setEditar] = useState(null)
  const cuentas = useMemo(() => [...new Set(movimientos.map(m => m.cuenta).filter(Boolean))].sort(), [movimientos])

  const lista = useMemo(() => {
    let l = movimientos.filter(m => m.fecha >= filtro.desde && m.fecha <= filtro.hasta)
    if (filtro.cat === '__sin') l = l.filter(m => !m.categoria_id)
    else if (filtro.cat) l = l.filter(m => m.categoria_id === filtro.cat)
    if (filtro.tipo) l = l.filter(m => tipoDe(m, cmap) === filtro.tipo)
    if (q) { const n = norm(q); l = l.filter(m => norm(`${m.concepto} ${m.cuenta || ''} ${(m.etiquetas || []).join(' ')} ${m.notas || ''}`).includes(n)) }
    return [...l].sort((a, b) => (orden === 'importe' ? Math.abs(b.importe) - Math.abs(a.importe) : b.fecha.localeCompare(a.fecha)))
  }, [movimientos, filtro, q, orden, cmap])

  const total = lista.reduce((a, m) => a + valor(m, tipoDe(m, cmap)), 0)
  const neto = lista.reduce((a, m) => a + Number(m.importe), 0)

  return (
    <>
      <Modal titulo={titulo} onClose={onClose} wide>
        {subtitulo && <span className="small muted" style={{ marginTop: -6 }}>{subtitulo}</span>}
        <div className="row" style={{ gap: 8 }}>
          <div className="card pad col" style={{ gap: 2, flex: '1 1 0', minWidth: 0, padding: '10px 12px' }}><span className="xs muted">Total</span><strong style={{ fontSize: desktop ? 22 : 17 }}>{fmt0(filtro.cat || filtro.tipo ? total : neto)}</strong></div>
          {presupuesto != null && <div className="card pad col" style={{ gap: 2, flex: '1 1 0', minWidth: 0, padding: '10px 12px' }}><span className="xs muted">Presupuesto</span><strong style={{ fontSize: desktop ? 22 : 17 }}>{fmt0(presupuesto)}</strong></div>}
          <div className="card pad col" style={{ gap: 2, flex: '0 1 auto', minWidth: 0, padding: '10px 12px' }}><span className="xs muted">{desktop ? 'Movimientos' : 'Movs.'}</span><strong style={{ fontSize: desktop ? 22 : 17 }}>{lista.length}</strong></div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <div className="search grow" style={{ position: 'relative' }}>
            <input className="input" placeholder={desktop ? "Buscar concepto, cuenta, etiqueta…" : "Buscar…"} value={q} onChange={e => setQ(e.target.value)} aria-label="Buscar" style={{ width: '100%' }} />
          </div>
          <select className="select" value={orden} onChange={e => setOrden(e.target.value)} aria-label="Orden" style={{ width: 'auto' }}>
            <option value="fecha">Más recientes</option><option value="importe">Mayor importe</option>
          </select>
        </div>
        <div className="col" style={{ gap: 0, maxHeight: desktop ? '52vh' : '50vh', overflow: 'auto', margin: '0 -4px', padding: '0 4px' }}>
          {lista.length ? lista.map(m => (
            <button key={m.id} type="button" className="row" onClick={() => setEditar(m)} title="Editar movimiento"
              style={{ gap: 12, padding: '11px 4px', border: 0, borderBottom: '1px solid var(--border)', background: 'none', textAlign: 'left', cursor: 'pointer', color: 'inherit', font: 'inherit', width: '100%' }}>
              <span className="xs muted" style={{ width: 52, flex: 'none' }}>{fechaTxt(m.fecha)}</span>
              <span className="col grow" style={{ gap: 2, minWidth: 0 }}>
                <strong className="ellipsis" style={{ fontWeight: 600 }}>{m.concepto}</strong>
                <span className="xs muted ellipsis">{[!filtro.cat && (cmap[m.categoria_id]?.nombre || 'Sin categoría'), m.cuenta, ...(m.etiquetas || [])].filter(Boolean).join(' · ')}</span>
              </span>
              <strong className={Number(m.importe) > 0 ? 'ok' : ''} style={{ whiteSpace: 'nowrap' }}>{fmt2(m.importe)}</strong>
            </button>
          )) : <span className="small muted" style={{ padding: '16px 0' }}>No hay movimientos{q ? ' que coincidan con la búsqueda' : ' en este periodo'}.</span>}
        </div>
        <div className="row wrap between" style={{ gap: 8 }}>
          <span className="xs muted">Toca un movimiento para editarlo o cambiarle la categoría.</span>
          {onAbrirEnMovimientos && <button className="btn sm ghost" onClick={onAbrirEnMovimientos}>Abrir en Movimientos →</button>}
        </div>
      </Modal>
      {editar && <MovimientoForm mov={editar} cuentas={cuentas} onClose={() => setEditar(null)} />}
    </>
  )
}
