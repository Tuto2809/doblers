import { useEffect, useRef, useState } from 'react'
import { useApp } from '../store'
import { Icon, Seg } from './ui'
import { supabase } from '../lib/supabase'

const TABS = [['resumen', 'Resumen', Icon.resumen], ['movimientos', 'Movimientos', Icon.movs], ['presupuesto', 'Presupuesto', Icon.pres], ['ajustes', 'Ajustes', Icon.ajustes]]

export function nombrePerfil(p) {
  return p ? (p.tipo === 'personal' ? 'Personal' : p.nombre) : '—'
}

export function SubPerfil({ p }) {
  const { miembrosDe, uid } = useApp()
  if (!p) return null
  if (p.tipo === 'personal') return 'Solo tú'
  const otros = miembrosDe(p.id).filter(u => u.id !== uid).map(u => u.nombre)
  return otros.length ? 'Compartido con ' + otros.join(', ') : 'Compartido'
}

function ListaPerfiles({ onPick }) {
  const { misPerfiles, perfilId, setPerfilId } = useApp()
  return (
    <div className="col" style={{ gap: 6 }}>
      {misPerfiles.map(p => (
        <button key={p.id} className="kpi" aria-pressed={p.id === perfilId} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: '8px 10px', borderWidth: 1 }}
          onClick={() => { if (p.id !== perfilId) setPerfilId(p.id); onPick?.() }}>
          <span className="avatar" style={{ width: 32, height: 32, fontSize: 13 }}>{nombrePerfil(p)[0]}</span>
          <span className="col" style={{ gap: 1 }}><strong style={{ fontSize: 14 }}>{nombrePerfil(p)}</strong><span className="xs muted"><SubPerfil p={p} /></span></span>
        </button>
      ))}
    </div>
  )
}

function Desplegable({ onClose, children, ancho = 300 }) {
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 30 }} onClick={onClose} />
      <div role="menu" className="card" style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 31, width: ancho, maxWidth: 'calc(100vw - 24px)', padding: 10, display: 'flex', flexDirection: 'column', gap: 6, boxShadow: 'var(--shadow)', animation: 'slidein .15s ease-out' }}>
        {children}
      </div>
    </>
  )
}

