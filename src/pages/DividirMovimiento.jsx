import { useMemo, useState } from 'react'
import { useApp } from '../store'
import { supabase } from '../lib/supabase'
import { Icon, Modal } from '../components/ui'
import { fmt2, fmtInput, parseImporte } from '../lib/format'

const r2 = n => Math.round(n * 100) / 100
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16) }))

// Reparte un movimiento en varias partes, cada una con su importe, categoría y texto.
// Las partes se guardan como movimientos enlazados (division_id) que guardan el importe y el concepto originales.
export default function DividirMovimiento({ mov, onClose, onHecho }) {
  const { perfilId, categorias, cmap, movimientos, recargar, setToast } = useApp()
  const partes0 = useMemo(() => (mov.division_id ? movimientos.filter(m => m.division_id === mov.division_id).sort((a, b) => (a.division_orden || 0) - (b.division_orden || 0)) : [mov]), [mov, movimientos])
  const total = Number(mov.importe_original ?? (mov.division_id ? partes0.reduce((s, m) => s + Number(m.importe), 0) : mov.importe))
  const signo = total < 0 ? -1 : 1
  const original = mov.concepto_original || mov.concepto || ''
  const tipo = signo < 0 ? 'gasto' : 'ingreso'
  const quitaPrefijo = c => (c && original && c.startsWith(original + ' · ') ? c.slice(original.length + 3) : c === original ? '' : c || '')

  const [filas, setFilas] = useState(() => mov.division_id
    ? partes0.map(p => ({ k: p.id, importe: fmtInput(Math.abs(p.importe)), cat: p.categoria_id || '', texto: quitaPrefijo(p.concepto) }))
    : [{ k: 'a', importe: fmtInput(Math.abs(total)), cat: mov.categoria_id || '', texto: '' }, { k: 'b', importe: '', cat: '', texto: '' }])
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)

  const suma = filas.reduce((s, f) => s + (parseImporte(f.importe) || 0), 0)
  const falta = r2(Math.abs(total) - suma)
  const cuadra = Math.abs(falta) < 0.005

  const cambiar = (i, campo, v) => setFilas(fs => {
    const n = fs.map((f, j) => (j === i ? { ...f, [campo]: v } : f))
    // Con dos partes, al escribir una la otra se rellena sola con lo que queda
    if (campo === 'importe' && n.length === 2) { const o = 1 - i; const resto = r2(Math.abs(total) - (parseImporte(v) || 0)); n[o] = { ...n[o], importe: resto > 0 ? fmtInput(resto) : '' } }
    return n
  })
  const anadir = () => setFilas(fs => [...fs, { k: Math.random().toString(36).slice(2), importe: falta > 0 ? fmtInput(falta) : '', cat: '', texto: '' }])
  const quitar = i => setFilas(fs => fs.filter((_, j) => j !== i))
  const restoEn = i => cambiar(i, 'importe', fmtInput(r2((parseImporte(filas[i].importe) || 0) + falta)))

  const catsTipo = categorias.filter(c => c.tipo === tipo && c.activa)

  async function guardar() {
    setErr(null)
    if (filas.length < 2) return setErr('Hacen falta al menos dos partes.')
    if (filas.some(f => !(parseImporte(f.importe) > 0))) return setErr('Cada parte necesita un importe mayor que cero.')
    if (!cuadra) return setErr(falta > 0 ? `Faltan ${fmt2(falta)} por repartir.` : `Te pasas en ${fmt2(-falta)}.`)
    setBusy(true)
    const did = mov.division_id || uuid()
    const nuevas = filas.map((f, i) => ({
      perfil_id: perfilId, fecha: mov.fecha, cuenta: mov.cuenta || '', etiquetas: mov.etiquetas || [], notas: mov.notas || null,
      concepto: f.texto.trim() ? `${original} · ${f.texto.trim()}` : original,
      importe: r2(signo * parseImporte(f.importe)), categoria_id: f.cat || null,
      division_id: did, division_orden: i + 1, importe_original: r2(total), concepto_original: original,
    }))
    const { error } = await supabase.from('pf_movimientos').insert(nuevas)
    if (error) { setBusy(false); return setErr(error.message) }
    const viejos = partes0.map(p => p.id)
    const { error: e2 } = await supabase.from('pf_movimientos').delete().in('id', viejos)
    setBusy(false)
    if (e2) return setErr(e2.message)
    setToast(`Dividido en ${nuevas.length} partes`)
    await recargar(); onHecho?.(); onClose()
  }

  async function unir() {
    if (!mov.division_id) return
    if (!confirm('¿Volver a juntar las partes en un único movimiento?')) return
    setBusy(true)
    const p0 = partes0[0]
    const fila = { perfil_id: perfilId, fecha: p0.fecha, cuenta: p0.cuenta || '', etiquetas: p0.etiquetas || [], notas: p0.notas || null, concepto: original, importe: r2(total), categoria_id: p0.categoria_id || null }
    const { error } = await supabase.from('pf_movimientos').insert(fila)
    if (error) { setBusy(false); return setErr(error.message) }
    const { error: e2 } = await supabase.from('pf_movimientos').delete().in('id', partes0.map(p => p.id))
    setBusy(false)
    if (e2) return setErr(e2.message)
    setToast('Partes unidas de nuevo')
    await recargar(); onHecho?.(); onClose()
  }

  return (
    <Modal titulo={mov.division_id ? 'Editar reparto' : 'Dividir movimiento'} onClose={onClose} wide>
      <div className="card pad row between" style={{ gap: 12, padding: '12px 16px' }}>
        <span className="col" style={{ gap: 2, minWidth: 0 }}><strong className="ellipsis">{original || '(sin concepto)'}</strong><span className="xs muted">{new Date(mov.fecha + 'T12:00').toLocaleDateString('es-ES')} · {tipo === 'gasto' ? 'Gasto' : 'Ingreso'}</span></span>
        <strong style={{ fontSize: 22, whiteSpace: 'nowrap' }}>{fmt2(total)}</strong>
      </div>

      <div className="col" style={{ gap: 10 }}>
        {filas.map((f, i) => (
          <div key={f.k} className="dv-fila">
            <span className="dv-n">{i + 1}</span>
            <label className="field dv-imp">Importe (€)<input className="input" inputMode="decimal" value={f.importe} onChange={e => cambiar(i, 'importe', e.target.value)} placeholder={falta > 0 ? fmtInput(falta) : '0,00'} autoFocus={i === 1 && !mov.division_id} /></label>
            <label className="field dv-cat">Categoría<select className="select" value={f.cat} onChange={e => cambiar(i, 'cat', e.target.value)}>
              <option value="">Sin categoría</option>
              {catsTipo.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select></label>
            <label className="field dv-txt">Para / detalle<input className="input" value={f.texto} onChange={e => cambiar(i, 'texto', e.target.value)} placeholder="Ej.: Nina" /></label>
            <div className="row dv-acc" style={{ gap: 4 }}>
              {!cuadra && falta > 0 && <button type="button" className="btn sm ghost" title="Poner aquí lo que falta" onClick={() => restoEn(i)}>+ resto</button>}
              {filas.length > 2 && <button type="button" className="btn icon ghost" aria-label={`Quitar parte ${i + 1}`} onClick={() => quitar(i)}>{Icon.trash ? Icon.trash(16) : '✕'}</button>}
            </div>
          </div>
        ))}
        <button type="button" className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={anadir}>{Icon.plus(15)} Añadir parte</button>
      </div>

      <div className={'dv-estado ' + (cuadra ? 'ok' : 'warn')} role="status">
        {cuadra ? <>✓ Reparto completo: {filas.length} partes suman {fmt2(Math.abs(total))}</>
          : falta > 0 ? <>Falta por repartir <strong>{fmt2(falta)}</strong> de {fmt2(Math.abs(total))}</>
            : <>Te pasas en <strong>{fmt2(-falta)}</strong>: las partes suman {fmt2(suma)}</>}
      </div>
      <span className="xs muted">Cada parte se guarda como un movimiento con su categoría y cuenta en el Resumen, el Presupuesto y la Liquidez. Al importar el extracto, la app sabe que estos {fmt2(Math.abs(total))} ya están apuntados.</span>
      {err && <div className="error">{err}</div>}
      <div className="row between" style={{ gap: 8 }}>
        {mov.division_id ? <button type="button" className="btn" onClick={unir} disabled={busy}>Unir de nuevo</button> : <span />}
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn primary" disabled={busy || !cuadra} onClick={guardar}>{busy ? 'Guardando…' : 'Guardar reparto'}</button>
        </div>
      </div>
    </Modal>
  )
}
