import Liquidez from '../components/Liquidez'
import { useMemo, useState } from 'react'
import { useApp } from '../store'
import { supabase } from '../lib/supabase'
import { ExportDialog, Icon, Modal, PeriodoSelector, Seg, Th, Toolbar, buscar, useOrden } from '../components/ui'
import { enRango, porCategoria, tipoDe, totales } from '../lib/calc'
import { etiqueta, rango } from '../lib/period'
import { MES_CORTO, fmt0, fmtInput, parseImporte } from '../lib/format'
import { exportarHojas, exportarTodo, hojaPresupuesto, hojaReal } from '../lib/exporters'
import ImportarPresupuesto from './ImportarPresupuesto'

export function descReparto(vals) {
  const nz = vals.filter(v => v)
  if (!nz.length) return 'Sin presupuesto'
  if (vals.every(v => Math.abs(v - vals[0]) < 0.01)) return 'Igual cada mes'
  if (nz.length === 1) return 'Solo ' + MES_CORTO[vals.findIndex(v => v)].toLowerCase()
  if (vals[6] === 0 && vals[7] === 0 && nz.length === 10) return 'Sin jul. ni ago.'
  return 'Reparto propio'
}

export default function Presupuesto() {
  const app = useApp()
  const { desktop, perfil, perfilId, categorias, cmap, movimientos, presupuestos, idxPres, periodo, recargar, setToast } = app
  const [vista, setVista] = useState('pres') // pres | real | dif
  const [editando, setEditando] = useState(false)
  const [borrador, setBorrador] = useState({})
  const [q, setQ] = useState('')
  const [editCat, setEditCat] = useState(null)
  const [importar, setImportar] = useState(false)
  const [exp, setExp] = useState(false)
  const [busy, setBusy] = useState(false)

  const { desde, hasta } = rango(periodo)
  const anyo = Number(hasta.slice(0, 4))
  const movsP = useMemo(() => enRango(movimientos, desde, hasta), [movimientos, desde, hasta])
  const { filas } = useMemo(() => porCategoria(movsP, categorias, idxPres, desde, hasta, cmap), [movsP, categorias, idxPres, desde, hasta, cmap])
  const catsActivas = categorias.filter(c => c.activa || presupuestos.some(p => p.categoria_id === c.id && p.anyo === anyo))

  // Real por categoría y mes del año
  const realMes = useMemo(() => {
    const acc = {}
    for (const m of movimientos) {
      if (!m.fecha.startsWith(String(anyo)) || !m.categoria_id || !cmap[m.categoria_id]) continue
      const t = tipoDe(m, cmap), k = m.categoria_id + '|' + Number(m.fecha.slice(5, 7))
      acc[k] = (acc[k] || 0) + (t === 'gasto' ? -m.importe : m.importe)
    }
    return acc
  }, [movimientos, anyo, cmap])
  const hayRealHasta = (() => { const h = new Date(); return h.getFullYear() > anyo ? 12 : h.getFullYear() < anyo ? 0 : h.getMonth() + 1 })()

  const idxEf = useMemo(() => {
    const ks = Object.keys(borrador); if (!ks.length) return idxPres
    const o = { ...idxPres }; for (const k of ks) { const [cid, mes] = k.split('|'); o[`${cid}|${anyo}|${mes}`] = parseImporte(borrador[k]) || 0 }
    return o
  }, [idxPres, borrador, anyo])
  const presDe = (cid, mes) => (borrador[`${cid}|${mes}`] !== undefined ? parseImporte(borrador[`${cid}|${mes}`]) || 0 : idxPres[`${cid}|${anyo}|${mes}`] || 0)

  const tot = t => filas.filter(f => f.cat.tipo === t).reduce((s, f) => ({ p: s.p + f.presupuesto, r: s.r + f.real }), { p: 0, r: 0 })
  const tReal = totales(movsP, cmap)
  const tg = { ...tot('gasto'), r: tReal.gastos }, ti = { ...tot('ingreso'), r: tReal.ingresos }

  // Filas de la rejilla (escritorio) y de la lista (móvil)
  const lineas = useMemo(() => catsActivas.map(c => {
    const pres = MES_CORTO.map((_, i) => presDe(c.id, i + 1))
    const real = MES_CORTO.map((_, i) => (i < hayRealHasta ? realMes[`${c.id}|${i + 1}`] || 0 : null))
    const vals = pres.map((p, i) => (vista === 'pres' ? p : vista === 'real' ? real[i] : real[i] == null ? null : real[i] - p))
    const f = filas.find(x => x.cat.id === c.id)
    return { cat: c, pres, real, vals, total: vals.reduce((a, v) => a + (v || 0), 0), anual: pres.reduce((a, v) => a + v, 0), reparto: descReparto(pres), periodoPres: f?.presupuesto || 0, periodoReal: f?.real || 0 }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [catsActivas, borrador, idxPres, anyo, realMes, vista, filas, hayRealHasta])

  const cols = useMemo(() => [
    { key: 'nombre', label: 'Categoría', get: l => l.cat.nombre, asc: true },
    ...MES_CORTO.map((m, i) => ({ key: 'm' + i, label: m, get: l => l.vals[i] ?? -Infinity })),
    { key: 'total', label: 'Total' },
    { key: 'periodo', label: 'Del periodo', get: l => l.periodoPres },
  ], [])
  const { ordenadas, orden, ordenar, setOrden } = useOrden(buscar(lineas, q, l => [l.cat.nombre]), cols, 'nombre', 1)

  const guardarRejilla = async () => {
    const filasUp = Object.entries(borrador).map(([k, v]) => { const [cid, mes] = k.split('|'); return { perfil_id: perfilId, categoria_id: cid, anyo, mes: Number(mes), importe: Math.round((parseImporte(v) || 0) * 100) / 100 } })
    if (filasUp.length) {
      setBusy(true)
      const { error } = await supabase.from('pf_presupuestos').upsert(filasUp, { onConflict: 'categoria_id,anyo,mes' })
      setBusy(false)
      if (error) { setToast('Error: ' + error.message); return }
      await recargar()
      setToast('Presupuesto guardado')
    }
    setBorrador({}); setEditando(false)
  }

  const copiarAnterior = async () => {
    const prev = presupuestos.filter(p => p.anyo === anyo - 1)
    if (!prev.length) { setToast(`No hay presupuesto de ${anyo - 1} para copiar`); return }
    const hay = presupuestos.some(p => p.anyo === anyo && p.importe)
    if (hay && !confirm(`Ya hay presupuesto en ${anyo}. ¿Sustituirlo por el de ${anyo - 1}?`)) return
    const { error } = await supabase.from('pf_presupuestos').upsert(prev.map(p => ({ perfil_id: perfilId, categoria_id: p.categoria_id, anyo, mes: p.mes, importe: p.importe })), { onConflict: 'categoria_id,anyo,mes' })
    if (error) { setToast('Error: ' + error.message); return }
    await recargar(); setToast(`Presupuesto de ${anyo - 1} copiado a ${anyo}`)
  }

  const exportar = modo => {
    if (modo === 'todo') return exportarTodo(perfil, categorias, movimientos, presupuestos, idxPres, cmap)
    const cats = ordenadas.map(l => l.cat)
    const sheets = vista === 'pres' ? [hojaPresupuesto(anyo, cats, idxPres)] : vista === 'real' ? [hojaReal(anyo, cats, movimientos, cmap)] : [{
      name: `Diferencia ${anyo}`, rows: [['Categoría', 'Tipo', ...MES_CORTO, 'Total'], ...ordenadas.map(l => [l.cat.nombre, l.cat.tipo === 'gasto' ? 'Gasto' : 'Ingreso', ...l.vals.map(v => (v == null ? '' : Math.round(v * 100) / 100)), Math.round(l.total * 100) / 100])],
    }]
    sheets.push({ name: `Periodo ${etiqueta(periodo)}`.slice(0, 31), rows: [['Categoría', 'Tipo', 'Presupuesto', 'Real', 'Diferencia'], ...ordenadas.map(l => [l.cat.nombre, l.cat.tipo === 'gasto' ? 'Gasto' : 'Ingreso', Math.round(l.periodoPres * 100) / 100, Math.round(l.periodoReal * 100) / 100, Math.round((l.periodoReal - l.periodoPres) * 100) / 100])] })
    exportarHojas(perfil, `presupuesto ${anyo}`, sheets, { unaPagina: true })
  }

  const kpis = [
    ['Presupuesto de gastos', fmt0(tg.p), etiqueta(periodo)],
    ['Ingresos previstos', fmt0(ti.p), `${fmt0(ti.r)} recibidos`],
    ['Margen previsto', fmt0(ti.p - tg.p), 'Ingresos − gastos'],
    ['Gastado', fmt0(tg.r), tg.p ? `${Math.round((tg.r / tg.p) * 100)} % de lo previsto` : 'Sin presupuesto'],
  ]

  const celdaColor = (v, tipo) => (vista !== 'dif' || v == null || Math.abs(v) < 0.5 ? undefined : (tipo === 'gasto' ? v > 0 : v < 0) ? 'var(--warn)' : 'var(--ok)')
  const fmtCelda = v => (v == null ? '—' : (vista === 'dif' && v > 0 ? '+' : '') + fmt0(v))

  const rejilla = (
    <div className="tablewrap">
      <table className="t grid">
        <colgroup><col className="c-cat" />{MES_CORTO.map(m => <col key={m} />)}<col className="c-tot" /></colgroup>
        <thead><tr>
          {cols.filter(c => c.key !== 'periodo').map((c, i) => <Th key={c.key} col={c} orden={orden} ordenar={ordenar} className={i === 0 ? 'sticky' : 'num'} />)}
        </tr></thead>
        <tbody>
          {['gasto', 'ingreso'].map(tipo => {
            const ls = ordenadas.filter(l => l.cat.tipo === tipo)
            if (!ls.length) return null
            const sub = MES_CORTO.map((_, i) => (ls.every(l => l.vals[i] == null) ? null : ls.reduce((a, l) => a + (l.vals[i] || 0), 0)))
            return [
              ...ls.map(l => (
                <tr key={l.cat.id}>
                  <th scope="row" className="sticky" style={{ textAlign: 'left', fontWeight: 500 }}><button className="row" title={l.cat.nombre} style={{ gap: 8, border: 0, background: 'none', cursor: 'pointer', padding: 0, fontSize: 13, textAlign: 'left', maxWidth: '100%', overflow: 'hidden' }} onClick={() => setEditCat(l.cat)}><span className="dot" style={{ background: l.cat.color }} /><span className="ellipsis">{l.cat.nombre}</span></button></th>
                  {l.vals.map((v, i) => (
                    <td key={i} className="num" style={{ color: celdaColor(v, tipo) }}>
                      {editando && vista === 'pres'
                        ? <input aria-label={`${l.cat.nombre} ${MES_CORTO[i]}`} inputMode="decimal" value={borrador[`${l.cat.id}|${i + 1}`] ?? (l.pres[i] ? fmtInput(l.pres[i]) : '')} onChange={e => setBorrador({ ...borrador, [`${l.cat.id}|${i + 1}`]: e.target.value })} />
                        : fmtCelda(v)}
                    </td>
                  ))}
                  <td className="num bold" style={{ color: celdaColor(l.total, tipo) }}>{fmtCelda(l.total)}</td>
                </tr>
              )),
              <tr key={'sub' + tipo} className="sub">
                <th scope="row" className="sticky" style={{ textAlign: 'left' }}>Total {tipo === 'gasto' ? 'gastos' : 'ingresos'}</th>
                {sub.map((v, i) => <td key={i} className="num" style={{ color: celdaColor(v, tipo) }}>{fmtCelda(v)}</td>)}
                <td className="num" style={{ color: celdaColor(sub.reduce((a, v) => a + (v || 0), 0), tipo) }}>{fmtCelda(sub.reduce((a, v) => a + (v || 0), 0))}</td>
              </tr>,
            ]
          })}
          {!ordenadas.length && <tr><td colSpan={15} className="empty">No hay categorías. Créalas en Ajustes o importa un Excel.</td></tr>}
        </tbody>
      </table>
    </div>
  )

  const listaMovil = ['gasto', 'ingreso'].map(tipo => {
    const ls = ordenadas.filter(l => l.cat.tipo === tipo)
    if (!ls.length) return null
    return (
      <section key={tipo} className="col" style={{ gap: 8 }}>
        <div className="group-title upper sticky-title"><span>{tipo === 'gasto' ? 'Gastos' : 'Ingresos'}</span><span>{fmt0(ls.reduce((a, l) => a + l.periodoPres, 0))}</span></div>
        <div className="list">
          {ls.map(l => {
            const over = tipo === 'gasto' && l.periodoReal > l.periodoPres + 0.005
            const p = l.periodoPres ? Math.min(100, (l.periodoReal / l.periodoPres) * 100) : 0
            return (
              <button key={l.cat.id} className="listrow" onClick={() => setEditCat(l.cat)}>
                <span className="dot" style={{ background: l.cat.color }} />
                <span className="col grow" style={{ gap: 6 }}>
                  <span className="bold" style={{ fontSize: 14 }}>{l.cat.nombre}</span>
                  <span className="row" style={{ gap: 8 }}>
                    <span className={'bar grow' + (over ? ' over' : '')} style={{ height: 6 }}><span style={{ width: p + '%' }} /></span>
                    <span className={'xs nowrap ' + (over ? 'warn bold' : 'muted')}>{fmt0(l.periodoReal)} {tipo === 'gasto' ? (over ? '· superado' : 'gastado') : 'recibido'}</span>
                  </span>
                </span>
                <span className="col" style={{ alignItems: 'flex-end', gap: 2, minWidth: 72 }}><strong>{fmt0(l.periodoPres)}</strong><span className="xs muted">{periodo.tipo === 'ano' ? (l.reparto === 'Igual cada mes' ? fmt0(l.anual / 12) + '/mes' : l.reparto) : ''}</span></span>
              </button>
            )
          })}
        </div>
      </section>
    )
  })

  return (
    <>
      <header className={desktop ? 'row wrap between' : 'col'} style={{ gap: 14 }}>
        <div className="row between"><h1>Presupuesto</h1>
          {!desktop && <div className="row" style={{ gap: 8 }}>
            <button className="btn icon" aria-label="Importar Excel" onClick={() => setImportar(true)}>{Icon.down()}</button>
            <button className="btn icon" aria-label="Exportar" onClick={() => setExp(true)}>{Icon.up()}</button>
          </div>}
        </div>
        <div className="row wrap" style={{ gap: 10 }}>
          <PeriodoSelector />
          {desktop && <>
            <button className="btn" onClick={() => setImportar(true)}>{Icon.down()} Importar Excel</button>
            <button className="btn" onClick={() => setExp(true)}>{Icon.up()} Exportar</button>
          </>}
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: desktop ? 'repeat(4, minmax(0,1fr))' : 'repeat(2, minmax(0,1fr))', gap: 10 }}>
        {kpis.map(([l, v, s]) => <div key={l} className="card" style={{ padding: '12px 14px' }}><div className="xs muted">{l}</div><strong style={{ fontSize: desktop ? 22 : 18 }}>{v}</strong><div className="xs muted">{s}</div></div>)}
      </div>

      <section className={desktop ? 'card pad col' : 'col'} style={{ gap: 12 }}>
        <div className="row wrap between" style={{ gap: 10 }}>
          <h2>{desktop ? `Año ${anyo} por meses` : `Categorías · ${etiqueta(periodo)}`}</h2>
          <div className="row wrap" style={{ gap: 8 }}>
            {desktop && <Seg label="Qué mostrar" valor={vista} onChange={v => { setVista(v); if (v !== 'pres') { setEditando(false); setBorrador({}) } }} opciones={[['pres', 'Presupuesto'], ['real', 'Real'], ['dif', 'Diferencia']]} />}
            <button className="btn sm" onClick={copiarAnterior}>Copiar {anyo - 1}</button>
            {desktop && (editando
              ? <><button className="btn sm" onClick={() => { setBorrador({}); setEditando(false) }}>Cancelar</button><button className="btn sm primary" disabled={busy} onClick={guardarRejilla}>Guardar</button></>
              : <button className="btn sm primary" onClick={() => { setVista('pres'); setEditando(true) }}>{Icon.edit(16)} Editar</button>)}
          </div>
        </div>
        <Toolbar ordenInicial={{ key: 'nombre', dir: 1 }} q={q} setQ={setQ} placeholder="Buscar categoría" cols={cols} orden={orden} setOrden={setOrden} />
        {desktop ? rejilla : listaMovil}
        <span className="xs muted">{desktop ? 'Pulsa una cabecera para ordenar y el nombre de una categoría para editar su total anual y el reparto por meses.' : 'Toca una categoría para cambiar su presupuesto anual y cómo se reparte por meses.'}</span>
      </section>

      <Liquidez anyo={anyo} modoInicial="pres" idx={idxEf} />

      {editCat && <EditarCategoria cat={editCat} anyo={anyo} onClose={() => setEditCat(null)} />}
      {importar && <ImportarPresupuesto anyoInicial={anyo} onClose={() => setImportar(false)} />}
      {exp && <ExportDialog onClose={() => setExp(false)} onExport={exportar}
        descVista={`Año ${anyo} en la vista ${vista === 'pres' ? 'Presupuesto' : vista === 'real' ? 'Real' : 'Diferencia'}, con la búsqueda y el orden actuales, más el detalle de ${etiqueta(periodo)}.`}
        descTodo="Presupuesto y real de todos los años, con el reparto mensual de cada categoría, y todos los movimientos."
        nota="La hoja de presupuesto tiene el mismo formato que la importación: sirve como plantilla." />}
    </>
  )
}

