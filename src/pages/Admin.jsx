import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../store'
import { supabase } from '../lib/supabase'
import { Icon, Modal, Th, Toolbar, buscar, useOrden } from '../components/ui'

async function llamarFuncion(cuerpo) {
  const { data: { session } } = await supabase.auth.getSession()
  const r = await fetch(import.meta.env.VITE_SUPABASE_URL + '/functions/v1/pf-admin', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_KEY, Authorization: 'Bearer ' + session.access_token }, body: JSON.stringify(cuerpo) })
  const txt = await r.text()
  let j = {}
  try { j = JSON.parse(txt) } catch { j = { error: txt || r.statusText } }
  if (!r.ok) throw new Error(j.error || 'Error ' + r.status)
  return j
}

export default function Admin() {
  const { desktop, uid, usuarios, perfiles, miembros, recargarBase, setTab, setToast } = useApp()
  const [q, setQ] = useState('')
  const [invitar, setInvitar] = useState(false)
  const [sel, setSel] = useState(null)
  const [perfilEdit, setPerfilEdit] = useState(null) // perfil | 'nuevo'
  const [clave, setClave] = useState(null) // { nombre, email, password }

  const [solic, setSolic] = useState([])
  const [verTodas, setVerTodas] = useState(false)
  const cargarSolic = () => supabase.from('pf_solicitudes').select('*').order('created_at', { ascending: false }).limit(100).then(({ data }) => setSolic(data || []))
  useEffect(() => { cargarSolic() }, [])
  const [desdeSolic, setDesdeSolic] = useState(null)
  async function estadoSolic(id, estado) {
    const { error } = await supabase.from('pf_solicitudes').update({ estado }).eq('id', id)
    if (error) return setToast('No se pudo actualizar: ' + error.message)
    setSolic(l => l.map(x => (x.id === id ? { ...x, estado } : x)))
  }
  const [conex, setConex] = useState([])
  useEffect(() => { supabase.from('pf_conexiones').select('user_id, at, tipo, dispositivo').order('at', { ascending: false }).limit(2000).then(({ data }) => setConex(data || [])) }, [])
  const stats = useMemo(() => {
    const o = {}, hace30 = Date.now() - 30 * 86400000, hace7 = Date.now() - 7 * 86400000
    for (const c of conex) { const x = (o[c.user_id] ||= { total: 0, d30: 0, d7: 0, ultima: null, lista: [] }); const t = new Date(c.at).getTime(); x.total++; if (t >= hace30) x.d30++; if (t >= hace7) x.d7++; if (!x.ultima || c.at > x.ultima) x.ultima = c.at; x.lista.push(c) }
    return o
  }, [conex])
  const cuando = iso => {
    if (!iso) return 'Nunca'
    const d = new Date(iso), hoy = new Date(), ayer = new Date(Date.now() - 86400000)
    const h = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    if (d.toDateString() === hoy.toDateString()) return 'Hoy ' + h
    if (d.toDateString() === ayer.toDateString()) return 'Ayer ' + h
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: d.getFullYear() === hoy.getFullYear() ? undefined : 'numeric' }) + ' ' + h
  }
  const perfilesDe = id => miembros.filter(m => m.user_id === id).map(m => perfiles.find(p => p.id === m.perfil_id)).filter(Boolean).map(p => (p.tipo === 'personal' ? 'Personal' : p.nombre))
  const filas = useMemo(() => usuarios.map(u => ({ ...u, rol: u.es_admin ? 'Admin' : 'Usuario', estado: u.activo ? 'Activo' : 'Desactivado', ultima: stats[u.id]?.ultima || '', nconex: stats[u.id]?.total || 0 })), [usuarios, stats])
  const cols = useMemo(() => [{ key: 'nombre', label: 'Nombre', asc: true }, { key: 'email', label: 'Email', asc: true }, { key: 'rol', label: 'Rol', asc: true }, { key: 'estado', label: 'Estado', asc: true }, { key: 'ultima', label: 'Última conexión' }, { key: 'nconex', label: 'Conexiones' }], [])
  const { ordenadas, orden, ordenar, setOrden } = useOrden(buscar(filas, q, u => [u.nombre, u.email, u.rol, u.estado]), cols, 'nombre', 1)
  const compartidos = perfiles.filter(p => p.tipo === 'compartido')
  const u = sel && usuarios.find(x => x.id === sel)

  const accion = async (fn, ok) => { try { await fn(); await recargarBase(); if (ok) setToast(ok) } catch (e) { setToast('Error: ' + e.message) } }
  const setActivo = (id, activo) => accion(async () => { const { error } = await supabase.rpc('pf_admin_set_activo', { p_user: id, p_activo: activo }); if (error) throw error }, activo ? 'Usuario reactivado' : 'Usuario desactivado')
  const renombrar = id => { const n = prompt('Nombre', usuarios.find(x => x.id === id)?.nombre); if (n?.trim()) accion(async () => { const { error } = await supabase.rpc('pf_admin_editar_usuario', { p_user: id, p_nombre: n.trim() }); if (error) throw error }, 'Nombre cambiado') }
  const reset = id => accion(async () => { const r = await llamarFuncion({ accion: 'reset', user_id: id }); const x = usuarios.find(y => y.id === id); setClave({ nombre: x.nombre, email: x.email, password: r.password }) })

  return (
    <>
      <button className="btn ghost" style={{ alignSelf: 'flex-start', padding: 0 }} onClick={() => setTab('ajustes')}>{Icon.left()} Ajustes</button>
      <header className="col" style={{ gap: 6 }}>
        <span className="pill" style={{ alignSelf: 'flex-start' }}>Solo visible para administradores</span>
        <h1>Administración</h1>
      </header>
      <div className="notice row" style={{ alignItems: 'flex-start', gap: 12 }}>
        <span className="avatar" style={{ width: 36, height: 36, borderRadius: 10 }}>{Icon.lock()}</span>
        <span><strong style={{ color: 'var(--text)' }}>Datos privados.</strong> Desde aquí gestionas cuentas y quién entra en cada perfil compartido. La base de datos no deja ver movimientos, presupuestos ni categorías de nadie desde esta sección; tus propios datos los ves en tus perfiles, como cualquier usuario.</span>
      </div>

      {(() => {
        const pend = solic.filter(x => x.estado === 'pendiente'), lista = verTodas ? solic : pend
        if (!solic.length) return null
        return (
          <section className="card pad col" style={{ gap: 10 }}>
            <div className="row wrap between" style={{ gap: 8 }}>
              <h2>Solicitudes {pend.length > 0 && <span className="pill warn" style={{ marginLeft: 6, verticalAlign: 'middle' }}>{pend.length} pendiente{pend.length > 1 ? 's' : ''}</span>}</h2>
              {solic.length > pend.length && <button className="btn sm ghost" onClick={() => setVerTodas(v => !v)}>{verTodas ? 'Solo pendientes' : `Ver todas (${solic.length})`}</button>}
            </div>
            {!lista.length && <span className="small muted">No hay solicitudes pendientes.</span>}
            {lista.map(x => (
              <div key={x.id} className="row wrap" style={{ gap: 10, padding: '10px 12px', borderRadius: 12, background: x.estado === 'pendiente' ? 'var(--accent-soft)' : 'var(--neutral-soft)', opacity: x.estado === 'pendiente' ? 1 : 0.7 }}>
                <span className="col grow" style={{ gap: 2, minWidth: 180 }}>
                  <strong>{x.nombre} {x.tipo === 'info' && <span className="pill" style={{ marginLeft: 6 }}>Pide información</span>}</strong><span className="small muted">{x.email} · {new Date(x.created_at).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  {x.mensaje && <span className="small">«{x.mensaje}»</span>}
                </span>
                {x.estado === 'pendiente' ? <>
                  <button className="btn sm primary" onClick={() => { setDesdeSolic(x); setInvitar(true) }}>{Icon.plus(14)} Crear usuario</button>
                  <button className="btn sm ghost" onClick={() => estadoSolic(x.id, 'descartada')}>Descartar</button>
                </> : <span className="pill">{x.estado === 'creada' ? 'Cuenta creada' : 'Descartada'}</span>}
              </div>
            ))}
          </section>
        )
      })()}

      <div className={desktop ? 'split' : 'col'} style={{ gap: 18 }}>
        <section className={desktop ? 'c2 card pad col' : 'col'} style={{ gap: 12 }}>
          <div className="row between"><h2>Usuarios</h2><button className="btn sm primary" onClick={() => setInvitar(true)}>{Icon.plus(16)} Invitar</button></div>
          <Toolbar ordenInicial={{ key: 'nombre', dir: 1 }} q={q} setQ={setQ} placeholder="Buscar usuario o email" cols={cols} orden={orden} setOrden={setOrden} />
          {desktop ? (
            <div className="tablewrap"><table className="t">
              <thead><tr>{cols.map(c => <Th key={c.key} col={c} orden={orden} ordenar={ordenar} />)}<th>Perfiles</th></tr></thead>
              <tbody>{ordenadas.map(x => (
                <tr key={x.id} className={'clickable' + (sel === x.id ? ' sel' : '')} onClick={() => setSel(x.id)}>
                  <td className="bold">{x.nombre}</td><td className="muted">{x.email}</td>
                  <td><span className={'pill' + (x.es_admin ? '' : ' neutral')}>{x.rol}</span></td>
                  <td><span className={'pill ' + (x.activo ? 'ok' : 'neutral')}>{x.estado}</span></td>
                  <td className="small">{cuando(x.ultima)}</td>
                  <td className="num">{x.nconex}</td>
                  <td className="small muted">{perfilesDe(x.id).join(', ')}</td>
                </tr>))}</tbody>
            </table></div>
          ) : (
            <div className="list">{ordenadas.map(x => (
              <button key={x.id} className="listrow" style={{ background: sel === x.id ? 'var(--row-sel)' : undefined }} onClick={() => setSel(x.id)}>
                <span className="avatar">{x.nombre[0]}</span>
                <span className="col grow" style={{ gap: 2 }}><strong style={{ fontSize: 15 }}>{x.nombre}</strong><span className="xs muted ellipsis">{x.email}</span><span className="xs muted">Última conexión: {cuando(x.ultima)} · {x.nconex} en total</span></span>
                <span className={'pill ' + (x.es_admin ? '' : x.activo ? 'ok' : 'neutral')}>{x.es_admin ? 'Admin' : x.estado}</span>
              </button>))}</div>
          )}
          {u && (
            <div className="card pad col" style={{ gap: 12, background: 'var(--bg)' }}>
              <div className="row between"><strong>{u.nombre}</strong><span className="xs muted">Perfiles: {perfilesDe(u.id).join(', ') || '—'}</span></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 8 }}>
                <button className="btn sm" onClick={() => renombrar(u.id)}>Cambiar nombre</button>
                <button className="btn sm" onClick={() => reset(u.id)}>Nueva contraseña temporal</button>
                <button className="btn sm" disabled={u.id === uid} onClick={() => setActivo(u.id, !u.activo)}>{u.activo ? 'Desactivar' : 'Reactivar'}</button>
              </div>
              <div className="col" style={{ gap: 8, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                <strong className="small">Conexiones</strong>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 8 }}>
                  {[['Últimos 7 días', stats[u.id]?.d7 || 0], ['Últimos 30 días', stats[u.id]?.d30 || 0], ['Total', stats[u.id]?.total || 0]].map(([t, n]) => (
                    <div key={t} className="card pad col" style={{ gap: 2, padding: '10px 12px' }}><span className="xs muted">{t}</span><strong style={{ fontSize: 20 }}>{n}</strong></div>
                  ))}
                </div>
                {(stats[u.id]?.lista || []).length ? (
                  <div className="col" style={{ gap: 0, maxHeight: 280, overflow: 'auto' }}>
                    {stats[u.id].lista.slice(0, 50).map((c, i) => (
                      <div key={i} className="row between small" style={{ padding: '7px 2px', borderBottom: '1px solid var(--border)', gap: 10 }}>
                        <span>{new Date(c.at).toLocaleString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                        <span className="xs muted" style={{ textAlign: 'right' }}>{c.tipo === 'login' ? 'Inicio de sesión' : 'Abrió la app'}{c.dispositivo ? ' · ' + c.dispositivo : ''}</span>
                      </div>
                    ))}
                  </div>
                ) : <span className="xs muted">Todavía no hay conexiones registradas.</span>}
                <span className="xs muted">Cuenta cada vez que entra o vuelve a la app tras 30 minutos sin usarla. El registro empieza hoy; antes solo se conoce el último inicio de sesión.</span>
              </div>
              <span className="xs muted">{u.id === uid ? 'No puedes desactivar tu propia cuenta de administrador.' : 'Desactivar le impide entrar y ver sus perfiles; sus datos se conservan. Se puede reactivar en cualquier momento.'}</span>
            </div>
          )}
        </section>

        <section className={desktop ? 'c1 card pad col' : 'col'} style={{ gap: 12 }}>
          <div className="row between"><h2>Perfiles compartidos</h2><button className="btn sm" onClick={() => setPerfilEdit('nuevo')}>{Icon.plus(16)} Nuevo</button></div>
          {compartidos.map(p => {
            const ms = miembros.filter(m => m.perfil_id === p.id).map(m => usuarios.find(x => x.id === m.user_id)).filter(Boolean)
            return (
              <div key={p.id} className="card pad col" style={{ gap: 10 }}>
                <div className="row between"><span className="col" style={{ gap: 2 }}><strong>{p.nombre}</strong><span className="xs muted">{p.descripcion || 'Perfil compartido'}</span></span><button className="btn sm" onClick={() => setPerfilEdit(p)}>Editar</button></div>
                <div className="row wrap" style={{ gap: 8 }}>{ms.map(m => <span key={m.id} className="row" style={{ gap: 8, height: 36, padding: '0 12px 0 3px', borderRadius: 18, background: 'var(--bg)', fontSize: 14 }}><span className="avatar" style={{ width: 30, height: 30, fontSize: 13 }}>{m.nombre[0]}</span>{m.nombre}</span>)}</div>
              </div>
            )
          })}
          {!compartidos.length && <div className="empty card">No hay perfiles compartidos.</div>}
        </section>
      </div>

      {invitar && <Invitar inicial={desdeSolic} onClose={() => { setInvitar(false); setDesdeSolic(null) }} onCreado={r => { setInvitar(false); recargarBase(); if (desdeSolic) { estadoSolic(desdeSolic.id, 'creada'); setDesdeSolic(null) } if (r.password) setClave(r) ; else setToast(`${r.nombre} ya tenía cuenta en este proyecto: entra con su contraseña actual`) }} />}
      {perfilEdit && <PerfilCompartido perfil={perfilEdit === 'nuevo' ? null : perfilEdit} onClose={() => setPerfilEdit(null)} />}
      {clave && (
        <Modal titulo="Contraseña temporal" onClose={() => setClave(null)} center>
          <p className="small" style={{ margin: 0 }}>Pásale estos datos a <strong>{clave.nombre}</strong>. La contraseña solo se muestra ahora; podrá cambiarla en Ajustes.</p>
          <div className="card pad col" style={{ gap: 6, fontFamily: 'ui-monospace, monospace' }}><span>{clave.email}</span><strong style={{ fontSize: 20 }}>{clave.password}</strong></div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => { navigator.clipboard?.writeText(`${location.origin}\nUsuario: ${clave.email}\nContraseña: ${clave.password}`); setToast('Copiado') }}>Copiar</button>
            <button className="btn primary" onClick={() => setClave(null)}>Hecho</button>
          </div>
        </Modal>
      )}
    </>
  )
}

