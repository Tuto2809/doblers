import { useState } from 'react'
import { supabase, supabaseReal } from '../lib/supabase'

export default function Login({ recuperar, onListo, inicial = 'entrar', onInicio }) {
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [msg, setMsg] = useState(null)
  const [err, setErr] = useState(null)
  const [solicitar, setSolicitar] = useState(inicial === 'solicitar' || inicial === 'info' ? inicial : false)
  const [busy, setBusy] = useState(false)

  const entrar = async e => {
    e.preventDefault(); setErr(null); setBusy(true)
    try { sessionStorage.setItem('pf-login', '1') } catch {}
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pass })
    if (error) try { sessionStorage.removeItem('pf-login') } catch {}
    setBusy(false)
    if (error) setErr(error.message === 'Invalid login credentials' ? 'Email o contraseña incorrectos.' : error.message)
  }
  const olvido = async () => {
    setErr(null)
    if (!email.trim()) { setErr('Escribe tu email y vuelve a pulsar.'); return }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: location.origin + '/' })
    if (error) setErr(error.message); else setMsg('Si el email existe, recibirás un enlace para cambiar la contraseña. También puedes pedir al administrador una contraseña temporal.')
  }
  const nueva = async e => {
    e.preventDefault(); setErr(null)
    if (pass.length < 8) { setErr('Mínimo 8 caracteres.'); return }
    const { error } = await supabase.auth.updateUser({ password: pass })
    if (error) setErr(error.message); else onListo()
  }

  if (solicitar) return <SolicitarAcceso email0={email} tipo0={solicitar === 'info' ? 'info' : 'acceso'} onVolver={() => (inicial !== 'entrar' && onInicio ? onInicio() : setSolicitar(false))} onInicio={onInicio} />

  return (
    <div className="login">
      <form onSubmit={recuperar ? nueva : entrar}>
        <span className="logo" style={{ width: 52, height: 52, fontSize: 24, borderRadius: 14 }}>€</span>
        <h1>{recuperar ? 'Nueva contraseña' : 'Cuentas Claras'}</h1>
        <p className="muted" style={{ margin: 0 }}>{recuperar ? 'Elige la contraseña que usarás a partir de ahora.' : 'Entra con tu cuenta.'}</p>
        {!recuperar && <label className="field">Email<input className="input" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>}
        <label className="field">Contraseña<input className="input" type="password" autoComplete={recuperar ? 'new-password' : 'current-password'} value={pass} onChange={e => setPass(e.target.value)} required /></label>
        {err && <div className="error" role="alert">{err}</div>}
        {msg && <div className="notice" role="status">{msg}</div>}
        <button className="btn primary" style={{ height: 50 }} disabled={busy}>{recuperar ? 'Guardar contraseña' : busy ? 'Entrando…' : 'Entrar'}</button>
        {!recuperar && <button type="button" className="btn ghost" onClick={olvido}>He olvidado la contraseña</button>}
        {!recuperar && onInicio && <button type="button" className="btn ghost small" onClick={onInicio}>← Volver a la portada</button>}
        {!recuperar && <div className="col" style={{ gap: 8, paddingTop: 12, borderTop: '1px solid var(--border)', alignItems: 'center' }}>
          <span className="small muted">¿Todavía no tienes cuenta?</span>
          <button type="button" className="btn" style={{ width: '100%' }} onClick={() => setSolicitar('solicitar')}>Solicitar acceso</button>
        </div>}
      </form>
    </div>
  )
}

