import { useState } from 'react'
import { useApp } from '../store'
import { supabase } from '../lib/supabase'
import { Modal, Seg } from '../components/ui'
import { fmtInput, hoyIso, parseImporte } from '../lib/format'

export default function MovimientoForm({ mov, cuentas, onClose }) {
  const { perfilId, categorias, cmap, recargar, setToast } = useApp()
  const tipo0 = mov ? (cmap[mov.categoria_id]?.tipo || (mov.importe < 0 ? 'gasto' : 'ingreso')) : 'gasto'
  const [tipo, setTipo] = useState(tipo0)
  const [fecha, setFecha] = useState(mov?.fecha || hoyIso())
  const [concepto, setConcepto] = useState(mov?.concepto || '')
  const [importe, setImporte] = useState(mov ? fmtInput(Math.abs(mov.importe)) : '')
  const [cat, setCat] = useState(mov?.categoria_id || '')
  const [cuenta, setCuenta] = useState(mov?.cuenta || '')
  const [tags, setTags] = useState((mov?.etiquetas || []).join(', '))
  const [notas, setNotas] = useState(mov?.notas || '')
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)

  const catsTipo = categorias.filter(c => c.tipo === tipo && (c.activa || c.id === cat))

  const guardar = async e => {
    e.preventDefault()
    const n = parseImporte(importe)
    if (isNaN(n) || n === 0) { setErr('Escribe un importe válido.'); return }
    // Un abono en una categoría de gasto (o un cargo en una de ingreso) se escribe con signo menos
    const valor = tipo === 'gasto' ? -n : n
    const fila = { perfil_id: perfilId, fecha, concepto: concepto.trim(), importe: Math.round(valor * 100) / 100, categoria_id: cat || null, cuenta: cuenta.trim(), etiquetas: tags.split(',').map(t => t.trim()).filter(Boolean), notas: notas.trim() || null }
    setBusy(true)
    const { error } = mov ? await supabase.from('pf_movimientos').update(fila).eq('id', mov.id) : await supabase.from('pf_movimientos').insert(fila)
    setBusy(false)
    if (error) { setErr(error.message); return }
    setToast(mov ? 'Movimiento guardado' : 'Movimiento añadido')
    await recargar()
    onClose()
  }

  const borrar = async () => {
    if (!confirm('¿Borrar este movimiento?')) return
    const { error } = await supabase.from('pf_movimientos').delete().eq('id', mov.id)
    if (error) { setErr(error.message); return }
    setToast('Movimiento borrado')
    await recargar()
    onClose()
  }

  return (
    <Modal titulo={mov ? 'Editar movimiento' : 'Nuevo movimiento'} onClose={onClose}>
      <form className="col" style={{ gap: 14 }} onSubmit={guardar}>
        <Seg full label="Tipo" valor={tipo} onChange={t => { setTipo(t); if (cat && cmap[cat]?.tipo !== t) setCat('') }} opciones={[['gasto', 'Gasto'], ['ingreso', 'Ingreso']]} />
        <div className="row" style={{ gap: 10 }}>
          <label className="field grow">Importe (€)<input className="input" inputMode="decimal" autoFocus={!mov} value={importe} onChange={e => setImporte(e.target.value)} placeholder="0,00" required /></label>
          <label className="field grow">Fecha<input className="input" type="date" value={fecha} onChange={e => setFecha(e.target.value)} required /></label>
        </div>
        <label className="field">Concepto<input className="input" value={concepto} onChange={e => setConcepto(e.target.value)} placeholder="Ej.: Mercadona" /></label>
        <label className="field">Categoría<select className="select" value={cat} onChange={e => setCat(e.target.value)}>
          <option value="">Sin categoría</option>
          {catsTipo.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select></label>
        <div className="row" style={{ gap: 10 }}>
          <label className="field grow">Cuenta<input className="input" list="pf-cuentas" value={cuenta} onChange={e => setCuenta(e.target.value)} placeholder="Ej.: Cuenta principal" /><datalist id="pf-cuentas">{cuentas.map(c => <option key={c} value={c} />)}</datalist></label>
          <label className="field grow">Etiquetas<input className="input" value={tags} onChange={e => setTags(e.target.value)} placeholder="Separadas por comas" /></label>
        </div>
        <label className="field">Notas<textarea className="input" rows={2} value={notas} onChange={e => setNotas(e.target.value)} /></label>
        <span className="xs muted">Para una devolución en una categoría de gasto, márcala como Ingreso y elige «Sin categoría», o como Gasto con importe negativo (−).</span>
        {err && <div className="error">{err}</div>}
        <div className="row between">
          {mov ? <button type="button" className="btn danger" onClick={borrar}>Borrar</button> : <span />}
          <div className="row"><button type="button" className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button></div>
        </div>
      </form>
    </Modal>
  )
}
