import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../store'
import { ExportDialog, Icon, PeriodoSelector, Th, Toolbar, buscar, useOrden } from '../components/ui'
import { nombrePerfil, SubPerfil } from '../components/Shell'
import { ajustesDe, enRango, liquidez, porCategoria, prevision, presupuestoRango, tipoDe, totales, valor } from '../lib/calc'
import Liquidez from '../components/Liquidez'
import DetalleMovs from '../components/DetalleMovs'
import { etiqueta, rango } from '../lib/period'
import { MESES, MES_CORTO, cap, fmt0, hoyIso, iso, pct } from '../lib/format'
import { exportarHojas, exportarTodo } from '../lib/exporters'

export default function Resumen() {
  const app = useApp()
  const { desktop, me, perfil, categorias, cmap, movimientos, presupuestos, idxPres, periodo, setPeriodo, setTab, setFiltroInicial, saldos, perfilId, setToast } = app
  const [serie, setSerie] = useState('gasto') // gasto | ingreso | ahorro
  const [mesSel, setMesSel] = useState(null)
  const [hov, setHov] = useState(null)
  const [q, setQ] = useState('')
  const [revisados, setRevisados] = useState(() => new Set())
  const [verRevisados, setVerRevisados] = useState(false)
  useEffect(() => {
    setRevisados(new Set()); if (!perfilId) return
    supabase.from('pf_avisos_revisados').select('clave').eq('perfil_id', perfilId).then(({ data }) => setRevisados(new Set((data || []).map(r => r.clave))))
  }, [perfilId])
  async function marcarRevisado(k, v) {
    setRevisados(r => { const n = new Set(r); v ? n.add(k) : n.delete(k); return n })
    const { error } = v
      ? await supabase.from('pf_avisos_revisados').upsert({ perfil_id: perfilId, clave: k }, { onConflict: 'user_id,perfil_id,clave' })
      : await supabase.from('pf_avisos_revisados').delete().eq('perfil_id', perfilId).eq('clave', k)
    if (error) setToast('No se pudo guardar: ' + error.message)
  }
  const [exp, setExp] = useState(false)

  const { desde, hasta } = rango(periodo)
  const movsP = useMemo(() => enRango(movimientos, desde, hasta), [movimientos, desde, hasta])
  const tot = useMemo(() => totales(movsP, cmap), [movsP, cmap])
  const catsGasto = categorias.filter(c => c.tipo === 'gasto')
  const catsIng = categorias.filter(c => c.tipo === 'ingreso')
  const presGasto = catsGasto.reduce((s, c) => s + presupuestoRango(idxPres, c.id, desde, hasta), 0)
  const presIng = catsIng.reduce((s, c) => s + presupuestoRango(idxPres, c.id, desde, hasta), 0)
  const prev = periodo.tipo === 'mes' ? prevision(tot.gastos, desde, hasta) : null
  const nGastos = movsP.filter(m => tipoDe(m, cmap) === 'gasto').length
  const nIng = movsP.length - nGastos

  // Gráfico: 12 meses del año del periodo
  const anyoG = Number(hasta.slice(0, 4))
  const meses = useMemo(() => MES_CORTO.map((l, i) => {
    const d = iso(new Date(anyoG, i, 1)), h = iso(new Date(anyoG, i + 1, 0))
    const t = totales(enRango(movimientos, d, h), cmap)
    const pg = catsGasto.reduce((s, c) => s + (idxPres[`${c.id}|${anyoG}|${i + 1}`] || 0), 0)
    const pi = catsIng.reduce((s, c) => s + (idxPres[`${c.id}|${anyoG}|${i + 1}`] || 0), 0)
    return { i, l, d, h, ...t, presGasto: pg, presIng: pi, presAhorro: pi - pg }
  }), [movimientos, cmap, anyoG, idxPres, catsGasto, catsIng])
  const valSerie = m => (serie === 'gasto' ? m.gastos : serie === 'ingreso' ? m.ingresos : m.ahorro)
  const presSerie = m => (serie === 'gasto' ? m.presGasto : serie === 'ingreso' ? m.presIng : (m.presIng || m.presGasto ? m.presAhorro : 0))
  const maxV = Math.max(1, ...meses.map(m => Math.max(valSerie(m), presSerie(m))))
  const hoy = new Date()
  const selI = mesSel ?? (periodo.tipo === 'mes' && periodo.anyo === anyoG ? periodo.mes : (anyoG === hoy.getFullYear() ? hoy.getMonth() : 11))
  const ms = meses[selI]

  // Categorías
  const tipoTabla = serie === 'ingreso' ? 'ingreso' : 'gasto'
  const { filas, sinCat } = useMemo(() => porCategoria(movsP, categorias, idxPres, desde, hasta, cmap), [movsP, categorias, idxPres, desde, hasta, cmap])
  const filasTipo = filas.filter(f => f.cat.tipo === tipoTabla && (f.cat.activa || f.real))
  const cols = useMemo(() => [
    { key: 'nombre', label: 'Categoría', get: f => f.cat.nombre, asc: true },
    { key: 'presupuesto', label: 'Presupuesto' },
    { key: 'real', label: tipoTabla === 'gasto' ? 'Gastado' : 'Recibido' },
    { key: 'pct', label: '% usado' },
    { key: 'saldo', label: 'Saldo', get: f => f.presupuesto - f.real },
  ], [tipoTabla])
  const { ordenadas, orden, ordenar, setOrden } = useOrden(buscar(filasTipo, q, f => [f.cat.nombre]), cols, 'nombre', 1)

  // Alertas
  const alertas = []
  for (const f of filas) if (f.cat.tipo === 'gasto' && f.real > f.presupuesto + 0.005) alertas.push({ k: `pres:${f.cat.id}:${desde}:${hasta}`, warn: true, t: f.presupuesto > 0 ? `${f.cat.nombre} supera el presupuesto` : `${f.cat.nombre} no tenía presupuesto`, s: f.presupuesto > 0 ? `${fmt0(f.real - f.presupuesto)} por encima · ${pct(f.real - f.presupuesto, f.presupuesto)} % más` : `${fmt0(f.real)} gastados sin nada previsto`, go: () => verCat(f) })
  if (sinCat.n) alertas.push({ k: `sincat:${desde}:${hasta}:${sinCat.n}`, t: `${sinCat.n} movimiento${sinCat.n > 1 ? 's' : ''} sin categoría`, s: 'Asígnalos para que cuenten en su categoría', go: () => verSinCat() })
  const ultimo = movimientos[0]?.fecha
  const dias = ultimo ? Math.floor((new Date(hoyIso()) - new Date(ultimo)) / 86400000) : null
  if (dias === null) alertas.push({ k: 'sinmovs', t: 'Todavía no hay movimientos', s: 'Añade uno o importa el extracto del banco', go: () => irMovs({}) })
  else if (dias > 5) alertas.push({ k: `ultimo:${ultimo}`, t: `Último movimiento hace ${dias} días`, s: 'Importa el extracto del banco', go: () => irMovs({}) })
  if (prev && presGasto && prev > presGasto) alertas.push({ k: `prev:${desde}:${hasta}`, warn: true, t: 'La previsión supera el presupuesto', s: `Al ritmo actual cerrarás el mes en ${fmt0(prev)} (${fmt0(prev - presGasto)} más)`, go: () => setSerie('gasto') })

  const liq = useMemo(() => liquidez(anyoG, movimientos, categorias, idxPres, cmap, ajustesDe(saldos, anyoG), 'mixto'), [anyoG, movimientos, categorias, idxPres, cmap, saldos])
  const negLiq = liq.filter(m => m.fin < 0 && m.fuente !== 'real')
  if (negLiq.length) { const mn = negLiq.reduce((a, m) => (m.fin < a.fin ? m : a)); alertas.push({ k: `liq:${anyoG}:${negLiq.length}:${mn.i}`, warn: true, t: `Saldo previsto en negativo en ${negLiq.length === 1 ? MESES[negLiq[0].i] : negLiq.length + ' meses'}`, s: `El punto más bajo será ${fmt0(mn.fin)} a final de ${MESES[mn.i]}`, go: () => document.getElementById('liquidez')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }) }

  function irMovs(f) { setFiltroInicial(f); setTab('movimientos'); window.scrollTo({ top: 0 }) }
  // Abre el detalle en una ventana encima del Resumen, sin perder dónde estabas
  const [detalle, setDetalle] = useState(null)
  const verCat = f => setDetalle({ titulo: f.cat.nombre, subtitulo: `${f.cat.tipo === 'ingreso' ? 'Ingresos' : 'Gastos'} · ${etiqueta(periodo)}`, filtro: { cat: f.cat.id, desde, hasta }, presupuesto: f.presupuesto, abrir: { cat: f.cat.id } })
  const verSinCat = () => setDetalle({ titulo: 'Sin categoría', subtitulo: etiqueta(periodo), filtro: { cat: '__sin', desde, hasta }, abrir: { cat: '__sin' } })
  function verMes(m) {
    const d = `${anyoG}-${String(m.i + 1).padStart(2, '0')}`, fin = new Date(anyoG, m.i + 1, 0).getDate()
    setDetalle({ titulo: `${MESES[m.i][0].toUpperCase() + MESES[m.i].slice(1)} ${anyoG}`, subtitulo: 'Todos los movimientos del mes', filtro: { desde: d + '-01', hasta: `${d}-${fin}` }, abrir: {}, mesPeriodo: m.i })
  }

  const exportar = modo => {
    if (modo === 'todo') return exportarTodo(perfil, categorias, movimientos, presupuestos, idxPres, cmap)
    exportarHojas(perfil, 'resumen ' + etiqueta(periodo), [
      { name: 'Resumen', rows: [['Periodo', etiqueta(periodo)], ['Desde', desde], ['Hasta', hasta], [], ['Ingresos', tot.ingresos], ['Gastos', tot.gastos], ['Balance (ingresos − gastos)', tot.ahorro], ['Presupuesto de gastos', Math.round(presGasto * 100) / 100], ['Presupuesto de ingresos', Math.round(presIng * 100) / 100]] },
      { name: tipoTabla === 'gasto' ? 'Categorías gasto' : 'Categorías ingreso', rows: [['Categoría', 'Presupuesto', tipoTabla === 'gasto' ? 'Gastado' : 'Recibido', '% usado', 'Saldo (presupuesto − real)'], ...ordenadas.map(f => [f.cat.nombre, Math.round(f.presupuesto * 100) / 100, Math.round(f.real * 100) / 100, Math.round(f.pct), Math.round((f.presupuesto - f.real) * 100) / 100])] },
      { name: `Meses ${anyoG}`, rows: [['Mes', 'Ingresos', 'Gastos', 'Balance', 'Presupuesto gastos'], ...meses.map(m => [cap(MESES[m.i]), m.ingresos, m.gastos, m.ahorro, m.presGasto])] },
    ])
  }

  const quedan = presGasto - tot.gastos
  const vistaGeneral = serie === 'gasto' && mesSel == null && !q
  const kpis = [
    ['ingreso', 'Ingresos', fmt0(tot.ingresos), presIng ? `de ${fmt0(presIng)} previstos · ${nIng} mov.` : `${nIng} movimientos`],
    ['ahorro', 'Balance', fmt0(tot.ahorro), tot.ingresos ? `Ingresos − gastos · ${pct(tot.ahorro, tot.ingresos)}\u00a0% de los ingresos` : 'Ingresos − gastos'],
  ]

  const saldoTxt = f => {
    const d = f.presupuesto - f.real
    if (Math.abs(d) < 0.005) return tipoTabla === 'gasto' ? 'Justo' : 'Completo'
    if (tipoTabla === 'gasto') return d > 0 ? `Quedan ${fmt0(d)}` : `+${fmt0(-d)} ${f.presupuesto > 0 ? 'sobre el presupuesto' : 'sin presupuesto'}`
    return d > 0 ? `Faltan ${fmt0(d)}` : `+${fmt0(-d)} de más`
  }
  const tablaCats = desktop ? (
    <div className="tablewrap">
      <table className="t" style={{ minWidth: 640 }}>
        <thead><tr>{cols.map(c => <Th key={c.key} col={c} orden={orden} ordenar={ordenar} className={c.key === 'nombre' ? '' : 'num'} />)}</tr></thead>
        <tbody>
          {ordenadas.map(f => {
            const over = tipoTabla === 'gasto' && f.real > f.presupuesto + 0.005
            return (
              <tr key={f.cat.id} className="clickable" onClick={() => verCat(f)}>
                <td><span className="row" style={{ gap: 10 }}><span className="dot" style={{ background: f.cat.color }} /><strong>{f.cat.nombre}</strong></span></td>
                <td className="num">{fmt0(f.presupuesto)}</td>
                <td className={'num bold' + (over ? ' warn' : '')}>{fmt0(f.real)}</td>
                <td style={{ minWidth: 160 }}><span className="row" style={{ gap: 10 }}><span className={'bar grow' + (over ? ' over' : '')}><span style={{ width: Math.min(100, f.pct) + '%' }} /></span><span className="small muted" style={{ width: 44, textAlign: 'right' }}>{Math.round(f.pct)} %</span></span></td>
                <td className={'num bold' + (over ? ' warn' : f.presupuesto - f.real > 0.005 && tipoTabla === 'gasto' ? ' ok' : '')}>{saldoTxt(f)}</td>
              </tr>
            )
          })}
          {!ordenadas.length && <tr><td colSpan={5} className="empty">Sin categorías que mostrar.</td></tr>}
        </tbody>
      </table>
    </div>
  ) : (
    <div className="card pad col" style={{ gap: 16 }}>
      {ordenadas.map(f => {
        const over = tipoTabla === 'gasto' && f.real > f.presupuesto + 0.005
        return (
          <button key={f.cat.id} className="col" style={{ gap: 7, border: 0, background: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', minHeight: 44, justifyContent: 'center' }} onClick={() => verCat(f)}>
            <span className="row between small" style={{ width: '100%' }}>
              <span className="row" style={{ gap: 8, fontWeight: 500, fontSize: 14 }}><span className="dot" style={{ background: f.cat.color }} />{f.cat.nombre}</span>
              <span style={{ fontSize: 14 }}><strong className={over ? 'warn' : ''}>{fmt0(f.real)}</strong><span className="muted"> / {fmt0(f.presupuesto)}</span></span>
            </span>
            <span className={'bar' + (over ? ' over' : '')} style={{ width: '100%' }}><span style={{ width: Math.min(100, f.pct) + '%' }} /></span>
            <span className="row between xs" style={{ width: '100%' }}>
              <span className="muted">{f.presupuesto > 0 ? `${Math.round(f.pct)} % usado` : 'Sin presupuesto'}</span>
              <span className={'bold ' + (over ? 'warn' : tipoTabla === 'gasto' && f.presupuesto - f.real > 0.005 ? 'ok' : 'muted')}>{saldoTxt(f)}</span>
            </span>
          </button>
        )
      })}
      {!ordenadas.length && <div className="empty">Sin categorías que mostrar.</div>}
    </div>
  )

  const overTip = m => serie === 'gasto' ? m.presGasto > 0 && m.gastos > m.presGasto : false
  const grafico = (
    <section className={'card ' + (desktop ? 'pad20' : 'pad') + ' col'} style={{ gap: 12 }}>
      <div className="row wrap between">
        <h2>{serie === 'gasto' ? 'Gastos' : serie === 'ingreso' ? 'Ingresos' : 'Balance'} por mes · {anyoG}</h2>
        {!vistaGeneral && <button className="btn sm" onClick={() => { setSerie('gasto'); setMesSel(null); setQ('') }}>{Icon.close(14)} Vista general</button>}
        <span className="xs muted row" style={{ gap: 12 }}>
          <span className="row" style={{ gap: 6 }}><span className="dot" style={{ background: 'var(--accent)' }} />{mesSel == null ? 'Mes actual · toca una barra' : 'Seleccionado · tócalo otra vez para quitar'}</span>
          {meses.some(m => presSerie(m) > 0) && <span className="row" style={{ gap: 6 }}><span style={{ width: 14, borderTop: '2px dashed var(--muted)' }} />{serie === 'ahorro' ? 'Previsto' : 'Presupuesto'}</span>}
        </span>
      </div>
      <div className="chart" style={{ height: desktop ? 220 : 150 }}>
        {meses.map(m => {
          const v = Math.max(0, valSerie(m)), h = (v / maxV) * 100
          const over = serie === 'gasto' ? m.presGasto > 0 && m.gastos > m.presGasto : (presSerie(m) > 0 && m.i <= new Date().getMonth() + (anyoG < new Date().getFullYear() ? 12 : 0) && valSerie(m) < presSerie(m) && (anyoG < new Date().getFullYear() || m.i < new Date().getMonth()))
          return (
            <button key={m.i} className={(over ? 'over' : '') + (hov === m.i ? ' hov' : '')} aria-pressed={m.i === selI} aria-label={`${MESES[m.i]}: ${fmt0(valSerie(m))}`} onClick={() => setMesSel(mesSel === m.i ? null : m.i)} onMouseEnter={() => setHov(m.i)} onMouseLeave={() => setHov(h => (h === m.i ? null : h))}>
              <span className="b" style={{ height: h + '%', minHeight: v ? 3 : 0 }} />
              {presSerie(m) > 0 && <span className="tick" style={{ bottom: (presSerie(m) / maxV) * 100 + '%' }} />}
            </button>
          )
        })}
        {hov != null && desktop && (() => {
          const m = meses[hov], v = valSerie(m), p = presSerie(m), d = serie === 'gasto' ? p - v : v - p
          const nom = serie === 'gasto' ? 'Gastos' : serie === 'ingreso' ? 'Ingresos' : 'Balance'
          return (
            <div className="chart-tip" style={hov < 6 ? { left: `calc(${((hov + 1) / 12) * 100}% + 4px)`, top: 6 } : { right: `calc(${((12 - hov) / 12) * 100}% + 4px)`, top: 6 }}>
              <strong style={{ textTransform: 'capitalize' }}>{MESES[m.i]} {anyoG}</strong>
              <span className="row between" style={{ gap: 14 }}><span className="muted">{nom}</span><strong className={overTip(m) ? 'warn' : ''}>{fmt0(v)}</strong></span>
              {p ? <span className="row between" style={{ gap: 14 }}><span className="muted">{serie === 'ahorro' ? 'Previsto' : 'Presupuesto'}</span><span>{fmt0(p)}</span></span> : null}
              {p ? <span className="row between" style={{ gap: 14 }}><span className="muted">{serie === 'gasto' ? (d >= 0 ? 'Queda' : 'Exceso') : d >= 0 ? 'Por encima' : 'Falta'}</span><strong className={d < 0 ? 'warn' : 'ok'}>{fmt0(Math.abs(d))}</strong></span> : null}
              {serie === 'gasto' && <span className="row between xs" style={{ gap: 14 }}><span className="muted">Ingresos</span><span>{fmt0(m.ingresos)}{m.presIng ? ` / ${fmt0(m.presIng)}` : ''}</span></span>}
              {serie !== 'ahorro' && <span className="row between xs" style={{ gap: 14 }}><span className="muted">Balance</span><span>{fmt0(m.ahorro)}{m.presIng || m.presGasto ? ` / ${fmt0(m.presAhorro)}` : ''}</span></span>}
            </div>
          )
        })()}
      </div>
      <div className="chart-labels">{meses.map(m => <span key={m.i} style={{ fontWeight: m.i === selI ? 700 : 400, color: m.i === selI ? 'var(--text)' : undefined }}>{m.l}</span>)}</div>
      <div className="row wrap" style={{ background: 'var(--bg)', borderRadius: 12, padding: '12px 14px', gap: desktop ? 24 : 12, fontSize: 13 }}>
        <strong style={{ fontSize: 14, width: desktop ? 'auto' : '100%' }}>{cap(MESES[ms.i])} {anyoG}</strong>
        <span><span className="muted">Ingresos </span><strong className={ms.presIng && ms.ingresos < ms.presIng && (anyoG < hoy.getFullYear() || ms.i < hoy.getMonth()) ? 'warn' : ''}>{fmt0(ms.ingresos)}</strong>{ms.presIng ? <span className="muted"> / {fmt0(ms.presIng)}</span> : null}</span>
        <span><span className="muted">Gastos </span><strong className={ms.presGasto && ms.gastos > ms.presGasto ? 'warn' : ''}>{fmt0(ms.gastos)}</strong>{ms.presGasto ? <span className="muted"> / {fmt0(ms.presGasto)}</span> : null}</span>
        <span><span className="muted">Balance </span><strong className={ms.ahorro < 0 ? 'warn' : ''}>{fmt0(ms.ahorro)}</strong>{ms.presIng || ms.presGasto ? <span className="muted"> / {fmt0(ms.presAhorro)}</span> : null}</span>
        <button className="btn ghost sm" style={{ marginLeft: desktop ? 'auto' : 0 }} onClick={() => verMes(ms)}>Ver movimientos →</button>
      </div>
    </section>
  )

  const pendientesA = alertas.filter(a => !revisados.has(a.k))
  const revisadosA = alertas.filter(a => revisados.has(a.k))
  const filaAviso = (a, hecho) => (
    <div key={a.k} className="listrow" style={{ padding: 0, gap: 0, alignItems: 'stretch', opacity: hecho ? 0.6 : 1, ...(desktop ? { borderRadius: 12, background: hecho ? 'var(--neutral-soft)' : a.warn ? 'var(--warn-soft)' : 'var(--accent-soft)' } : {}) }}>
      <button className="row grow" style={{ gap: 12, border: 0, background: 'none', padding: '10px 4px 10px 12px', textAlign: 'left', cursor: 'pointer', color: 'inherit', font: 'inherit', minHeight: 56 }} onClick={a.go}>
        <span style={{ width: 36, height: 36, flex: 'none', borderRadius: 10, background: hecho ? 'var(--neutral-soft)' : a.warn ? 'var(--warn-soft)' : 'var(--accent-soft)', color: hecho ? 'var(--muted)' : a.warn ? 'var(--warn)' : 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{hecho ? Icon.check() : Icon.alert()}</span>
        <span className="col grow" style={{ gap: 2 }}><strong style={{ fontSize: 14 }}>{a.t}</strong><span className="small muted">{a.s}</span></span>
      </button>
      <button className="btn icon ghost" style={{ alignSelf: 'center', margin: '0 6px', flex: 'none' }} aria-label={hecho ? 'Volver a mostrar el aviso' : 'Marcar como revisado'} title={hecho ? 'Volver a mostrar' : 'Marcar como revisado'} onClick={() => marcarRevisado(a.k, !hecho)}>
        {hecho ? Icon.undo() : Icon.check()}
      </button>
    </div>
  )
  const avisos = (
    <section className={'col' + (desktop ? ' card pad20' : '')} style={{ gap: 10 }}>
      <h2>Requiere atención</h2>
      {pendientesA.length ? (
        <div className={desktop ? 'col' : 'list'} style={{ gap: 8 }}>{pendientesA.map(a => filaAviso(a, false))}</div>
      ) : <div className={desktop ? 'muted small' : 'notice'}>{revisadosA.length ? 'Todo revisado.' : 'Todo en orden.'}</div>}
      {revisadosA.length > 0 && (
        <>
          <button className="btn sm ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setVerRevisados(v => !v)}>{Icon.check(14)} {revisadosA.length} revisado{revisadosA.length > 1 ? 's' : ''} · {verRevisados ? 'Ocultar' : 'Ver'}</button>
          {verRevisados && <div className={desktop ? 'col' : 'list'} style={{ gap: 8 }}>{revisadosA.map(a => filaAviso(a, true))}</div>}
        </>
      )}
    </section>
  )

  const cabecera = (
    <header className={desktop ? 'row wrap between' : 'col'} style={{ gap: desktop ? 16 : 14 }}>
      <div className="row between"><div className="col" style={{ gap: 2 }}>
        <span className="small muted">{perfil?.tipo === 'personal' ? `Hola, ${me.nombre}` : <>{nombrePerfil(perfil)} · <SubPerfil p={perfil} /></>}</span>
        <h1>Resumen</h1>
      </div>{!desktop && <button className="btn icon" aria-label="Exportar" onClick={() => setExp(true)}>{Icon.up()}</button>}</div>
      <div className="row wrap" style={{ gap: 10 }}>
        <PeriodoSelector />
        {desktop && <button className="btn" onClick={() => setExp(true)}>{Icon.up()} Exportar</button>}
      </div>
    </header>
  )

  return (
    <>
      {cabecera}
      <div className="kpis">
        <button className="hero" aria-pressed={serie === 'gasto'} onClick={() => setSerie('gasto')}>
          <span className="small" style={{ opacity: 0.9, fontWeight: 500 }}>{periodo.tipo === 'mes' ? 'Gastado este mes' : periodo.tipo === 'ano' ? `Gastado en ${periodo.anyo}` : 'Gastado en el periodo'}</span>
          <span className="row" style={{ alignItems: 'baseline', gap: 8 }}><span className="big">{fmt0(tot.gastos)}</span>{presGasto > 0 && <span style={{ opacity: 0.9 }}>de {fmt0(presGasto)}</span>}</span>
          {presGasto > 0 && <span className="track"><span style={{ width: Math.min(100, (tot.gastos / presGasto) * 100) + '%' }} /></span>}
          <span className="small" style={{ opacity: 0.9 }}>
            {presGasto > 0 ? (quedan >= 0 ? `Quedan ${fmt0(quedan)}` : `${fmt0(-quedan)} por encima`) : 'Sin presupuesto de gastos'}
            {prev ? ` · previsión ${fmt0(prev)}` : ''} · {nGastos} movimientos
          </span>
        </button>
        {kpis.map(([k, l, v, s]) => (
          <button key={k} className="kpi" aria-pressed={serie === k} onClick={() => setSerie(serie === k ? 'gasto' : k)}>
            <span className="small muted">{l}</span><span className="v">{v}</span><span className="xs muted">{s}</span>
          </button>
        ))}
      </div>

      {!vistaGeneral && (
        <div className="row wrap" style={{ gap: 10, padding: '10px 14px', background: 'var(--accent-soft)', borderRadius: 14 }} role="status">
          <span className="small grow"><span className="muted">Viendo </span><strong>{serie === 'gasto' ? 'Gastos' : serie === 'ingreso' ? 'Ingresos' : 'Balance (ingresos − gastos)'}</strong>{mesSel != null ? <> · detalle de <strong>{MESES[mesSel]}</strong></> : null}{q ? <> · búsqueda «{q}»</> : null}</span>
          <button className="btn sm primary" onClick={() => { setSerie('gasto'); setMesSel(null); setQ('') }}>{Icon.close(14)} Volver a la vista general</button>
        </div>
      )}
      {desktop ? <div className="split"><div className="c2">{grafico}</div><div className="c1">{avisos}</div></div> : avisos}

      {serie === 'ahorro' && (() => {
        const hayPres = presIng || presGasto
        const filasB = [['Ingresos', tot.ingresos, presIng, 1], ['Gastos', tot.gastos, presGasto, -1], ['Balance', tot.ahorro, presIng - presGasto, 1]]
        return (
          <section className={'card ' + (desktop ? 'pad20' : 'pad') + ' col'} style={{ gap: 12 }}>
            <div className="row wrap between"><h2>Balance · {etiqueta(periodo)}</h2><button className="btn ghost sm" onClick={() => document.getElementById('liquidez')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Ver saldo acumulado ↓</button></div>
            <table className="t" style={{ tableLayout: 'fixed', width: '100%' }}>
              <thead><tr><th></th><th className="num">Real</th>{hayPres ? <><th className="num">Previsto</th><th className="num">Diferencia</th></> : null}</tr></thead>
              <tbody>{filasB.map(([t, r, p, sg]) => { const d = (r - p) * sg; const tot_ = t === 'Balance'; return (
                <tr key={t} style={tot_ ? { borderTop: '2px solid var(--border)' } : undefined}>
                  <td className={tot_ ? 'bold' : ''}>{t}{tot_ && <div className="xs muted" style={{ fontWeight: 400 }}>Ingresos − gastos</div>}</td>
                  <td className={'num ' + (tot_ ? 'bold ' : '') + (tot_ && r < 0 ? 'warn' : '')}>{t === 'Gastos' ? fmt0(-r) : fmt0(r)}</td>
                  {hayPres ? <><td className="num muted">{t === 'Gastos' ? fmt0(-p) : fmt0(p)}</td><td className={'num bold ' + (d < -0.5 ? 'warn' : d > 0.5 ? 'ok' : 'muted')}>{d > 0.5 ? '+' : ''}{fmt0(d)}</td></> : null}
                </tr>) })}</tbody>
            </table>
            <span className="xs muted">El balance es lo que queda en el periodo después de restar los gastos a los ingresos: positivo, has ahorrado; negativo, has gastado más de lo que ha entrado. {hayPres ? 'La diferencia en verde es a tu favor.' : ''} El saldo acumulado de las cuentas, mes a mes, está en Liquidez.</span>
          </section>
        )
      })()}

      <section className={'col' + (desktop ? ' card pad20' : '')} style={{ gap: 12 }}>
        <div className="row wrap between">
          <h2>Por categoría · {tipoTabla === 'gasto' ? 'Gastos' : 'Ingresos'}</h2>
          {serie !== 'gasto' && <button className="btn sm" onClick={() => setSerie('gasto')}>{Icon.close(14)} Ver gastos</button>}
          <button className="btn ghost sm" onClick={() => setTab('presupuesto')}>Ver presupuesto</button>
        </div>
        <Toolbar ordenInicial={{ key: 'nombre', dir: 1 }} q={q} setQ={setQ} placeholder="Buscar categoría" cols={cols} orden={orden} setOrden={setOrden} />
        {tablaCats}
      </section>

      {!desktop && grafico}
      <div id="liquidez" style={{ scrollMarginTop: 'calc(var(--topbar-h) + 12px)' }}><Liquidez anyo={anyoG} /></div>
      {detalle && <DetalleMovs {...detalle} onClose={() => setDetalle(null)} onAbrirEnMovimientos={() => { const d = detalle; setDetalle(null); if (d.mesPeriodo != null) setPeriodo({ ...periodo, tipo: 'mes', anyo: anyoG, mes: d.mesPeriodo }); irMovs(d.abrir) }} />}
      {exp && <ExportDialog onClose={() => setExp(false)} onExport={exportar}
        descVista={`${etiqueta(periodo)}: totales, categorías de ${tipoTabla === 'gasto' ? 'gasto' : 'ingreso'} con la búsqueda y el orden actuales, y los meses de ${anyoG}.`}
        descTodo="Libro completo del perfil: todos los movimientos, las categorías y el presupuesto y lo real de cada año."
        nota="Se exporta solo el perfil activo." />}
    </>
  )
}