function SolicitarAcceso({ email0, tipo0 = 'acceso', onVolver, onInicio }) {
  const [tipo, setTipo] = useState(tipo0)
  const [nombre, setNombre] = useState(''), [email, setEmail] = useState(email0 || ''), [mensaje, setMensaje] = useState('')
  const [bot, setBot] = useState('')
  const [err, setErr] = useState(null), [busy, setBusy] = useState(false), [ok, setOk] = useState(false)
  const enviar = async e => {
    e.preventDefault(); setErr(null)
    if (bot) { setOk(true); return }
    setBusy(true)
    const datos = { tipo: tipo === 'info' ? 'Información' : 'Acceso', nombre: nombre.trim(), email: email.trim().toLowerCase(), mensaje: mensaje.trim() }
 // Se guarda en la base de datos y aparece en Administración
    const bd = supabaseReal.from('pf_solicitudes').insert({ tipo, nombre: datos.nombre, email: datos.email, mensaje: datos.mensaje || null }).then(({ error }) => !error)
    const b = await bd.catch(() => false)
    setBusy(false)
    if (b) setOk(true); else setErr('No se ha podido enviar la solicitud. Inténtalo de nuevo en un rato.')
  }
  return (
    <div className="login">
      {ok ? (
        <div className="col" style={{ gap: 14, width: '100%', maxWidth: 380, alignItems: 'center', textAlign: 'center' }}>
          <span className="logo" style={{ width: 52, height: 52, fontSize: 24, borderRadius: 14 }}>€</span>
          <h1>{tipo === 'info' ? '¡Gracias!' : 'Solicitud enviada'}</h1>
          <p className="muted" style={{ margin: 0 }}>{tipo === 'info' ? 'Hemos recibido tu mensaje y te escribiremos pronto con más información.' : 'Hemos recibido tu petición. Cuando tu cuenta esté creada te daremos el acceso.'}</p>
          <button className="btn primary" style={{ height: 50, width: '100%' }} onClick={onInicio || onVolver}>{onInicio ? 'Volver a la portada' : 'Volver al inicio de sesión'}</button>
          <a className="btn" style={{ width: '100%', textDecoration: 'none', justifyContent: 'center' }} href="/demo">Mientras tanto, prueba la demo</a>
        </div>
      ) : (
        <form onSubmit={enviar}>
          <span className="logo" style={{ width: 52, height: 52, fontSize: 24, borderRadius: 14 }}>€</span>
          <h1>{tipo === 'info' ? 'Pedir información' : 'Solicitar acceso'}</h1>
          <div className="seg" role="group" aria-label="Qué quieres">
            <button type="button" aria-pressed={tipo === 'acceso'} onClick={() => setTipo('acceso')}>Quiero acceso</button>
            <button type="button" aria-pressed={tipo === 'info'} onClick={() => setTipo('info')}>Quiero información</button>
          </div>
          <p className="muted" style={{ margin: 0 }}>{tipo === 'info' ? 'Cuéntanos qué te interesa y te escribimos con todos los detalles.' : 'Déjanos tu nombre y tu email y te crearemos una cuenta en Cuentas Claras.'}</p>
          <label className="field">Nombre<input className="input" autoFocus autoComplete="name" value={nombre} onChange={e => setNombre(e.target.value)} required maxLength={120} /></label>
          <label className="field">Email<input className="input" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required maxLength={200} /></label>
          <label className="field">{tipo === 'info' ? 'Tu pregunta (opcional)' : 'Mensaje (opcional)'}<textarea className="input" rows={3} value={mensaje} onChange={e => setMensaje(e.target.value)} maxLength={1000} style={{ height: 'auto', paddingTop: 10 }} placeholder={tipo === 'info' ? '¿Qué te gustaría saber?' : 'Por ejemplo: si es para ti o para compartir en familia'} /></label>
          <input name="bot-field" value={bot} onChange={e => setBot(e.target.value)} tabIndex={-1} autoComplete="off" style={{ position: 'absolute', left: -9999, width: 1, height: 1, opacity: 0 }} aria-hidden="true" />
          {err && <div className="error" role="alert">{err}</div>}
          <button className="btn primary" style={{ height: 50 }} disabled={busy}>{busy ? 'Enviando…' : tipo === 'info' ? 'Enviar' : 'Enviar solicitud'}</button>
          <button type="button" className="btn ghost" onClick={onVolver}>Volver</button>
        </form>
      )}
    </div>
  )
}