export default function Shell({ children }) {
  const { desktop, tab, setTab, me, setMe, perfil, aplicarTema, setToast } = useApp()
  const [menu, setMenu] = useState(false)
  const [perfilMenu, setPerfilMenu] = useState(false)
  const [cuentaMenu, setCuentaMenu] = useState(false)
  const timer = useRef(null)

  // El menú se cierra solo tras 8 s sin interacción
  const armar = () => { clearTimeout(timer.current); timer.current = setTimeout(() => setMenu(false), 8000) }
  useEffect(() => { if (menu) armar(); else clearTimeout(timer.current); return () => clearTimeout(timer.current) }, [menu])
  useEffect(() => { if (!desktop) setMenu(false) }, [desktop])

  const ir = t => { setTab(t); setMenu(false); window.scrollTo({ top: 0 }) }
  const tabs = me?.es_admin ? [...TABS, ['admin', 'Administración', Icon.admin]] : TABS

  return (
    <div className={'app' + (desktop ? ' desktop' : '')}>
      <header className="topbar">
        {desktop && <button className="btn icon" aria-label="Abrir menú" aria-expanded={menu} onClick={() => setMenu(true)}>{Icon.menu()}</button>}
        <button className="row" style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer', gap: 10 }} aria-label="Ir al resumen" onClick={() => ir('resumen')}>
          <span className="logo" aria-hidden="true">€</span>
          <strong style={{ fontSize: 16 }}>Cuentas Claras</strong>
        </button>
        <div style={{ marginLeft: 'auto', position: 'relative' }}>
          <button className="pill" style={{ height: 34, border: 0, cursor: 'pointer', fontSize: 13 }} aria-haspopup="menu" aria-expanded={perfilMenu} onClick={() => { setPerfilMenu(!perfilMenu); setCuentaMenu(false) }}>
            {perfil ? (perfil.tipo === 'personal' ? 'Personal' : perfil.nombre) : 'Sin perfil'} {Icon.chevron(14)}
          </button>
          {perfilMenu && <Desplegable onClose={() => setPerfilMenu(false)}><span className="section-label" style={{ padding: '4px 6px' }}>Ver el presupuesto de</span><ListaPerfiles onPick={() => setPerfilMenu(false)} /></Desplegable>}
        </div>
        <div style={{ position: 'relative' }}>
          <button className="avatar" style={{ width: 38, height: 38, border: 0, cursor: 'pointer', background: 'var(--accent)', color: 'var(--on-accent)' }} aria-label="Tu cuenta" aria-haspopup="menu" aria-expanded={cuentaMenu} onClick={() => { setCuentaMenu(!cuentaMenu); setPerfilMenu(false) }}>{(me?.nombre || '?')[0]}</button>
          {cuentaMenu && (
            <Desplegable onClose={() => setCuentaMenu(false)} ancho={290}>
              <div className="row" style={{ padding: '6px 6px 10px', borderBottom: '1px solid var(--border)' }}>
                <span className="avatar" style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>{(me?.nombre || '?')[0]}</span>
                <span className="col grow" style={{ gap: 1 }}><strong>{me?.nombre}</strong><span className="xs muted ellipsis">{me?.email}</span></span>
              </div>
              <button role="menuitem" className="navitem" onClick={() => { setCuentaMenu(false); ir('ajustes') }}>{Icon.edit(18)} Mi perfil y ajustes</button>
              {me?.es_admin && <button role="menuitem" className="navitem" onClick={() => { setCuentaMenu(false); ir('admin') }}>{Icon.admin(18)} Administración</button>}
              <div className="col" style={{ gap: 6, padding: '6px 4px' }}>
                <span className="xs bold muted">Tema</span>
                <Seg full label="Tema" valor={me?.tema} onChange={async t => { setCuentaMenu(false); setMe({ ...me, tema: t }); aplicarTema(t); const { error } = await supabase.from('pf_usuarios').update({ tema: t }).eq('id', me.id); if (error) setToast(error.message) }} opciones={[['claro', 'Claro'], ['oscuro', 'Oscuro'], ['sistema', 'Sistema']]} />
              </div>
              <button role="menuitem" className="navitem warn" style={{ borderTop: '1px solid var(--border)', borderRadius: 0, marginTop: 2 }} onClick={() => { setCuentaMenu(false); supabase.auth.signOut() }}>{Icon.close(18)} Cerrar sesión</button>
            </Desplegable>
          )}
        </div>
      </header>

      {desktop && menu && (
        <div className="drawer-wrap" onMouseMove={armar} onKeyDown={armar}>
          <aside className="drawer" aria-label="Menú">
            <button className="row" style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }} onClick={() => ir('resumen')}><span className="logo">€</span><strong style={{ fontSize: 16 }}>Cuentas Claras</strong></button>
            <nav className="col" style={{ gap: 4 }} aria-label="Secciones">
              {tabs.map(([k, t, ic]) => <button key={k} className="navitem" aria-current={tab === k ? 'page' : undefined} onClick={() => ir(k)}>{ic(20)}{t}</button>)}
            </nav>
            <div className="row small muted" style={{ marginTop: 'auto', padding: '0 8px' }}>
              <span className="avatar" style={{ width: 30, height: 30, background: 'var(--accent)', color: 'var(--on-accent)', fontSize: 13 }}>{(me?.nombre || '?')[0]}</span>
              <span className="grow">{me?.nombre}</span>
            </div>
          </aside>
          <button className="drawer-scrim" aria-label="Cerrar menú" onClick={() => setMenu(false)} />
        </div>
      )}

      <main className="main">{children}</main>

      {!desktop && (
        <nav className="bottomnav" aria-label="Secciones">
          {TABS.map(([k, t, ic]) => <button key={k} aria-current={tab === k || (k === 'ajustes' && tab === 'admin') ? 'page' : undefined} onClick={() => ir(k)}>{ic()}{t}</button>)}
        </nav>
      )}

    </div>
  )
}