function EditarCategoria({ cat, anyo, onClose }) {
  const { perfilId, idxPres, recargar, setToast } = useApp()
  const vals0 = MES_CORTO.map((_, i) => idxPres[`${cat.id}|${anyo}|${i + 1}`] || 0)
  const iguales = vals0.every(v => Math.abs(v - vals0[0]) < 0.01)
  const [modo, setModo] = useState(iguales ? 'igual' : 'meses')
  const [anual, setAnual] = useState(fmtInput(Math.round(vals0.reduce((a, b) => a + b, 0) * 100) / 100))
  const [mensual, setMensual] = useState(fmtInput(Math.round((iguales ? vals0[0] : vals0.reduce((a, b) => a + b, 0) / 12) * 100) / 100))
  const [desde, setDesde] = useState('mes') // qué campo escribió el usuario por última vez
  const r2 = v => Math.round(v * 100) / 100
  const cambiaMensual = v => { setMensual(v); setDesde('mes'); setAnual(fmtInput(r2((parseImporte(v) || 0) * 12))) }
  const cambiaAnual = v => { setAnual(v); setDesde('anual'); setMensual(fmtInput(r2((parseImporte(v) || 0) / 12))) }
  const [meses, setMeses] = useState(vals0.map(v => (v ? fmtInput(v) : '')))
  const [busy, setBusy] = useState(false)
  const totalMeses = meses.reduce((a, v) => a + (parseImporte(v) || 0), 0)

  const guardar = async () => {
    let vals
    if (modo === 'igual' && desde === 'mes') { const m = r2(parseImporte(mensual) || 0); vals = MES_CORTO.map(() => m) }
    else if (modo === 'igual') { const a = parseImporte(anual) || 0; const base = Math.floor((a / 12) * 100) / 100; vals = MES_CORTO.map((_, i) => (i === 11 ? Math.round((a - base * 11) * 100) / 100 : base)) }
    else vals = meses.map(v => Math.round((parseImporte(v) || 0) * 100) / 100)
    setBusy(true)
    const { error } = await supabase.from('pf_presupuestos').upsert(vals.map((v, i) => ({ perfil_id: perfilId, categoria_id: cat.id, anyo, mes: i + 1, importe: v })), { onConflict: 'categoria_id,anyo,mes' })
    setBusy(false)
    if (error) { setToast('Error: ' + error.message); return }
    await recargar(); setToast(`${cat.nombre}: presupuesto ${anyo} guardado`); onClose()
  }
  const repartir = () => { const m = desde === 'mes' ? r2(parseImporte(mensual) || 0) : r2((parseImporte(anual) || 0) / 12); setMeses(MES_CORTO.map(() => fmtInput(m))) }

  return (
    <Modal titulo={`${cat.nombre} · ${anyo}`} onClose={onClose}>
      <Seg full label="Reparto" valor={modo} onChange={m => { if (m === 'meses' && modo === 'igual') repartir(); setModo(m) }} opciones={[['igual', 'Igual cada mes'], ['meses', 'Mes a mes']]} />
      {modo === 'igual' ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 10 }}>
            <label className="field">Cada mes (€)<input className="input" autoFocus inputMode="decimal" value={mensual} onChange={e => cambiaMensual(e.target.value)} onFocus={e => e.target.select()} /></label>
            <label className="field">Total año (€)<input className="input" inputMode="decimal" value={anual} onChange={e => cambiaAnual(e.target.value)} onFocus={e => e.target.select()} /></label>
          </div>
          <span className="small muted">Escribe el importe de un mes o el total del año: el otro se calcula solo.</span>
        </>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 8 }}>
            {MES_CORTO.map((m, i) => <label key={m} className="field">{m}<input className="input" inputMode="decimal" value={meses[i]} onChange={e => { const n = [...meses]; n[i] = e.target.value; setMeses(n) }} placeholder="0" /></label>)}
          </div>
          <span className="small">Total anual: <strong>{fmt0(totalMeses)}</strong></span>
        </>
      )}
      <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={busy} onClick={guardar}>Guardar</button></div>
    </Modal>
  )
}
