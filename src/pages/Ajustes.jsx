import { useMemo, useState } from 'react'
import { useApp } from '../store'
import { supabase } from '../lib/supabase'
import { Icon, Modal, Seg, Th, Toolbar, buscar, useOrden } from '../components/ui'
import { nombrePerfil, SubPerfil } from '../components/Shell'
import { PALETA } from '../lib/format'

export default function Ajustes() {
  const { desktop, me, setMe, misPerfiles, perfil, perfilId, categorias, movimientos, presupuestos, setTab, recargar, setToast, aplicarTema } = useApp()
  const [q, setQ] = useState('')
  const [editCat, setEditCat] = useState(null) // cat | 'nueva'
  const [editNombre, setEditNombre] = useState(false)
  const [pass, setPass] = useState(false)
  const [sel, setSel] = useState({})

  const usos = useMemo(() => {
    const u = {}
    for (const m of movimientos) if (m.categoria_id) u[m.categoria_id] = (u[m.categoria_id] || 0) + 1
    return u
  }, [movimientos])

  const cols = useMemo(() => [
    { key: 'orden', label: 'Orden propio', asc: true },
    { key: 'nombre', label: 'Nombre', asc: true },
    { key: 'tipo', label: 'Tipo', asc: true },
    { key: 'usos', label: 'Nº movimientos', get: c => usos[c.id] || 0 },
  ], [usos])
  const { ordenadas, orden, ordenar, setOrden } = useOrden(buscar(categorias, q, c => [c.nombre, c.tipo]), cols, 'nombre', 1)

  const cambiarTema = async tema => {
    setMe({ ...me, tema }); aplicarTema(tema)
    const { error } = await supabase.from('pf_usuarios').update({ tema }).eq('id', me.id)
    if (error) setToast('No se pudo guardar el tema: ' + error.message)
  }

  const mover = async (cat, dir) => {
    const lista = [...categorias].sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre))
    const i = lista.findIndex(c => c.id === cat.id), j = i + dir
    if (j < 0 || j >= lista.length) return
    ;[lista[i], lista[j]] = [lista[j], lista[i]]
    const cambios = lista.map((c, k) => ({ id: c.id, orden: k + 1 })).filter((c, k) => lista[k].orden !== k + 1)
    for (const c of cambios) await supabase.from('pf_categorias').update({ orden: c.orden }).eq('id', c.id)
    await recargar()
  }

  const toggleActiva = async c => {
    const { error } = await supabase.from('pf_categorias').update({ activa: !c.activa }).eq('id', c.id)
    if (error) setToast(error.message); else { await recargar(); setToast(c.activa ? `${c.nombre} desactivada` : `${c.nombre} activada`) }
  }

  const selIds = Object.keys(sel).filter(k => sel[k])
  const avisoBorrado = ids => {
    const cats = categorias.filter(c => ids.includes(c.id))
    const nMov = cats.reduce((a, c) => a + (usos[c.id] || 0), 0)
    const nPres = new Set(presupuestos.filter(p => ids.includes(p.categoria_id) && p.importe).map(p => p.categoria_id + '|' + p.anyo)).size
    const nombres = cats.length === 1 ? `«${cats[0].nombre}»` : `${cats.length} categorías`
    return nMov || nPres
      ? `Vas a borrar ${nombres}. ${nMov ? `${nMov} movimientos quedarán sin categoría` : ''}${nMov && nPres ? ' y ' : ''}${nPres ? 'se perderá su presupuesto' : ''}. ¿Borrar?`
      : `¿Borrar ${nombres}?`
  }
  const borrar = async ids => {
    if (!ids.length || !confirm(avisoBorrado(ids))) return
    const { error } = await supabase.from('pf_categorias').delete().in('id', ids)
    if (error) { setToast('Error: ' + error.message); return }
    setSel({}); await recargar(); setToast(ids.length === 1 ? 'Categoría borrada' : `${ids.length} categorías borradas`)
  }
  const desactivar = async (ids, activa) => {
    const { error } = await supabase.from('pf_categorias').update({ activa }).in('id', ids)
    if (error) { setToast('Error: ' + error.message); return }
    setSel({}); await recargar(); setToast(`${ids.length} categoría${ids.length > 1 ? 's' : ''} ${activa ? 'activada' : 'desactivada'}${ids.length > 1 ? 's' : ''}`)
  }

  const fila = c => (
    <div key={c.id} className="row" style={{ gap: 8, minHeight: 54, padding: '6px 8px 6px 12px', opacity: c.activa ? 1 : 0.55, background: sel[c.id] ? 'var(--row-sel)' : undefined }}>
      <input type="checkbox" aria-label={'Seleccionar ' + c.nombre} checked={!!sel[c.id]} onChange={() => setSel(x => ({ ...x, [c.id]: !x[c.id] }))} style={{ width: 18, height: 18, accentColor: 'var(--accent)', flex: 'none' }} />
      <span className="dot" style={{ background: c.color, width: 12, height: 12, borderRadius: 4 }} />
      <span className="col grow" style={{ gap: 2 }}><span className="bold" style={{ fontSize: 14 }}>{c.nombre}</span><span className="xs muted">{c.tipo === 'gasto' ? 'Gasto' : 'Ingreso'} · {usos[c.id] || 0} movimientos{c.activa ? '' : ' · desactivada'}</span></span>
      {orden.key === 'orden' && desktop && <>
        <button className="btn icon sm" style={{ border: 0 }} aria-label={`Subir ${c.nombre}`} onClick={() => mover(c, -1)}>{Icon.arrowUp()}</button>
        <button className="btn icon sm" style={{ border: 0 }} aria-label={`Bajar ${c.nombre}`} onClick={() => mover(c, 1)}>{Icon.arrowDown()}</button>
      </>}
      <button className="btn icon sm" style={{ border: 0 }} aria-label={`Editar ${c.nombre}`} onClick={() => setEditCat(c)}>{Icon.edit()}</button>
      <button className="btn icon sm" style={{ border: 0, color: 'var(--warn)' }} aria-label={`Borrar ${c.nombre}`} onClick={() => borrar([c.id])}>{Icon.trash()}</button>
    </div>
  )

  return (
    <>
      <h1>Ajustes</h1>
      <div className={desktop ? 'split' : 'col'} style={{ gap: 18 }}>
        <div className={desktop ? 'c1 col' : 'col'} style={{ gap: 18 }}>
          <section className="card pad row" style={{ gap: 14 }}>
            <span className="avatar" style={{ width: 52, height: 52, borderRadius: 26, fontSize: 20, background: 'var(--accent)', color: 'var(--on-accent)' }}>{me.nombre[0]}</span>
            <span className="col grow" style={{ gap: 2 }}><strong style={{ fontSize: 16 }}>{me.nombre}</strong><span className="small muted ellipsis">{me.email}</span></span>
            <button className="btn sm" onClick={() => setEditNombre(true)}>Editar</button>
          </section>

          {me.es_admin && (
            <button className="btn primary" style={{ height: 64, justifyContent: 'flex-start', padding: '0 16px', gap: 12 }} onClick={() => setTab('admin')}>
              {Icon.admin()}<span className="col grow" style={{ gap: 2, alignItems: 'flex-start' }}><strong>Administración</strong><span className="xs" style={{ opacity: 0.9, fontWeight: 500 }}>Usuarios y perfiles compartidos</span></span>{Icon.right(18)}
            </button>
          )}

          <section className="col">
            <span className="group-title upper">Apariencia</span>
            <Seg full label="Tema" valor={me.tema} onChange={cambiarTema} opciones={[['claro', 'Claro'], ['oscuro', 'Oscuro'], ['sistema', 'Sistema']]} />
          </section>

          <section className="col">
            <span className="group-title upper">Mis perfiles</span>
            <div className="list">
              {misPerfiles.map(p => <div key={p.id} className="row" style={{ minHeight: 56, padding: '0 14px' }}><span className="col grow" style={{ gap: 2 }}><span className="bold">{nombrePerfil(p)}</span><span className="xs muted"><SubPerfil p={p} /></span></span>{p.id === perfilId && <span className="pill">Activo</span>}</div>)}
            </div>
          </section>

          <section className="col">
            <span className="group-title upper">Cuenta</span>
            <div className="list">
              <button className="listrow" onClick={() => setPass(true)}><span className="grow">Cambiar contraseña</span>{Icon.right(18)}</button>
              <button className="listrow warn bold" onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>
            </div>
          </section>
        </div>

        <section className={desktop ? 'c2 card pad col' : 'col'} style={{ gap: 12 }}>
          <div className="row between">
            <h2>Categorías · {nombrePerfil(perfil)}</h2>
            <button className="btn sm primary" onClick={() => setEditCat('nueva')}>{Icon.plus(16)} Categoría</button>
          </div>
          <Toolbar ordenInicial={{ key: 'nombre', dir: 1 }} q={q} setQ={setQ} placeholder="Buscar categoría" cols={cols} orden={orden} setOrden={setOrden} />
          {desktop && <div className="row small muted" style={{ gap: 6 }}>{Icon.sort()} Ordenar por {cols.map(c => <button key={c.key} className="chip" style={{ height: 30 }} aria-pressed={orden.key === c.key} onClick={() => ordenar(c.key)}>{c.label}{orden.key === c.key ? (orden.dir > 0 ? ' ↑' : ' ↓') : ''}</button>)}</div>}
          {selIds.length > 0 && (
            <div className="row wrap" style={{ gap: 8, padding: '8px 10px', background: 'var(--row-sel)', borderRadius: 12, position: 'sticky', top: 'var(--topbar-h)', zIndex: 6 }}>
              <strong className="small grow" style={desktop ? undefined : { width: '100%', flex: 'none' }}>{selIds.length} seleccionada{selIds.length > 1 ? 's' : ''}</strong>
              <button className="btn sm" onClick={() => desactivar(selIds, false)}>Desactivar</button>
              <button className="btn sm" onClick={() => desactivar(selIds, true)}>Activar</button>
              <button className="btn sm danger" onClick={() => borrar(selIds)}>{Icon.trash(16)} Borrar</button>
              <button className="btn sm ghost" onClick={() => setSel({})}>Quitar selección</button>
            </div>
          )}
          {['gasto', 'ingreso'].map(t => {
            const ls = ordenadas.filter(c => c.tipo === t)
            const todas = ls.length > 0 && ls.every(c => sel[c.id])
            return (
              <div key={t} className="col" style={{ gap: 8 }}>
                <span className="group-title upper"><label className="row" style={{ gap: 8, cursor: 'pointer' }}><input type="checkbox" aria-label={`Seleccionar todas las de ${t === 'gasto' ? 'gastos' : 'ingresos'}`} checked={todas} disabled={!ls.length} onChange={() => setSel(x => { const n = { ...x }; ls.forEach(c => { n[c.id] = !todas }); return n })} style={{ width: 18, height: 18, accentColor: 'var(--accent)' }} />{t === 'gasto' ? 'Gastos' : 'Ingresos'}</label><span>{ls.length}</span></span>
                <div className="list">{ls.length ? ls.map(fila) : <div className="empty">Sin categorías.</div>}</div>
              </div>
            )
          })}
          <span className="xs muted">Las categorías son de cada perfil. Desactivar una la oculta al apuntar movimientos, pero mantiene su historial.</span>
        </section>
      </div>

      {editCat && <EditarCat cat={editCat === 'nueva' ? null : editCat} usos={usos} presupuestos={presupuestos} onToggle={toggleActiva} onClose={() => setEditCat(null)} />}
      {editNombre && <EditarNombre onClose={() => setEditNombre(false)} />}
      {pass && <CambiarPass onClose={() => setPass(false)} />}
    </>
  )
}

