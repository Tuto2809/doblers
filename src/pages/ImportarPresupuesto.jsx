import { useMemo, useState } from 'react'
import { useApp } from '../store'
import { supabase } from '../lib/supabase'
import { Modal } from '../components/ui'
import { descargarExcel, leerArchivo } from '../lib/excel'
import { MESES, MES_CORTO, PALETA, fmt0, norm, parseImporte } from '../lib/format'

function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return d[a.length][b.length]
}

function parsear(rows) {
  const hi = rows.findIndex(r => r.some(c => /categor/.test(norm(c))))
  if (hi < 0) throw new Error('No encuentro una columna «Categoría».')
  const h = rows[hi].map(c => norm(c))
  const iCat = h.findIndex(c => /categor/.test(c))
  const iTipo = h.findIndex(c => /^tipo/.test(c))
  const iAnual = h.findIndex(c => /^(anual|total|importe anual|presupuesto anual)/.test(c))
  const iMes = MES_CORTO.map((m, k) => h.findIndex(c => c === norm(m) || c === norm(MESES[k]) || c.startsWith(norm(m) + '.')))
  const out = []
  for (const r of rows.slice(hi + 1)) {
    const nombre = String(r[iCat] ?? '').trim()
    if (!nombre || /^total/i.test(nombre)) continue
    let meses = iMes.map(i => (i >= 0 ? parseImporte(r[i]) || 0 : 0))
    const anual = iAnual >= 0 ? parseImporte(r[iAnual]) || 0 : 0
    const sumM = meses.reduce((a, b) => a + b, 0)
    let reparto = 'Por meses'
    if (!sumM && anual) { meses = MES_CORTO.map(() => Math.round((anual / 12) * 100) / 100); reparto = 'Igual cada mes' }
    else if (meses.every(v => Math.abs(v - meses[0]) < 0.01)) reparto = 'Igual cada mes'
    const tipoTxt = iTipo >= 0 ? norm(r[iTipo]) : ''
    out.push({ nombre, tipo: /ingres/.test(tipoTxt) ? 'ingreso' : /gast/.test(tipoTxt) ? 'gasto' : null, meses, total: meses.reduce((a, b) => a + b, 0), reparto })
  }
  return out
}

export function descargarPlantilla(anyo) {
  descargarExcel(`Plantilla presupuesto ${anyo}`, [{ name: `Presupuesto ${anyo}`, rows: [['Categoría', 'Tipo', ...MES_CORTO, 'Anual'], ['Supermercado', 'Gasto', ...Array(12).fill(''), 7200], ['Suministros', 'Gasto', 320, 300, 260, 220, 180, 170, 200, 210, 200, 230, 260, 450, ''], ['Nómina', 'Ingreso', ...Array(12).fill(''), 30000]] }])
}

