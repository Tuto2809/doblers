import { useState } from 'react'
import { CAPITULOS } from '../lib/guia'
import { capitulosHechos, useTour } from '../components/Tour'
import { useApp } from '../store'

// Clip animado del capítulo (si existe); si no, el icono
function Media({ c }) {
  const [error, setError] = useState(false)
  return (
    <div className="guia-media">
      {!error ? <video src={`/guia/${c.id}.mp4`} poster={`/guia/${c.id}.jpg`} autoPlay muted loop playsInline preload="metadata" onError={() => setError(true)} aria-label={`Ejemplo: ${c.titulo}`} />
        : <span className="guia-ic" aria-hidden="true">{c.icono}</span>}
    </div>
  )
}

export default function Guia() {
  const { iniciar } = useTour()
  const { desktop } = useApp()
  const hechos = capitulosHechos()
  return (
    <div className="col" style={{ gap: 20 }}>
      <header className="col" style={{ gap: 4 }}>
        <h1>Guía de uso</h1>
        <span className="muted">Capítulos cortos que te enseñan la app sobre la propia app. Elige uno y pulsa «Hazlo conmigo».</span>
      </header>
      <div className="guia-hero">
        <div>
          <strong style={{ fontSize: desktop ? 22 : 19 }}>¿Primera vez? Empieza aquí</strong>
          <p>Un recorrido de 2 minutos por lo básico.</p>
        </div>
        <button className="btn" onClick={() => iniciar('primeros')}>Empezar la guía →</button>
      </div>
      <div className="guia-grid">
        {CAPITULOS.map(c => (
          <article key={c.id} className="guia-card">
            <div style={{ position: 'relative' }}>
              <Media c={c} />
              {hechos.includes(c.id) && <span className="guia-hecho">✓ Hecho</span>}
            </div>
            <div className="guia-body">
              <span className="xs muted">{c.icono} {c.min} min · {c.pasos.length} pasos</span>
              <strong style={{ fontSize: 17 }}>{c.titulo}</strong>
              <p>{c.resumen}</p>
              <button className="btn primary" style={{ marginTop: 'auto', alignSelf: 'flex-start' }} onClick={() => iniciar(c.id)}>Hazlo conmigo</button>
            </div>
          </article>
        ))}
      </div>
      <span className="xs muted">Consejo: el botón <strong>?</strong> de arriba abre siempre la guía de la pantalla en la que estés.</span>
    </div>
  )
}