function EditarCat({ cat, usos, presupuestos, onToggle, onClose }) {
  const { perfilId, categorias, recargar, setToast } = useApp()
  const [nombre, setNombre] = useState(cat?.nombre || '')
  const [tipo, setTipo] = useState(cat?.tipo || 'gasto')
  const [color, setColor] = useState(cat?.color || PALETA[categorias.length % PALETA.length])
  const [err, setErr] = useState(null)

  const guardar = async e => {
    e.preventDefault()
    if (!nombre.trim()) return
    const fila = { nombre: nombre.trim(), tipo, color }
    const { error } = cat ? await supabase.from('pf_categorias').update(fila).eq('id', cat.id)
      : await supabase.from('pf_categorias').insert({ ...fila, perfil_id: perfilId, orden: Math.max(0, ...categorias.map(c => c.orden)) + 1 })
    if (error) { setErr(error.code === '23505' ? 'Ya existe una categoría con ese nombre.' : error.message); return }
    await recargar(); setToast(cat ? 'Categoría guardada' : 'Categoría creada'); onClose()
  }
  const borrar = async () => {
    const n = usos[cat.id] || 0, np = presupuestos.filter(p => p.categoria_id === cat.id).length
    if (!confirm(n || np ? `«${cat.nombre}» tiene ${n} movimientos y presupuesto en ${new Set(presupuestos.filter(p => p.categoria_id === cat.id).map(p => p.anyo)).size} años. Si la borras, los movimientos quedan sin categoría y se pierde su presupuesto. ¿Borrar?` : `¿Borrar «${cat.nombre}»?`)) return
    const { error } = await supabase.from('pf_categorias').delete().eq('id', cat.id)
    if (error) { setErr(error.message); return }
    await recargar(); setToast('Categoría borrada'); onClose()
  }

  return (
    <Modal titulo={cat ? 'Editar categoría' : 'Nueva categoría'} onClose={onClose} center>
      <form className="col" style={{ gap: 14 }} onSubmit={guardar}>
        <label className="field">Nombre<input className="input" autoFocus value={nombre} onChange={e => setNombre(e.target.value)} required /></label>
        <Seg full label="Tipo" valor={tipo} onChange={setTipo} opciones={[['gasto', 'Gasto'], ['ingreso', 'Ingreso']]} />
        <div className="col"><span className="xs bold muted">Color</span>
          <div className="row wrap" style={{ gap: 8 }}>{PALETA.map(c => <button type="button" key={c} aria-label={'Color ' + c} aria-pressed={color === c} onClick={() => setColor(c)} style={{ width: 34, height: 34, borderRadius: 10, background: c, border: color === c ? '3px solid var(--text)' : '3px solid transparent', cursor: 'pointer' }} />)}</div>
        </div>
        {err && <div className="error">{err}</div>}
        <div className="row between wrap">
          {cat ? <div className="row"><button type="button" className="btn sm" onClick={() => { onToggle(cat); onClose() }}>{cat.activa ? 'Desactivar' : 'Activar'}</button><button type="button" className="btn sm danger" onClick={borrar}>Borrar</button></div> : <span />}
          <div className="row"><button type="button" className="btn" onClick={onClose}>Cancelar</button><button className="btn primary">Guardar</button></div>
        </div>
      </form>
    </Modal>
  )
}