function Invitar({ onClose, onCreado, inicial }) {
  const { perfiles } = useApp()
  const [nombre, setNombre] = useState(inicial?.nombre || ''), [email, setEmail] = useState(inicial?.email || '')
  const [comp, setComp] = useState({})
  const [err, setErr] = useState(null), [busy, setBusy] = useState(false)
  const compartidos = perfiles.filter(p => p.tipo === 'compartido')
  const enviar = async e => {
    e.preventDefault(); setErr(null); setBusy(true)
    try {
      const r = await llamarFuncion({ accion: 'crear', nombre: nombre.trim(), email: email.trim().toLowerCase(), perfiles: Object.keys(comp).filter(k => comp[k]) })
      onCreado({ nombre: nombre.trim(), email: email.trim().toLowerCase(), password: r.password })
    } catch (e2) { setErr(e2.message) } finally { setBusy(false) }
  }
  return (
    <Modal titulo="Invitar usuario" onClose={onClose} center>
      <form className="col" style={{ gap: 14 }} onSubmit={enviar}>
        <label className="field">Nombre<input className="input" autoFocus value={nombre} onChange={e => setNombre(e.target.value)} required /></label>
        <label className="field">Email<input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
        {compartidos.length > 0 && <div className="col"><span className="xs bold muted">Añadir también a</span>{compartidos.map(p => <label key={p.id} className="row small" style={{ minHeight: 32 }}><input type="checkbox" checked={!!comp[p.id]} onChange={() => setComp({ ...comp, [p.id]: !comp[p.id] })} style={{ width: 18, height: 18, accentColor: 'var(--accent)' }} />{p.nombre}</label>)}</div>}
        <span className="xs muted">Se crea su perfil personal con categorías básicas y una contraseña temporal que verás al terminar.</span>
        {err && <div className="error">{err}</div>}
        <div className="row" style={{ justifyContent: 'flex-end' }}><button type="button" className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={busy}>{busy ? 'Creando…' : 'Crear cuenta'}</button></div>
      </form>
    </Modal>
  )
}

