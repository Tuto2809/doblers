import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase, fetchAll } from './lib/supabase'
import { periodoInicial } from './lib/period'
import { catMap, indicePresupuesto } from './lib/calc'

const Ctx = createContext(null)
export const useApp = () => useContext(Ctx)

function useIsDesktop() {
  const q = '(min-width: 1000px)'
  const [d, setD] = useState(() => window.matchMedia(q).matches)
  useEffect(() => {
    const mq = window.matchMedia(q)
    const h = () => setD(mq.matches)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [])
  return d
}

function aplicarTema(tema) {
  const oscuro = tema === 'oscuro' || (tema === 'sistema' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = oscuro ? 'oscuro' : 'claro'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', oscuro ? '#0D0F13' : '#3B4CF5')
}

export function AppProvider({ session, children }) {
  const uid = session.user.id
  const desktop = useIsDesktop()
  const [me, setMe] = useState(null)
  const [perfiles, setPerfiles] = useState([])
  const [miembros, setMiembros] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [perfilId, setPerfilIdState] = useState(() => localStorage.getItem('pf-perfil') || null)
  const [categorias, setCategorias] = useState([])
  const [movimientos, setMovimientos] = useState([])
  const [presupuestos, setPresupuestos] = useState([])
  const [saldos, setSaldos] = useState({})
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [periodo, setPeriodo] = useState(periodoInicial)
  const [tab, setTab] = useState('resumen')
  const [toast, setToastMsg] = useState(null)
  const [filtroInicial, setFiltroInicial] = useState(null) // para saltar de Resumen a Movimientos filtrados

  const setToast = useCallback(msg => { setToastMsg(msg); setTimeout(() => setToastMsg(null), 3500) }, [])

  const cargarBase = useCallback(async () => {
    const [{ data: u, error: e1 }, { data: ps, error: e2 }, { data: ms, error: e3 }, { data: us }] = await Promise.all([
      supabase.from('pf_usuarios').select('*').eq('id', uid).maybeSingle(),
      supabase.from('pf_perfiles').select('*').order('tipo', { ascending: false }).order('nombre'),
      supabase.from('pf_perfil_miembros').select('*'),
      supabase.from('pf_usuarios').select('id, nombre, email, es_admin, activo'),
    ])
    if (e1 || e2 || e3) throw e1 || e2 || e3
    setMe(u)
    setMiembros(ms || [])
    setUsuarios(us || [])
    // Solo los perfiles de los que soy miembro (el admin ve el resto solo en Administración)
    const mios = (ps || []).filter(p => (ms || []).some(m => m.perfil_id === p.id && m.user_id === uid))
    setPerfiles(ps || [])
    return { u, mios }
  }, [uid])

  const misPerfiles = useMemo(
    () => perfiles.filter(p => miembros.some(m => m.perfil_id === p.id && m.user_id === uid)).sort((a, b) => (a.tipo === b.tipo ? a.nombre.localeCompare(b.nombre) : a.tipo === 'personal' ? -1 : 1)),
    [perfiles, miembros, uid]
  )

  const cargarPerfil = useCallback(async pid => {
    if (!pid) { setCategorias([]); setMovimientos([]); setPresupuestos([]); setSaldos({}); return }
    const [cats, movs, pres] = await Promise.all([
      fetchAll(() => supabase.from('pf_categorias').select('*').eq('perfil_id', pid).order('nombre')),
      fetchAll(() => supabase.from('pf_movimientos').select('*').eq('perfil_id', pid).order('fecha', { ascending: false }).order('created_at', { ascending: false })),
      fetchAll(() => supabase.from('pf_presupuestos').select('*').eq('perfil_id', pid)),
    ])
    supabase.from('pf_saldos').select('*').eq('perfil_id', pid).then(({ data }) => setSaldos(Object.fromEntries((data || []).map(r => [`${r.anyo}|${r.mes || 1}`, Number(r.importe)]))))
    setCategorias([...cats].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })))
    setMovimientos(movs.map(m => ({ ...m, importe: Number(m.importe) })))
    setPresupuestos(pres.map(p => ({ ...p, importe: Number(p.importe) })))
  }, [])

  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        setCargando(true)
        const { u, mios } = await cargarBase()
        if (!vivo) return
        if (u) aplicarTema(u.tema)
        const ordenados = mios.sort((a, b) => (a.tipo === 'personal' ? -1 : 1) - (b.tipo === 'personal' ? -1 : 1))
        const pid = ordenados.some(p => p.id === perfilId) ? perfilId : ordenados[0]?.id || null
        setPerfilIdState(pid)
        await cargarPerfil(pid)
      } catch (e) {
        if (vivo) setError(e.message || String(e))
      } finally {
        if (vivo) setCargando(false)
      }
    })()
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid])

  useEffect(() => {
    if (!me) return
    aplicarTema(me.tema)
    if (me.tema !== 'sistema') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const h = () => aplicarTema('sistema')
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [me])

  const setPerfilId = useCallback(async pid => {
    setPerfilIdState(pid)
    localStorage.setItem('pf-perfil', pid)
    setCargando(true)
    try { await cargarPerfil(pid) } catch (e) { setError(e.message) } finally { setCargando(false) }
  }, [cargarPerfil])

  const recargar = useCallback(async () => {
    try { await cargarPerfil(perfilId) } catch (e) { setToast('Error al recargar: ' + e.message) }
  }, [cargarPerfil, perfilId, setToast])

  const recargarBase = useCallback(async () => { await cargarBase() }, [cargarBase])

  const perfil = misPerfiles.find(p => p.id === perfilId) || null
  const cmap = useMemo(() => catMap(categorias), [categorias])
  const idxPres = useMemo(() => indicePresupuesto(presupuestos), [presupuestos])
  const miembrosDe = useCallback(pid => miembros.filter(m => m.perfil_id === pid).map(m => usuarios.find(u => u.id === m.user_id)).filter(Boolean), [miembros, usuarios])

  const value = {
    session, uid, me, setMe, desktop, perfiles, misPerfiles, miembros, usuarios, miembrosDe, perfil, perfilId, setPerfilId,
    categorias, setCategorias, cmap, movimientos, setMovimientos, presupuestos, setPresupuestos, idxPres, saldos, setSaldos,
    cargando, error, periodo, setPeriodo, tab, setTab, toast, setToast, recargar, recargarBase, aplicarTema,
    filtroInicial, setFiltroInicial,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