function EditarNombre({ onClose }) {
  const { me, setMe, setToast, recargarBase } = useApp()
  const [n, setN] = useState(me.nombre)
  const guardar = async e => {
    e.preventDefault()
    const { error } = await supabase.from('pf_usuarios').update({ nombre: n.trim() }).eq('id', me.id)
    if (error) { setToast(error.message); return }
    setMe({ ...me, nombre: n.trim() }); await recargarBase(); onClose()
  }
  return (
    <Modal titulo="Tu nombre" onClose={onClose} center>
      <form className="col" style={{ gap: 14 }} onSubmit={guardar}>
        <label className="field">Nombre<input className="input" autoFocus value={n} onChange={e => setN(e.target.value)} required /></label>
        <div className="row" style={{ justifyContent: 'flex-end' }}><button type="button" className="btn" onClick={onClose}>Cancelar</button><button className="btn primary">Guardar</button></div>
      </form>
    </Modal>
  )
}

function CambiarPass({ onClose }) {
  const { setToast } = useApp()
  const [a, setA] = useState(''), [b, setB] = useState(''), [err, setErr] = useState(null)
  const guardar = async e => {
    e.preventDefault()
    if (a.length < 8) { setErr('Mínimo 8 caracteres.'); return }
    if (a !== b) { setErr('Las contraseñas no coinciden.'); return }
    const { error } = await supabase.auth.updateUser({ password: a })
    if (error) { setErr(error.message); return }
    setToast('Contraseña cambiada'); onClose()
  }
  return (
    <Modal titulo="Cambiar contraseña" onClose={onClose} center>
      <form className="col" style={{ gap: 14 }} onSubmit={guardar}>
        <label className="field">Nueva contraseña<input className="input" type="password" autoComplete="new-password" autoFocus value={a} onChange={e => setA(e.target.value)} /></label>
        <label className="field">Repítela<input className="input" type="password" autoComplete="new-password" value={b} onChange={e => setB(e.target.value)} /></label>
        {err && <div className="error">{err}</div>}
        <div className="row" style={{ justifyContent: 'flex-end' }}><button type="button" className="btn" onClick={onClose}>Cancelar</button><button className="btn primary">Guardar</button></div>
      </form>
    </Modal>
  )
}