function PerfilCompartido({ perfil, onClose }) {
  const { usuarios, miembros, recargarBase, setToast } = useApp()
  const [nombre, setNombre] = useState(perfil?.nombre || '')
  const [desc, setDesc] = useState(perfil?.descripcion || '')
  const [sel, setSel] = useState(() => Object.fromEntries(miembros.filter(m => m.perfil_id === perfil?.id).map(m => [m.user_id, true])))
  const [err, setErr] = useState(null)
  const guardar = async e => {
    e.preventDefault()
    const ids = Object.keys(sel).filter(k => sel[k])
    const { error } = await supabase.rpc('pf_admin_guardar_perfil', { p_id: perfil?.id || null, p_nombre: nombre.trim(), p_descripcion: desc.trim() || null, p_miembros: ids })
    if (error) { setErr(error.message); return }
    await recargarBase(); setToast('Perfil guardado'); onClose()
    if (!perfil) location.reload()
  }
  return (
    <Modal titulo={perfil ? 'Editar perfil compartido' : 'Nuevo perfil compartido'} onClose={onClose} center>
      <form className="col" style={{ gap: 14 }} onSubmit={guardar}>
        <label className="field">Nombre<input className="input" value={nombre} onChange={e => setNombre(e.target.value)} required /></label>
        <label className="field">Descripción<input className="input" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Ej.: Gastos de los hijos y comunes" /></label>
        <div className="col"><span className="xs bold muted">Miembros</span>
          {usuarios.filter(x => x.activo).map(x => <label key={x.id} className="row" style={{ minHeight: 40 }}><input type="checkbox" checked={!!sel[x.id]} onChange={() => setSel({ ...sel, [x.id]: !sel[x.id] })} style={{ width: 20, height: 20, accentColor: 'var(--accent)' }} /><span className="avatar" style={{ width: 30, height: 30, fontSize: 13 }}>{x.nombre[0]}</span>{x.nombre}</label>)}
        </div>
        <span className="xs muted">Quitar a alguien no borra nada: deja de ver el perfil.</span>
        {err && <div className="error">{err}</div>}
        <div className="row" style={{ justifyContent: 'flex-end' }}><button type="button" className="btn" onClick={onClose}>Cancelar</button><button className="btn primary">Guardar</button></div>
      </form>
    </Modal>
  )
}