export default function ImportarPresupuesto({ anyoInicial, onClose }) {
  const { perfilId, categorias, presupuestos, recargar, setToast } = useApp()
  const [anyo, setAnyo] = useState(anyoInicial)
  const [archivo, setArchivo] = useState(null)
  const [hojas, setHojas] = useState(null)
  const [hoja, setHoja] = useState(0)
  const [modo, setModo] = useState('sustituir')
  const [destino, setDestino] = useState({}) // idx -> categoria_id | '__nueva'
  const [tipoNueva, setTipoNueva] = useState({})
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)

  const abrir = async file => {
    setErr(null)
    try { const hs = await leerArchivo(file); setHojas(hs); setArchivo(file.name); setHoja(0); setDestino({}) } catch (e) { setErr('No he podido leer el archivo: ' + e.message) }
  }

  const { filas, errorParse } = useMemo(() => {
    if (!hojas) return { filas: [] }
    try {
      const datos = parsear(hojas[hoja].rows)
      return {
        filas: datos.map((d, i) => {
          const n = norm(d.nombre)
          const exacta = categorias.find(c => norm(c.nombre) === n)
          if (exacta) return { ...d, i, estado: 'Existe', sug: exacta.id }
          const parecida = categorias.find(c => { const m = norm(c.nombre); return m.includes(n) || n.includes(m) || lev(m, n) <= 2 })
          if (parecida) return { ...d, i, estado: 'Revisar', sug: parecida.id }
          return { ...d, i, estado: 'Nueva', sug: '__nueva' }
        }),
      }
    } catch (e) { return { filas: [], errorParse: e.message } }
  }, [hojas, hoja, categorias])

  const anyosOpc = (() => {
    const actual = new Date().getFullYear()
    const ys = new Set([actual - 1, actual, actual + 1, actual + 2, anyoInicial, ...presupuestos.map(p => p.anyo)])
    return [...ys].sort((a, b) => b - a)
  })()
  const destDe = f => destino[f.i] ?? f.sug
  const yaTiene = cid => presupuestos.some(p => p.categoria_id === cid && p.anyo === anyo && p.importe)
  const seImporta = f => modo === 'sustituir' || destDe(f) === '__nueva' || !yaTiene(destDe(f))
  const aImportar = filas.filter(seImporta)
  const total = aImportar.reduce((a, f) => a + (((tipoNueva[f.i] || f.tipo || 'gasto') === 'gasto' && destDe(f) === '__nueva') || categorias.find(c => c.id === destDe(f))?.tipo === 'gasto' ? f.total : 0), 0)

  const importar = async () => {
    setBusy(true); setErr(null)
    try {
      const nuevas = aImportar.filter(f => destDe(f) === '__nueva')
      const ids = {}
      if (nuevas.length) {
        const maxOrden = Math.max(0, ...categorias.map(c => c.orden))
        const { data, error } = await supabase.from('pf_categorias').insert(nuevas.map((f, k) => ({ perfil_id: perfilId, nombre: f.nombre, tipo: tipoNueva[f.i] || f.tipo || 'gasto', color: PALETA[(categorias.length + k) % PALETA.length], orden: maxOrden + k + 1 }))).select()
        if (error) throw error
        for (const c of data) ids[norm(c.nombre)] = c.id
      }
      const filasUp = []
      for (const f of aImportar) {
        const cid = destDe(f) === '__nueva' ? ids[norm(f.nombre)] : destDe(f)
        f.meses.forEach((v, k) => filasUp.push({ perfil_id: perfilId, categoria_id: cid, anyo, mes: k + 1, importe: Math.round(v * 100) / 100 }))
      }
      // Si dos filas van a la misma categoría, se suman
      const acc = {}
      for (const r of filasUp) { const k = r.categoria_id + '|' + r.mes; acc[k] = acc[k] ? { ...acc[k], importe: Math.round((acc[k].importe + r.importe) * 100) / 100 } : r }
      const { error } = await supabase.from('pf_presupuestos').upsert(Object.values(acc), { onConflict: 'categoria_id,anyo,mes' })
      if (error) throw error
      await recargar()
      setToast(`Presupuesto ${anyo} importado: ${aImportar.length} categorías`)
      onClose()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  const pasos = ['Archivo', 'Revisar', 'Confirmar']
  const paso = !hojas ? 0 : 1

  return (
    <Modal titulo="Importar presupuesto" onClose={onClose} wide>
      <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 6 }}>
        {pasos.map((p, i) => <li key={p} className="col" style={{ gap: 6 }}><span style={{ height: 4, borderRadius: 2, background: i <= paso ? 'var(--accent)' : 'var(--border)' }} /><span className="xs" style={{ fontWeight: i === paso ? 700 : 500, color: i === paso ? 'var(--text)' : 'var(--muted)' }}>{i + 1} · {p}</span></li>)}
      </ol>
      <div className="row" style={{ gap: 10 }}>
        <label className="field grow">Año<select className="select" value={anyo} onChange={e => setAnyo(Number(e.target.value))}>
          {anyosOpc.map(y => <option key={y} value={y}>{y}{presupuestos.some(p => p.anyo === y && p.importe) ? ' · ya tiene presupuesto' : ''}</option>)}
        </select></label>
        {hojas?.length > 1 && <label className="field grow">Hoja<select className="select" value={hoja} onChange={e => setHoja(Number(e.target.value))}>{hojas.map((h, i) => <option key={i} value={i}>{h.name}</option>)}</select></label>}
      </div>
      {!hojas ? (
        <>
          <p className="small muted" style={{ margin: 0 }}>Columnas admitidas: <strong>Categoría</strong>, <strong>Tipo</strong> (Ingreso o Gasto, opcional) y un importe <strong>Anual</strong>, o bien los 12 meses (<strong>Ene … Dic</strong>) para un reparto propio. El Excel que exporta la app tiene este formato.</p>
          <div className="row wrap"><label className="btn primary">Elegir archivo<input type="file" accept=".xlsx,.xls,.csv" className="sr" onChange={e => e.target.files[0] && abrir(e.target.files[0])} /></label><button className="btn" onClick={() => descargarPlantilla(anyo)}>Descargar plantilla</button></div>
        </>
      ) : (
        <>
          <div className="row small"><strong>{archivo}</strong><button className="btn sm ghost" onClick={() => setHojas(null)}>Cambiar</button></div>
          {errorParse ? <div className="error">{errorParse}</div> : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 8 }}>
                <div className="card" style={{ padding: '10px 12px' }}><div className="xs muted">Gastos a importar</div><strong>{fmt0(total)}</strong></div>
                <div className="card" style={{ padding: '10px 12px' }}><div className="xs muted">Categorías nuevas</div><strong>{aImportar.filter(f => destDe(f) === '__nueva').length}</strong></div>
                <div className="card" style={{ padding: '10px 12px' }}><div className="xs muted">A revisar</div><strong className="warn">{filas.filter(f => f.estado === 'Revisar').length}</strong></div>
              </div>
              <div className="tablewrap card" style={{ maxHeight: 340, overflowY: 'auto' }}>
                <table className="t" style={{ minWidth: 620 }}>
                  <thead><tr><th>En el Excel</th><th>Estado</th><th>Se guarda en</th><th className="num">Anual</th></tr></thead>
                  <tbody>
                    {filas.map(f => (
                      <tr key={f.i} style={{ opacity: seImporta(f) ? 1 : 0.45 }}>
                        <td><strong>{f.nombre}</strong><div className="xs muted">{f.reparto}{!seImporta(f) ? ' · ya tiene presupuesto, se mantiene' : ''}</div></td>
                        <td><span className={'pill ' + (f.estado === 'Existe' ? 'neutral' : f.estado === 'Revisar' ? 'warn' : '')}>{f.estado}</span></td>
                        <td>
                          <div className="row" style={{ gap: 6 }}>
                            <select className="select" style={{ height: 34, fontSize: 13 }} value={destDe(f)} onChange={e => setDestino({ ...destino, [f.i]: e.target.value })}>
                              <option value="__nueva">Crear «{f.nombre}»</option>
                              {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre} ({c.tipo})</option>)}
                            </select>
                            {destDe(f) === '__nueva' && <select className="select" style={{ height: 34, fontSize: 13, width: 110 }} value={tipoNueva[f.i] || f.tipo || 'gasto'} onChange={e => setTipoNueva({ ...tipoNueva, [f.i]: e.target.value })}><option value="gasto">Gasto</option><option value="ingreso">Ingreso</option></select>}
                          </div>
                        </td>
                        <td className="num bold">{fmt0(f.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <fieldset className="card pad col" style={{ margin: 0, gap: 8 }}>
                <legend className="small bold muted" style={{ padding: '0 6px' }}>Si la categoría ya tiene presupuesto en {anyo}</legend>
                <label className="row small" style={{ minHeight: 32 }}><input type="radio" name="modo" checked={modo === 'sustituir'} onChange={() => setModo('sustituir')} style={{ width: 20, height: 20, accentColor: 'var(--accent)' }} />Sustituir por el del Excel</label>
                <label className="row small" style={{ minHeight: 32 }}><input type="radio" name="modo" checked={modo === 'nuevas'} onChange={() => setModo('nuevas')} style={{ width: 20, height: 20, accentColor: 'var(--accent)' }} />Mantener el actual y añadir solo lo que falta</label>
              </fieldset>
            </>
          )}
        </>
      )}
      {err && <div className="error">{err}</div>}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn" onClick={onClose}>Cancelar</button>
        {hojas && !errorParse && <button className="btn primary" disabled={!aImportar.length || busy} onClick={importar}>{busy ? 'Importando…' : `Importar ${aImportar.length} categorías`}</button>}
      </div>
    </Modal>
  )
}
