import { useMemo, useState } from 'react'
import { useApp } from '../store'
import { supabase } from '../lib/supabase'
import { ajustesDe, liquidez } from '../lib/calc'
import { MES_CORTO, fmt0, fmtInput, parseImporte } from '../lib/format'
import { Icon, Seg } from './ui'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

// Saldo acumulado del año mes a mes, con saldo inicial editable
export default function Liquidez({ anyo, idx: idxProp, modoInicial = 'mixto' }) {
  const { perfilId, movimientos, categorias, idxPres, cmap, saldos, setSaldos, setToast, desktop } = useApp()
  const idx = idxProp || idxPres
  const [modo, setModo] = useState(modoInicial)
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState('')
  const [sel, setSel] = useState(null)
  const [hov, setHov] = useState(null)
  const [editMes, setEditMes] = useState(null) // índice del mes cuyo saldo inicial se está ajustando
  const [valorMes, setValorMes] = useState('')
  const ajustes = useMemo(() => ajustesDe(saldos, anyo), [saldos, anyo])
  const ini = ajustes[0] ?? 0
  const definido = ajustes[0] !== undefined

  const meses = useMemo(() => liquidez(anyo, movimientos, categorias, idx, cmap, ajustes, modo), [anyo, movimientos, categorias, idx, cmap, ajustes, modo])
  const finAnterior = useMemo(() => (saldos[`${anyo - 1}|1`] !== undefined || movimientos.some(m => m.fecha?.startsWith(String(anyo - 1)))
    ? liquidez(anyo - 1, movimientos, categorias, idxPres, cmap, ajustesDe(saldos, anyo - 1), 'mixto')[11].fin : null), [anyo, movimientos, categorias, idxPres, cmap, saldos])

  async function guardar(v, mes = 1) {
    const importe = Math.round((Number(v) || 0) * 100) / 100
    const { error } = await supabase.from('pf_saldos').upsert({ perfil_id: perfilId, anyo, mes, importe, updated_at: new Date().toISOString() }, { onConflict: 'perfil_id,anyo,mes' })
    if (error) return setToast('No se pudo guardar: ' + error.message)
    setSaldos(s => ({ ...s, [`${anyo}|${mes}`]: importe })); setEditando(false); setEditMes(null)
    setToast(mes === 1 ? `Saldo inicial de ${anyo}: ${fmt0(importe)}` : `Saldo a 1 de ${MESES[mes - 1]} ajustado a ${fmt0(importe)}`)
  }
  async function quitarAjuste(mes) {
    const { error } = await supabase.from('pf_saldos').delete().eq('perfil_id', perfilId).eq('anyo', anyo).eq('mes', mes)
    if (error) return setToast('No se pudo quitar: ' + error.message)
    setSaldos(s => { const n = { ...s }; delete n[`${anyo}|${mes}`]; return n }); setEditMes(null)
    setToast(`Ajuste de ${MESES[mes - 1]} quitado: vuelve al saldo calculado`)
  }
  const puedeAjustar = i => i === 0 || modo !== 'pres'
  const abrirAjuste = i => { setSel(i); setEditMes(i); setValorMes(fmtInput(meses[i].ini)) }

  const min = meses.reduce((a, m) => (m.fin < a.fin ? m : a), meses[0])
  const negativos = meses.filter(m => m.fin < 0)
  const recupera = min.fin < 0 ? meses.find(m => m.i > min.i && m.fin >= 0) : null
  const fin = meses[11].fin

  // Gráfico de línea
  const W = 600, H = 170, PX = 10, PT = 14, PB = 14
  const vals = [ini, ...meses.map(m => m.fin)]
  const vmax = Math.max(0, ...vals), vmin = Math.min(0, ...vals)
  const rango = vmax - vmin || 1
  const x = k => PX + (k / 12) * (W - 2 * PX)
  const y = v => PT + ((vmax - v) / rango) * (H - PT - PB)
  const pts = vals.map((v, k) => [x(k), y(v)])
  const corte = modo === 'pres' ? 0 : meses.filter(m => m.fuente === 'real').length // puntos reales: 0..corte
  const linea = a => a.map((p, k) => (k ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ')
  const area = `${linea(pts)} L${x(12)} ${y(0)} L${x(0)} ${y(0)} Z`
  const y0 = y(0)

  const filasTabla = [
    ['Saldo inicial', m => m.ini, 'muted'],
    ['Ingresos', m => m.ingresos, ''],
    ['Gastos', m => -m.gastos, ''],
    ['Balance del mes', m => m.ahorro, ''],
    ['Saldo final', m => m.fin, 'bold'],
  ]
  const cls = v => (v < -0.5 ? 'warn' : '')
  const etiq = m => (m.fuente === 'real' ? 'Real' : m.fuente === 'actual' ? 'En curso' : 'Previsto')

  return (
    <section className={'card ' + (desktop ? 'pad20' : 'pad') + ' col'} style={{ gap: 14 }}>
      <div className="row wrap between" style={{ gap: 10 }}>
        <h2>Liquidez {anyo}</h2>
        <Seg label="Cálculo" valor={modo} onChange={setModo} opciones={[['mixto', 'Real + previsto'], ['pres', 'Solo presupuesto']]} />
      </div>

      <div className="row wrap" style={{ gap: 10, alignItems: 'center' }}>
        <span className="small muted">Saldo inicial (1 ene)</span>
        {editando ? (
          <form className="row" style={{ gap: 6 }} onSubmit={e => { e.preventDefault(); guardar(parseImporte(valor)) }}>
            <input className="input" autoFocus inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)} style={{ width: 130, height: 36 }} aria-label="Saldo inicial" />
            <button className="btn sm primary" type="submit">Guardar</button>
            <button className="btn sm" type="button" onClick={() => setEditando(false)}>Cancelar</button>
          </form>
        ) : (
          <button className="btn sm" onClick={() => { setValor(fmtInput(ini)); setEditando(true) }} aria-label="Editar saldo inicial">
            <strong className={cls(ini)}>{fmt0(ini)}</strong>{Icon.edit(15)}
          </button>
        )}
        {!definido && !editando && <span className="xs muted">Sin definir: pon el saldo de tus cuentas a 1 de enero</span>}
        {finAnterior != null && !editando && Math.abs(finAnterior - ini) > 0.5 && (
          <button className="btn sm ghost" onClick={() => guardar(finAnterior)}>Usar el saldo final de {anyo - 1} ({fmt0(finAnterior)})</button>
        )}
      </div>

      <div className={'row wrap small' + (min.fin < 0 ? '' : '')} style={{ gap: 10, padding: '10px 14px', borderRadius: 12, background: min.fin < 0 ? 'var(--warn-soft)' : 'var(--ok-soft)' }} role="status">
        {min.fin < 0 ? (
          <span className={'warn'}><strong>En negativo {negativos.length === 1 ? 'en ' + MESES[negativos[0].i] : `${negativos.length} meses`}.</strong> Punto más bajo: <strong>{fmt0(min.fin)}</strong> a final de {MESES[min.i]}{recupera ? ` · vuelve a positivo en ${MESES[recupera.i]}` : ' · no se recupera este año'}.</span>
        ) : (
          <span className="ok"><strong>Sin meses en negativo.</strong> Punto más bajo: <strong>{fmt0(min.fin)}</strong> a final de {MESES[min.i]}.</span>
        )}
        <span className="grow" style={{ textAlign: 'right' }}><span className="muted">Saldo a 31 dic </span><strong className={cls(fin)}>{fmt0(fin)}</strong></span>
      </div>

      <div style={{ position: 'relative' }}>
        {hov != null && desktop && (() => { const m = meses[hov]; return (
          <div className="chart-tip" style={hov < 6 ? { left: `calc(${(x(hov + 1.5) / W) * 100}% + 4px)`, top: 6 } : { right: `calc(${(1 - x(hov + 0.5) / W) * 100}% + 4px)`, top: 6 }}>
            <strong style={{ textTransform: 'capitalize' }}>{MESES[m.i]} {anyo} <span className="xs muted" style={{ fontWeight: 400 }}>· {etiq(m)}</span></strong>
            <span className="row between" style={{ gap: 14 }}><span className="muted">Saldo inicial{m.ajustado ? ' (ajustado)' : ''}</span><span className={cls(m.ini)}>{fmt0(m.ini)}</span></span>
            <span className="row between" style={{ gap: 14 }}><span className="muted">Ingresos</span><span>{fmt0(m.ingresos)}</span></span>
            <span className="row between" style={{ gap: 14 }}><span className="muted">Gastos</span><span>{fmt0(-m.gastos)}</span></span>
            <span className="row between" style={{ gap: 14 }}><span className="muted">Saldo final</span><strong className={cls(m.fin)}>{fmt0(m.fin)}</strong></span>
          </div>
        ) })()}
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', height: desktop ? 190 : 150 }} preserveAspectRatio="none" role="img" aria-label={`Saldo acumulado de ${anyo}`}>
          <defs>
            <clipPath id="liq-neg"><rect x="0" y={y0} width={W} height={Math.max(0, H - y0)} /></clipPath>
            <clipPath id="liq-pos"><rect x="0" y="0" width={W} height={Math.max(0, y0)} /></clipPath>
          </defs>
          <path d={area} fill="var(--accent)" opacity=".10" clipPath="url(#liq-pos)" />
          <path d={area} fill="var(--warn)" opacity=".22" clipPath="url(#liq-neg)" />
          <line x1={PX} x2={W - PX} y1={y0} y2={y0} stroke="var(--muted)" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
          {corte > 0 && <path d={linea(pts.slice(0, corte + 1))} fill="none" stroke="var(--accent)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />}
          {corte < 12 && <path d={linea(pts.slice(corte))} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeDasharray="6 5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />}
          {meses.map(m => (
            <rect key={m.i} x={x(m.i + 0.5)} y="0" width={(W - 2 * PX) / 12} height={H} fill={sel === m.i ? 'var(--accent)' : 'transparent'} opacity={sel === m.i ? 0.08 : 1} style={{ cursor: 'pointer' }} onClick={() => setSel(sel === m.i ? null : m.i)} onMouseEnter={() => setHov(m.i)} onMouseLeave={() => setHov(h => (h === m.i ? null : h))}>
            </rect>
          ))}
        </svg>
        <div style={{ position: 'relative', height: 18 }}>
          {meses.map(m => <span key={m.i} className="xs" style={{ position: 'absolute', left: (x(m.i + 1) / W) * 100 + '%', transform: m.i === 11 ? 'translateX(-100%)' : 'translateX(-50%)', fontWeight: sel === m.i ? 700 : 400, color: m.fin < 0 ? 'var(--warn)' : 'var(--muted)' }}>{desktop ? MES_CORTO[m.i] : MES_CORTO[m.i][0]}</span>)}
        </div>
        <div className="row wrap xs muted" style={{ gap: 14, marginTop: 6 }}>
          {modo !== 'pres' && <span className="row" style={{ gap: 6 }}><span style={{ width: 16, borderTop: '2.5px solid var(--accent)' }} />Real</span>}
          <span className="row" style={{ gap: 6 }}><span style={{ width: 16, borderTop: '2.5px dashed var(--accent)' }} />{modo === 'pres' ? 'Según presupuesto' : 'Previsto (presupuesto)'}</span>
          <span className="row" style={{ gap: 6 }}><span style={{ width: 12, height: 10, background: 'var(--warn)', opacity: .3, borderRadius: 2 }} />Saldo negativo</span>
        </div>
      </div>

      {sel != null && (() => { const m = meses[sel]; const dif = m.ini - m.calc; return (
        <div className="col small" style={{ gap: 10, padding: '12px 14px', background: 'var(--accent-soft)', borderRadius: 12 }}>
          <div className="row wrap" style={{ gap: 14 }}>
            <strong style={{ textTransform: 'capitalize' }}>{MESES[m.i]}</strong><span className="pill">{etiq(m)}</span>
            <span><span className="muted">Ingresos </span><strong>{fmt0(m.ingresos)}</strong>{m.fuente !== 'prev' && modo !== 'pres' && m.pIng ? <span className="muted"> (real {fmt0(m.real.ingresos)} / prev. {fmt0(m.pIng)})</span> : null}</span>
            <span><span className="muted">Gastos </span><strong>{fmt0(m.gastos)}</strong>{m.fuente !== 'prev' && modo !== 'pres' && m.pGas ? <span className="muted"> (real {fmt0(m.real.gastos)} / prev. {fmt0(m.pGas)})</span> : null}</span>
            <span><span className="muted">Saldo final </span><strong className={cls(m.fin)}>{fmt0(m.fin)}</strong></span>
            <button className="btn sm ghost" style={{ marginLeft: 'auto' }} onClick={() => { setSel(null); setEditMes(null) }}>{Icon.close(14)} Cerrar</button>
          </div>
          <div className="row wrap" style={{ gap: 10, alignItems: 'center', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
            <span className="muted">Saldo a 1 de {MESES[m.i]}</span>
            {editMes === m.i ? (
              <form className="row wrap" style={{ gap: 6 }} onSubmit={e => { e.preventDefault(); guardar(parseImporte(valorMes), m.i + 1) }}>
                <input className="input" autoFocus inputMode="decimal" value={valorMes} onChange={e => setValorMes(e.target.value)} style={{ width: 130, height: 36 }} aria-label={`Saldo a 1 de ${MESES[m.i]}`} />
                <button className="btn sm primary" type="submit">Guardar</button>
                <button className="btn sm" type="button" onClick={() => setEditMes(null)}>Cancelar</button>
              </form>
            ) : puedeAjustar(m.i) ? (
              <button className="btn sm" onClick={() => abrirAjuste(m.i)} aria-label={`Ajustar saldo a 1 de ${MESES[m.i]}`}><strong className={cls(m.ini)}>{fmt0(m.ini)}</strong>{Icon.edit(15)}</button>
            ) : <strong>{fmt0(m.ini)}</strong>}
            {m.ajustado && editMes !== m.i && <>
              <span className="xs muted">Ajustado a mano · calculado {fmt0(m.calc)} ({dif > 0 ? '+' : ''}{fmt0(dif)})</span>
              <button className="btn sm ghost" onClick={() => quitarAjuste(m.i + 1)}>{Icon.undo(14)} Quitar ajuste</button>
            </>}
            {!m.ajustado && m.i > 0 && editMes !== m.i && puedeAjustar(m.i) && <span className="xs muted">Pon lo que había realmente en las cuentas ese día; los meses siguientes se recalculan desde ahí.</span>}
          </div>
        </div>
      ) })()}

      {desktop ? (
        <div className="tablewrap">
          <table className="t liq" style={{ tableLayout: 'fixed', width: '100%' }}>
            <colgroup><col style={{ width: '13%' }} />{meses.map(m => <col key={m.i} />)}</colgroup>
            <thead><tr><th></th>{meses.map(m => (
              <th key={m.i} className="num" style={{ cursor: 'pointer', background: sel === m.i ? 'var(--row-sel)' : undefined }} onClick={() => setSel(sel === m.i ? null : m.i)}>
                {MES_CORTO[m.i]}<div className="xs muted" style={{ fontWeight: 400, textTransform: 'none' }}>{modo === 'pres' ? '' : etiq(m)}</div>
              </th>))}</tr></thead>
            <tbody>
              {filasTabla.map(([t, f, c]) => (
                <tr key={t} style={c === 'bold' ? { borderTop: '2px solid var(--border)' } : undefined}>
                  <td className={c === 'bold' ? 'bold' : c}>{t}</td>
                  {meses.map(m => {
                    const esIni = t === 'Saldo inicial', aj = esIni && m.ajustado
                    return <td key={m.i} className={'num small ' + (c === 'bold' ? 'bold ' : '') + (c === 'muted' && !aj ? 'muted ' : '') + (aj ? 'bold ' : '') + (t === 'Gastos' ? '' : cls(f(m)))}
                      style={{ fontStyle: m.fuente === 'prev' && modo !== 'pres' ? 'italic' : undefined, background: sel === m.i ? 'var(--row-sel)' : undefined, cursor: esIni && puedeAjustar(m.i) ? 'pointer' : undefined, color: aj ? 'var(--accent)' : undefined }}
                      title={esIni && puedeAjustar(m.i) ? (aj ? `Ajustado a mano (calculado ${fmt0(m.calc)}). Pulsa para cambiarlo` : 'Pulsa para ajustar el saldo de este mes') : undefined}
                      onClick={esIni && puedeAjustar(m.i) ? () => abrirAjuste(m.i) : undefined}>{fmt0(f(m))}{aj && ' ✎'}</td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="tablewrap">
          <table className="t" style={{ tableLayout: 'fixed', width: '100%' }}>
            <colgroup><col style={{ width: '22%' }} /><col /><col /><col /></colgroup>
            <thead><tr><th>Mes</th><th className="num">Ingresos</th><th className="num">Gastos</th><th className="num">Saldo</th></tr></thead>
            <tbody>
              {meses.map(m => (
                <tr key={m.i} className="clickable" onClick={() => setSel(sel === m.i ? null : m.i)} style={{ background: sel === m.i ? 'var(--row-sel)' : undefined, fontStyle: m.fuente === 'prev' && modo !== 'pres' ? 'italic' : undefined }}>
                  <td className="small"><strong style={{ fontStyle: 'normal' }}>{MES_CORTO[m.i]}</strong>{modo !== 'pres' && m.fuente !== 'real' && <div className="xs muted">{m.fuente === 'actual' ? 'en curso' : 'previsto'}</div>}</td>
                  <td className="num small">{fmt0(m.ingresos)}</td>
                  <td className="num small">{fmt0(-m.gastos)}</td>
                  <td className={'num small bold ' + cls(m.fin)}>{fmt0(m.fin)}{m.ajustado && <div className="xs" style={{ color: 'var(--accent)', fontWeight: 500, fontStyle: 'normal' }}>ajustado</div>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <span className="xs muted">{modo === 'pres'
        ? 'Todo el año según el presupuesto, partiendo del saldo inicial.'
        : `Meses cerrados con los movimientos reales; el mes en curso, con lo mayor entre lo real y lo presupuestado; los meses futuros (en cursiva), según el presupuesto. ${desktop ? 'Pulsa un saldo inicial' : 'Toca un mes'} para ajustarlo a lo que había realmente en las cuentas.`}</span>
    </section>
  )
}
