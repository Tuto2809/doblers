import { useEffect, useState } from 'react'
import { esDemo, supabase } from './lib/supabase'
import { AppProvider, useApp } from './store'
import Shell from './components/Shell'
import { Cargando, Toast } from './components/ui'
import Login from './pages/Login'
import Landing from './pages/Landing'
import Guia from './pages/Guia'
import { TourProvider, useTour } from './components/Tour'
import Resumen from './pages/Resumen'
import Movimientos from './pages/Movimientos'
import Presupuesto from './pages/Presupuesto'
import Ajustes from './pages/Ajustes'
import Admin from './pages/Admin'

// Registra cada entrada en la app (inicio de sesión o apertura; como mucho una cada 30 min)
function useRegistroConexion(me) {
  useEffect(() => {
    if (!me?.activo) return
    const clave = 'pf-conexion-' + me.id
    const registrar = () => {
      let login = false, ultima = 0
      try { login = sessionStorage.getItem('pf-login') === '1'; ultima = Number(localStorage.getItem(clave)) || 0 } catch {}
      if (!login && Date.now() - ultima < 30 * 60000) return
      try { sessionStorage.removeItem('pf-login'); localStorage.setItem(clave, String(Date.now())) } catch {}
      const app = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone
      const disp = (/iPhone|iPad|Android|Mobile/i.test(navigator.userAgent) ? 'Móvil' : 'Ordenador') + (app ? ' · app' : ' · navegador')
      supabase.from('pf_conexiones').insert({ tipo: login ? 'login' : 'apertura', dispositivo: disp }).then(() => {})
    }
    registrar()
    const vis = () => { if (document.visibilityState === 'visible') registrar() }
    document.addEventListener('visibilitychange', vis)
    return () => document.removeEventListener('visibilitychange', vis)
  }, [me?.id, me?.activo])
}

function Contenido() {
  const { me, cargando, error, tab, perfil, misPerfiles } = useApp()
  useRegistroConexion(me)
  const { setTab } = useApp()
  const { iniciar } = useTour()
  useEffect(() => {
    // Enlaces directos: ?guia abre la página de la guía y ?tour=<capítulo> lanza un recorrido
    const q = new URLSearchParams(location.search)
    if (q.has('guia')) setTab('guia')
    if (q.get('tour') && me?.activo) setTimeout(() => iniciar(q.get('tour')), 600)
  }, [me?.activo]) // eslint-disable-line
  useEffect(() => { localStorage.setItem('pf-tema-cache', document.documentElement.dataset.theme || 'claro') })
  if (error) return <div className="login"><div className="col" style={{ maxWidth: 420 }}><h1>Algo ha fallado</h1><div className="error">{error}</div><button className="btn" onClick={() => location.reload()}>Reintentar</button></div></div>
  if (!me && cargando) return <Cargando />
  if (!me || !me.activo) {
    return (
      <div className="login"><div className="col" style={{ maxWidth: 420, gap: 14 }}>
        <span className="logo" style={{ width: 48, height: 48, fontSize: 22 }}>€</span>
        <h1>Sin acceso</h1>
        <p className="muted">{!me ? 'Tu cuenta existe, pero no tiene acceso a Cuentas Claras. Pide al administrador que te dé de alta.' : 'Tu cuenta está desactivada. Habla con el administrador.'}</p>
        <button className="btn" onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>
      </div></div>
    )
  }
  const pagina = tab === 'guia' ? <Guia />
    : tab === 'admin' && me.es_admin ? <Admin />
    : tab === 'ajustes' ? <Ajustes />
    : !perfil && !cargando ? <div className="empty">{misPerfiles.length ? 'Elige un perfil.' : 'Todavía no perteneces a ningún perfil.'}</div>
    : tab === 'movimientos' ? <Movimientos />
    : tab === 'presupuesto' ? <Presupuesto />
    : <Resumen />
  return <Shell>{cargando ? <Cargando /> : pagina}<Toast /></Shell>
}

const RUTAS = { '/': 'inicio', '/entrar': 'entrar', '/solicitar': 'solicitar', '/info': 'info' }
const rutaActual = () => RUTAS[location.pathname.replace(/\/+$/, '') || '/'] || 'inicio'

function BandaDemo() {
  return (
    <div className="demo-band" role="status">
      <span>👀 Demo<span className="largo"> con datos de ejemplo</span></span>
      <a className="btn sm primary" href="/solicitar" style={{ textDecoration: 'none' }}>Pedir acceso</a>
      <a className="btn sm ghost" href="/" style={{ color: '#fff', textDecoration: 'none' }}>Salir</a>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(undefined)
  const [recuperar, setRecuperar] = useState(false)
  const [ruta, setRuta] = useState(rutaActual)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((ev, s) => {
      if (ev === 'PASSWORD_RECOVERY') setRecuperar(true)
      setSession(s)
    })
    const pop = () => setRuta(rutaActual())
    window.addEventListener('popstate', pop)
    return () => { sub.subscription.unsubscribe(); window.removeEventListener('popstate', pop) }
  }, [])
  const ir = r => { const path = Object.keys(RUTAS).find(k => RUTAS[k] === r) || '/'; history.pushState(null, '', path); setRuta(r); window.scrollTo(0, 0) }
  if (session === undefined) return <Cargando />
  if (recuperar) return <Login recuperar onListo={() => setRecuperar(false)} />
  if (!session) {
    if (ruta === 'inicio') return <Landing ir={ir} />
    return <Login key={ruta} inicial={ruta} onInicio={() => ir('inicio')} />
  }
  return <AppProvider key={session.user.id} session={session}><TourProvider><Contenido />{esDemo && <BandaDemo />}</TourProvider></AppProvider>
}
