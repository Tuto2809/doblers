import { useEffect, useMemo, useRef, useState } from 'react'

// Portada pública, visual e interactiva: lleva a la demo, al inicio de sesión o a pedir acceso / información
const eur = n => Math.round(n).toLocaleString('es-ES', { useGrouping: 'always' }) + ' €'
const MES = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']

// Aparece al entrar en pantalla
function Reveal({ children, delay = 0, className = '', as: Tag = 'div', ...rest }) {
  const ref = useRef(null)
  const [vis, setVis] = useState(false)
  useEffect(() => {
    const el = ref.current; if (!el) return
    if (!('IntersectionObserver' in window)) { setVis(true); return }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVis(true); io.disconnect() } }, { threshold: 0.15 })
    io.observe(el); return () => io.disconnect()
  }, [])
  return <Tag ref={ref} className={'rv ' + (vis ? 'in ' : '') + className} style={{ transitionDelay: delay + 'ms' }} {...rest}>{children}</Tag>
}

// Número que cuenta hasta su valor
function Cuenta({ valor, dur = 1100, fmt = eur }) {
  const [v, setV] = useState(0)
  const desde = useRef(0)
  useEffect(() => {
    const ini = desde.current, t0 = performance.now(); let raf
    const paso = t => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); const x = ini + (valor - ini) * e; setV(x); desde.current = x; if (k < 1) raf = requestAnimationFrame(paso) }
    raf = requestAnimationFrame(paso); return () => cancelAnimationFrame(raf)
  }, [valor, dur])
  return <>{fmt(v)}</>
}

