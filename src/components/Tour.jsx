import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useApp } from '../store'
import { CAPITULOS } from '../lib/guia'

// Recorrido guiado: oscurece la pantalla, ilumina un elemento real de la app y explica qué es.
// Algunos pasos esperan a que la persona haga clic ella misma en lo iluminado.
const TourCtx = createContext({ iniciar: () => {}, activo: null })
export const useTour = () => useContext(TourCtx)

const HECHOS = 'pf-guia-hechos'
export const capitulosHechos = () => { try { return JSON.parse(localStorage.getItem(HECHOS) || '[]') } catch { return [] } }
const marcarHecho = id => { try { const h = new Set(capitulosHechos()); h.add(id); localStorage.setItem(HECHOS, JSON.stringify([...h])) } catch {} }

const buscar = (sel, desktop) => {
  const s = Array.isArray(sel) ? (desktop ? sel[0] : sel[1]) : sel
  if (!s) return null
  const lista = document.querySelectorAll(s.startsWith('[') || s.startsWith('.') || s.startsWith('#') ? s : `[data-tour="${s}"]`)
  for (const el of lista) { const r = el.getBoundingClientRect(); if (r.width > 0 && r.height > 0) return el }
  return null
}

export function TourProvider({ children }) {
  const app = useApp()
  const [cap, setCap] = useState(null) // { id, pasos }
  const [i, setI] = useState(0)
  const [rect, setRect] = useState(null)
  const [hecho, setHecho] = useState(false) // paso de "hazlo tú" completado
  const elRef = useRef(null)

  const iniciar = useCallback(id => {
    const c = CAPITULOS.find(x => x.id === id); if (!c) return
    document.querySelectorAll('.modal-wrap').forEach(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))
    setCap(c); setI(0)
  }, [])
  const cerrar = useCallback(() => { setCap(null); setRect(null); elRef.current = null }, [])

  const paso = cap?.pasos[i]
  const desktop = app.desktop

  // Preparar el paso: cambiar de pestaña, ejecutar acciones previas y localizar el elemento
  useEffect(() => {
    if (!paso) return
    let vivo = true
    setHecho(false); setRect(null); elRef.current = null
    if (paso.tab && app.tab !== paso.tab) app.setTab(paso.tab)
    ;(async () => {
      await new Promise(r => setTimeout(r, paso.tab && app.tab !== paso.tab ? 350 : 60))
      if (paso.antes) { try { await paso.antes({ app, desktop, buscar: s => buscar(s, desktop) }) } catch {} await new Promise(r => setTimeout(r, 250)) }
      let el = null
      for (let t = 0; t < 30 && vivo && paso.sel; t++) { el = buscar(paso.sel, desktop); if (el) break; await new Promise(r => setTimeout(r, 100)) }
      if (!vivo) return
      elRef.current = el
      if (el) {
        const r = el.getBoundingClientRect()
        if (r.top < 70 || r.bottom > window.innerHeight - (desktop ? 20 : 170)) el.scrollIntoView({ block: r.height > window.innerHeight * 0.55 ? 'start' : 'center', behavior: 'smooth' })
        await new Promise(r => setTimeout(r, 350))
        if (vivo) setRect(el.getBoundingClientRect())
      } else setRect(null)
    })()
    return () => { vivo = false }
  }, [cap, i]) // eslint-disable-line

  // Seguir al elemento si la página se mueve
  useEffect(() => {
    if (!paso) return
    let raf
    let cuenta = 0
    const loop = () => {
      // Si el elemento se ha vuelto a dibujar (por ejemplo, una ventana que se abre), se vuelve a buscar
      if (paso.sel && (!elRef.current || !elRef.current.isConnected || (++cuenta % 15 === 0))) { const nuevo = buscar(paso.sel, desktop); if (nuevo) elRef.current = nuevo }
      const el = elRef.current; if (el && el.isConnected) { const r = el.getBoundingClientRect(); setRect(p => (!p || Math.abs(p.top - r.top) > 0.5 || Math.abs(p.left - r.left) > 0.5 || Math.abs(p.height - r.height) > 0.5 || Math.abs(p.width - r.width) > 0.5 ? r : p)) } raf = requestAnimationFrame(loop) }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [paso, desktop])

  // Pasos "hazlo tú": avanzar cuando la persona pulsa lo iluminado
  useEffect(() => {
    if (!paso?.clic) return
    const h = e => {
      const el = elRef.current
      if (el && (el === e.target || el.contains(e.target))) { setHecho(true); setTimeout(() => siguiente(), paso.espera ?? 700) }
    }
    document.addEventListener('click', h, true)
    return () => document.removeEventListener('click', h, true)
  }, [paso, i]) // eslint-disable-line

  useEffect(() => {
    if (!cap) return
    const h = e => { if (!e.isTrusted) return; if (e.key === 'Escape' && !document.querySelector('.modal-wrap') && !document.querySelector('[role="menu"]')) cerrar(); if (e.key === 'ArrowRight' && !paso?.clic) siguiente(); if (e.key === 'ArrowLeft') atras() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }) // eslint-disable-line

  function siguiente() {
    if (!cap) return
    if (paso?.despues) { try { paso.despues() } catch {} }
    if (i + 1 < cap.pasos.length) setI(i + 1)
    else { marcarHecho(cap.id); setI(cap.pasos.length) }
  }
  function atras() { if (i > 0) setI(i - 1) }

  const fin = cap && i >= cap.pasos.length
  const siguienteCap = fin ? CAPITULOS[CAPITULOS.findIndex(c => c.id === cap.id) + 1] : null

  return (
    <TourCtx.Provider value={{ iniciar, activo: cap?.id || null }}>
      {children}
      {cap && <Capa rect={fin ? null : rect} paso={fin ? null : paso} n={i} total={cap.pasos.length} titulo={cap.titulo} desktop={desktop} hecho={hecho}
        fin={fin} siguienteCap={siguienteCap}
        onSiguiente={siguiente} onAtras={atras} onCerrar={cerrar}
        onOtro={id => { cerrar(); setTimeout(() => iniciar(id), 50) }} onGuia={() => { cerrar(); app.setTab('guia'); window.scrollTo({ top: 0 }) }} />}
    </TourCtx.Provider>
  )
}

function Capa({ rect, paso, n, total, titulo, desktop, hecho, fin, siguienteCap, onSiguiente, onAtras, onCerrar, onOtro, onGuia }) {
  const boxRef = useRef(null)
  const [pos, setPos] = useState({})
  const vw = window.innerWidth, vh = window.innerHeight
  const P = 6
  const hueco = rect ? { top: rect.top - P, left: rect.left - P, width: rect.width + 2 * P, height: rect.height + 2 * P } : null

  useLayoutEffect(() => {
    const b = boxRef.current; if (!b) return
    const w = Math.min(380, vw - 24), h = b.offsetHeight
    if (!hueco) { setPos({ left: (vw - w) / 2, top: Math.max(16, (vh - h) / 2), width: w }); return }
    if (!desktop) {
      const centro = hueco.top + hueco.height / 2
      const abajo = centro < vh * 0.5
      setPos(abajo ? { left: 12, width: vw - 24, top: Math.min(vh - h - 92, Math.max(hueco.top + hueco.height + 12, 70)) } : { left: 12, width: vw - 24, top: Math.max(70, Math.min(hueco.top - h - 12, vh - h - 92)) })
      return
    }
    let top = hueco.top + hueco.height + 14
    if (top + h > vh - 12) top = hueco.top - h - 14
    if (top < 12) { // no cabe ni arriba ni abajo: al lado
      top = Math.max(12, Math.min(vh - h - 12, hueco.top))
      const izq = hueco.left + hueco.width + 14
      const left = izq + w < vw - 12 ? izq : Math.max(12, hueco.left - w - 14)
      setPos({ left, top, width: w }); return
    }
    const left = Math.max(12, Math.min(vw - w - 12, hueco.left + hueco.width / 2 - w / 2))
    setPos({ left, top, width: w })
  }, [rect?.top, rect?.left, rect?.width, rect?.height, n, fin, desktop, vw, vh]) // eslint-disable-line

  return (
    <div className="tour" aria-live="polite">
      {hueco ? <div className={'tour-hole' + (paso?.clic && !hecho ? ' pulse' : '')} style={hueco} /> : <div className="tour-dim" />}
      <div ref={boxRef} className="tour-box" role="dialog" aria-label={titulo} style={pos}>
        {fin ? (
          <>
            <span className="tour-emoji">🎉</span>
            <strong className="tour-t">¡Capítulo completado!</strong>
            <span className="tour-x">Ya sabes {titulo.toLowerCase()}.{siguienteCap ? ` ¿Seguimos con «${siguienteCap.titulo}»?` : ' Has terminado todos los capítulos.'}</span>
            <div className="row wrap" style={{ gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn sm ghost" onClick={onGuia}>Ver la guía</button>
              {siguienteCap ? <button className="btn sm primary" onClick={() => onOtro(siguienteCap.id)}>Siguiente capítulo →</button> : <button className="btn sm primary" onClick={onCerrar}>Cerrar</button>}
            </div>
          </>
        ) : paso && (
          <>
            <div className="row between" style={{ gap: 8 }}>
              <span className="tour-cap">{titulo} · {n + 1}/{total}</span>
              <button className="tour-close" aria-label="Salir de la guía" onClick={onCerrar}>✕</button>
            </div>
            <div className="tour-bar"><span style={{ width: ((n + 1) / total) * 100 + '%' }} /></div>
            <strong className="tour-t">{paso.titulo}</strong>
            <span className="tour-x">{paso.texto}</span>
            {paso.clic && <span className={'tour-hazlo' + (hecho ? ' ok' : '')}>{hecho ? '✓ ¡Muy bien!' : `👆 ${paso.clic === true ? 'Pulsa lo que está iluminado' : paso.clic}`}</span>}
            <div className="row" style={{ gap: 8, justifyContent: 'space-between', marginTop: 2 }}>
              <button className="btn sm ghost" onClick={onAtras} disabled={n === 0} style={{ visibility: n === 0 ? 'hidden' : 'visible' }}>← Atrás</button>
              <button className={'btn sm ' + (paso.clic ? 'ghost' : 'primary')} onClick={onSiguiente}>{paso.clic ? 'Saltar' : n + 1 === total ? 'Terminar' : 'Siguiente →'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