function MiniApp() {
  const [mes, setMes] = useState(10)
  const gastos = [1520, 1610, 1480, 1790, 1550, 1700, 2350, 2210, 1580, 1640, 1284, 0]
  const pres = 1900
  const g = gastos[mes] || 0
  return (
    <div className="lp-mock">
      <div className="lp-mock-top"><span className="logo" style={{ width: 26, height: 26, fontSize: 13, borderRadius: 7 }}>€</span><strong>Cuentas Claras</strong><span className="lp-chip">Casa y niños</span></div>
      <div className="lp-hero-card">
        <span className="small" style={{ opacity: .85 }}>Gastado en {['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][mes]}</span>
        <span className="lp-big"><Cuenta valor={g} dur={700} /> <span style={{ fontSize: 15, fontWeight: 500, opacity: .8 }}>de {eur(pres)}</span></span>
        <span className="lp-track"><span style={{ width: Math.min(100, (g / pres) * 100) + '%', background: g > pres ? '#FFB38A' : undefined }} /></span>
        <span className="xs" style={{ opacity: .9 }}>{g > pres ? `Te has pasado ${eur(g - pres)}` : `Quedan ${eur(pres - g)}`}</span>
      </div>
      <div className="lp-chart">
        {gastos.map((b, i) => (
          <button key={i} type="button" className={(i === mes ? 'act ' : '') + (b > pres ? 'over' : '')} style={{ '--h': (b / 2500) * 100 + '%', animationDelay: 300 + i * 60 + 'ms' }} onMouseEnter={() => setMes(i)} onClick={() => setMes(i)} aria-label={`Ver ${MES[i]}`}>
            <i style={{ bottom: (pres / 2500) * 100 + '%' }} />
          </button>
        ))}
      </div>
      <div className="lp-mesrow">{MES.map((m, i) => <span key={i} style={{ fontWeight: i === mes ? 800 : 500, color: i === mes ? 'var(--accent)' : undefined }}>{m}</span>)}</div>
      <div className="lp-alert"><span>!</span><span>{gastos[mes] > pres ? <><strong>Vacaciones</strong> dispara el gasto este mes</> : <><strong>Restaurantes</strong> va un 12 % por encima</>}</span></div>
      <span className="lp-hint">Pasa el ratón o toca las barras</span>
    </div>
  )
}

// Simulador: el visitante mueve los deslizadores y ve su ahorro y su liquidez
function Simulador() {
  const [ing, setIng] = useState(2400)
  const [gs, setGs] = useState({ Vivienda: 850, Comida: 450, Transporte: 160, Ocio: 220, Otros: 250 })
  const colores = { Vivienda: '#3B82F6', Comida: '#8B5CF6', Transporte: '#F59E0B', Ocio: '#F97316', Otros: '#14B8A6' }
  const total = Object.values(gs).reduce((a, b) => a + b, 0)
  const bal = ing - total
  const extras = [0, 0, 0, 0, 0, 300, 900, 600, 0, 0, 0, 350] // gastos puntuales: vacaciones, Navidad…
  const serie = useMemo(() => { let s = 1000; return extras.map(x => (s += bal - x)) }, [bal])
  const min = Math.min(0, ...serie), max = Math.max(1, ...serie)
  const W = 520, H = 170, P = 10
  const x = i => P + (i / 11) * (W - 2 * P), y = v => P + ((max - v) / (max - min || 1)) * (H - 2 * P)
  const linea = serie.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ')
  const peor = serie.reduce((a, v, i) => (v < serie[a] ? i : a), 0)
  return (
    <div className="lp-sim">
      <div className="col" style={{ gap: 16 }}>
        <label className="lp-sl"><span className="row between"><span>Ingresos al mes</span><strong style={{ color: 'var(--ok)' }}>{eur(ing)}</strong></span>
          <input type="range" min="800" max="6000" step="50" value={ing} onChange={e => setIng(+e.target.value)} style={{ '--c': '#10B981', '--p': ((ing - 800) / 5200) * 100 + '%' }} /></label>
        {Object.entries(gs).map(([k, v]) => (
          <label key={k} className="lp-sl"><span className="row between"><span><i style={{ background: colores[k] }} />{k}</span><strong>{eur(v)}</strong></span>
            <input type="range" min="0" max="1500" step="10" value={v} onChange={e => setGs({ ...gs, [k]: +e.target.value })} style={{ '--c': colores[k], '--p': (v / 1500) * 100 + '%' }} /></label>
        ))}
      </div>
      <div className="col" style={{ gap: 14 }}>
        <div className="lp-stack" aria-label="Reparto de tus ingresos">
          {Object.entries(gs).map(([k, v]) => <span key={k} title={`${k}: ${eur(v)}`} style={{ width: (v / Math.max(ing, total)) * 100 + '%', background: colores[k] }} />)}
          {bal > 0 && <span style={{ width: (bal / ing) * 100 + '%', background: 'repeating-linear-gradient(45deg, #10B98155 0 6px, #10B98122 6px 12px)' }} title="Te sobra" />}
        </div>
        <div className="lp-res">
          <div><span className="xs muted">Balance al mes</span><strong className={bal < 0 ? 'neg' : 'pos'}><Cuenta valor={bal} dur={400} fmt={v => (v > 0 ? '+' : '') + eur(v)} /></strong></div>
          <div><span className="xs muted">En un año</span><strong className={serie[11] - 1000 < 0 ? 'neg' : 'pos'}><Cuenta valor={serie[11] - 1000} dur={400} fmt={v => (v > 0 ? '+' : '') + eur(v)} /></strong></div>
        </div>
        <div className="lp-liq">
          <span className="xs muted">Tu saldo mes a mes (con vacaciones y Navidad incluidas)</span>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="none" style={{ height: 150, display: 'block' }}>
            <defs><linearGradient id="lpg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--accent)" stopOpacity=".35" /><stop offset="1" stopColor="var(--accent)" stopOpacity="0" /></linearGradient>
              <clipPath id="lp-neg"><rect x="0" y={y(0)} width={W} height={Math.max(0, H - y(0))} /></clipPath></defs>
            <path d={`${linea} L${x(11)} ${y(min)} L${x(0)} ${y(min)} Z`} fill="url(#lpg)" />
            <path d={`${linea} L${x(11)} ${y(0)} L${x(0)} ${y(0)} Z`} fill="#EF4444" opacity=".25" clipPath="url(#lp-neg)" />
            <line x1={P} x2={W - P} y1={y(0)} y2={y(0)} stroke="currentColor" strokeOpacity=".3" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
            <path d={linea} fill="none" stroke="var(--accent)" strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinejoin="round" style={{ transition: 'd .4s ease' }} />
            {serie.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={i === peor ? 5 : 3} fill={v < 0 ? '#EF4444' : 'var(--accent)'} style={{ transition: 'cy .4s ease' }} />)}
          </svg>
          <div className="lp-mesrow">{MES.map((m, i) => <span key={i}>{m}</span>)}</div>
          <span className={'small ' + (serie[peor] < 0 ? 'neg' : 'pos')} style={{ fontWeight: 600 }}>
            {serie[peor] < 0 ? `⚠️ En ${['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][peor]} te quedarías en ${eur(serie[peor])}. Cuentas Claras te avisa con meses de antelación.` : `✓ Ningún mes en negativo. Punto más bajo: ${eur(serie[peor])}.`}
          </span>
        </div>
      </div>
    </div>
  )
}

const FUNCIONES = [
  { k: 'banco', t: 'Importa el banco', d: 'Sube el Excel de tu banco. Detecta lo que ya está apuntado, separa los pendientes y te sugiere la categoría de cada movimiento.' },
  { k: 'avisos', t: 'Avisos', d: 'Si una categoría se dispara, hay movimientos sin clasificar o viene un mes en rojo, lo verás nada más entrar.' },
  { k: 'familia', t: 'Personal y familia', d: 'Tu presupuesto es privado. Para los gastos comunes, un presupuesto compartido con quien tú quieras.' },
  { k: 'export', t: 'Excel y PDF', d: 'Descarga lo que estás viendo o todo el histórico, con un diseño limpio listo para enviar.' },
]
function VisualFuncion({ k }) {
  if (k === 'banco') return (
    <div className="lp-fv">
      {[['Mercadona', '-62,40 €', 'Supermercado', 'nuevo'], ['Nómina', '+2.150,00 €', 'Nómina', 'ya'], ['Gasolinera', '-48,10 €', 'Transporte', 'nuevo'], ['Netflix', '-12,99 €', 'Suscripciones', 'pend']].map(([c, i, cat, e], n) => (
        <div key={c} className="lp-row" style={{ animationDelay: n * 120 + 'ms' }}>
          <span className={'lp-dot ' + e} /><span className="grow"><strong>{c}</strong><span className="xs muted"> · {cat}{e === 'nuevo' ? ' (sugerida)' : ''}</span></span>
          <span className={'lp-tag ' + e}>{e === 'nuevo' ? 'Nuevo' : e === 'ya' ? 'Ya en la app' : 'Pendiente'}</span><strong className={i.startsWith('+') ? 'pos' : ''}>{i}</strong>
        </div>
      ))}
    </div>
  )
  if (k === 'avisos') return (
    <div className="lp-fv">
      {[['warn', 'Restaurantes supera el presupuesto', '+42 € por encima'], ['warn', 'Saldo previsto en negativo en julio', 'El punto más bajo será −310 €'], ['info', '2 movimientos sin categoría', 'Asígnales una categoría']].map(([t, a, b], n) => (
        <div key={a} className={'lp-row lp-av ' + t} style={{ animationDelay: n * 140 + 'ms' }}><span className="lp-avi">!</span><span className="grow col"><strong>{a}</strong><span className="xs muted">{b}</span></span><span className="lp-ok">✓</span></div>
      ))}
    </div>
  )
  if (k === 'familia') return (
    <div className="lp-fv lp-fam">
      {[['Personal de Laura', 'Solo tú', '#3B82F6'], ['Personal de Marc', 'Solo Marc', '#8B5CF6'], ['Casa y niños', 'Laura y Marc', '#10B981']].map(([n, q, c], i) => (
        <div key={n} className="lp-perfil" style={{ animationDelay: i * 140 + 'ms', borderColor: c }}><span className="lp-av2" style={{ background: c }}>{n.split(' ').pop()[0]}</span><strong>{n}</strong><span className="xs muted">{q}</span></div>
      ))}
    </div>
  )
  return (
    <div className="lp-fv lp-docs">
      <div className="lp-doc x" style={{ animationDelay: '0ms' }}><span>XLSX</span><i /><i /><i /><i /></div>
      <div className="lp-doc p" style={{ animationDelay: '150ms' }}><span>PDF</span><b /><i /><i /><i /></div>
    </div>
  )
}

export default function Landing({ ir }) {
  const [scrolled, setScrolled] = useState(false)
  const [fn, setFn] = useState('banco')
  const [auto, setAuto] = useState(true)
  useEffect(() => { const f = () => setScrolled(window.scrollY > 8); f(); window.addEventListener('scroll', f, { passive: true }); return () => window.removeEventListener('scroll', f) }, [])
  useEffect(() => { if (!auto) return; const t = setInterval(() => setFn(f => FUNCIONES[(FUNCIONES.findIndex(x => x.k === f) + 1) % FUNCIONES.length].k), 4500); return () => clearInterval(t) }, [auto])
  const a = id => e => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }) }
  const actual = FUNCIONES.find(x => x.k === fn)
  return (
    <div className="lp">
      <div className="lp-blobs" aria-hidden="true"><span className="lp-blob b1" /><span className="lp-blob b2" /><span className="lp-blob b3" /></div>
      <header className={'lp-nav' + (scrolled ? ' sc' : '')}>
        <div className="lp-wrap row between">
          <a href="/" className="row" style={{ gap: 10, color: 'inherit', textDecoration: 'none' }}><span className="logo" style={{ width: 34, height: 34, fontSize: 17, borderRadius: 10 }}>€</span><strong style={{ fontSize: 17 }}>Cuentas Claras</strong></a>
          <nav className="row lp-links" style={{ gap: 22 }}>
            <a href="#video" onClick={a('video')}>Vídeo</a>
            <a href="#simula" onClick={a('simula')}>Simula tu mes</a>
            <a href="#funciones" onClick={a('funciones')}>Funciones</a>
            <a href="#como" onClick={a('como')}>Cómo empezar</a>
            <a href="/demo?guia">Guía</a>
            <a href="/demo">Demo</a>
          </nav>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn ghost" onClick={() => ir('entrar')}>Iniciar sesión</button>
            <button className="btn primary lp-hide-xs" onClick={() => ir('solicitar')}>Solicitar acceso</button>
          </div>
        </div>
      </header>

      <section className="lp-hero">
        <div className="lp-wrap lp-hero-grid">
          <div className="col lp-hero-txt" style={{ gap: 20 }}>
            <span className="lp-eyebrow">Presupuesto personal y familiar</span>
            <h1>Tu dinero,<br /><span className="lp-grad">con las cuentas claras.</span></h1>
            <p className="lp-lead">Sabe en qué se va cada euro, adelántate a los meses difíciles y ahorra sin hojas de cálculo. Para ti o compartido con tu familia.</p>
            <div className="row wrap" style={{ gap: 12 }}>
              <a className="btn primary lp-cta lp-pulse" href="/demo">Probar la demo gratis →</a>
              <button className="btn lp-cta" onClick={() => ir('solicitar')}>Solicitar acceso</button>
            </div>
            <div className="row wrap lp-badges"><span>✓ Sin instalar nada</span><span>✓ Móvil y ordenador</span><span>✓ Datos privados</span></div>
          </div>
          <MiniApp />
        </div>
      </section>

      <section className="lp-strip">
        <div className="lp-wrap lp-stats">
          {[[12, ' meses', 'de previsión de liquidez'], [3, ' clics', 'para importar el extracto del banco'], [100, ' %', 'privado: ni el administrador ve tus datos']].map(([n, u, t], i) => (
            <Reveal key={t} delay={i * 120} className="lp-stat"><strong><StatNum n={n} />{u}</strong><span>{t}</span></Reveal>
          ))}
        </div>
      </section>

      <section id="video" className="lp-sec" style={{ paddingBottom: 30 }}>
        <div className="lp-wrap col" style={{ gap: 26, alignItems: 'center' }}>
          <Reveal className="col lp-sec-head" style={{ alignItems: 'center', textAlign: 'center' }}><span className="lp-eyebrow" style={{ alignSelf: 'center' }}>En 40 segundos</span><h2>Mira cómo funciona</h2></Reveal>
          <Reveal delay={100} className="lp-video"><VideoPortada /></Reveal>
        </div>
      </section>

      <section id="simula" className="lp-sec">
        <div className="lp-wrap col" style={{ gap: 26 }}>
          <Reveal className="col lp-sec-head"><span className="lp-eyebrow">Pruébalo ahora</span><h2>Simula tu mes en 10 segundos</h2><p className="muted">Mueve los deslizadores con tus números y mira cuánto ahorrarías y si algún mes te quedarías corto.</p></Reveal>
          <Reveal delay={100}><Simulador /></Reveal>
        </div>
      </section>

      <section id="funciones" className="lp-sec lp-alt">
        <div className="lp-wrap col" style={{ gap: 26 }}>
          <Reveal className="col lp-sec-head"><span className="lp-eyebrow">Funciones</span><h2>Hace el trabajo pesado por ti</h2></Reveal>
          <Reveal delay={100} className="lp-fn">
            <div className="col" style={{ gap: 8 }}>
              {FUNCIONES.map(f => (
                <button key={f.k} type="button" className={'lp-fnb' + (fn === f.k ? ' on' : '')} onClick={() => { setFn(f.k); setAuto(false) }}>
                  <strong>{f.t}</strong>{fn === f.k && <span className="muted small">{f.d}</span>}
                  {fn === f.k && auto && <span className="lp-prog" key={fn} />}
                </button>
              ))}
            </div>
            <div className="lp-fnv" key={fn}><VisualFuncion k={actual.k} /></div>
          </Reveal>
        </div>
      </section>

      <section id="como" className="lp-sec">
        <div className="lp-wrap col" style={{ gap: 26 }}>
          <Reveal className="col lp-sec-head"><span className="lp-eyebrow">Cómo empezar</span><h2>En marcha en tres pasos</h2></Reveal>
          <div className="lp-steps">
            {[['Solicita acceso', 'Déjanos tu nombre y tu email. Te creamos la cuenta y te damos la contraseña.'], ['Define tu presupuesto', 'Elige tus categorías y cuánto quieres gastar o ingresar. Con el importe de un mes basta.'], ['Importa tus movimientos', 'Sube el extracto del banco cuando quieras y la app clasifica y te avisa.']].map(([t, d], i) => (
              <Reveal key={t} delay={i * 150} className="lp-step"><span className="lp-num">{i + 1}</span><strong>{t}</strong><span className="muted">{d}</span></Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-sec">
        <div className="lp-wrap">
          <Reveal className="lp-final">
            <span className="lp-blob b4" />
            <h2>¿Lo probamos con tus números?</h2>
            <p>Pide acceso o más información y te respondemos personalmente.</p>
            <div className="row wrap" style={{ gap: 12, justifyContent: 'center', position: 'relative' }}>
              <button className="btn lp-cta lp-white" onClick={() => ir('solicitar')}>Solicitar acceso</button>
              <button className="btn lp-cta lp-outline" onClick={() => ir('info')}>Pedir información</button>
              <a className="btn lp-cta lp-outline" href="/demo">Ver la demo</a>
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="lp-foot">
        <div className="lp-wrap row wrap between" style={{ gap: 12 }}>
          <span className="row" style={{ gap: 8 }}><span className="logo" style={{ width: 24, height: 24, fontSize: 12, borderRadius: 7 }}>€</span><strong>Cuentas Claras</strong></span>
          <span className="small muted">© {new Date().getFullYear()} Cuentas Claras · <button className="lp-link" onClick={() => ir('entrar')}>Iniciar sesión</button></span>
        </div>
      </footer>
    </div>
  )
}

function StatNum({ n }) {
  const ref = useRef(null)
  const [go, setGo] = useState(false)
  useEffect(() => { const el = ref.current; if (!el || !('IntersectionObserver' in window)) { setGo(true); return } const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setGo(true); io.disconnect() } }); io.observe(el); return () => io.disconnect() }, [])
  return <span ref={ref}><Cuenta valor={go ? n : 0} dur={1300} fmt={v => String(Math.round(v))} /></span>
}

// Vídeo de presentación: se reproduce solo (sin sonido) al aparecer en pantalla
function VideoPortada() {
  const ref = useRef(null)
  useEffect(() => {
    const v = ref.current; if (!v || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) v.play().catch(() => {}); else v.pause() }, { threshold: 0.4 })
    io.observe(v); return () => io.disconnect()
  }, [])
  return <video ref={ref} src="/guia/portada.mp4" poster="/guia/portada.jpg" muted loop playsInline controls preload="metadata" aria-label="Vídeo de presentación de Cuentas Claras" />
}
