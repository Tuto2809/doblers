// Cliente de Supabase simulado para la demo pública: datos inventados que viven solo en memoria del navegador.
// Nada de lo que se hace aquí llega a la base de datos real.
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2))
const YO = 'demo-laura', OTRO = 'demo-marc'

function crearDatos() {
  const hoy = new Date(), Y = hoy.getFullYear(), MH = hoy.getMonth(), DH = hoy.getDate()
  const db = { pf_usuarios: [], pf_perfiles: [], pf_perfil_miembros: [], pf_categorias: [], pf_movimientos: [], pf_presupuestos: [], pf_saldos: [], pf_avisos_revisados: [], pf_conexiones: [], pf_solicitudes: [] }
  db.pf_usuarios.push({ id: YO, nombre: 'Laura', email: 'laura@ejemplo.com', es_admin: false, activo: true, tema: 'sistema' })
  db.pf_usuarios.push({ id: OTRO, nombre: 'Marc', email: 'marc@ejemplo.com', es_admin: false, activo: true, tema: 'sistema' })
  const pP = 'demo-personal', pF = 'demo-familia'
  db.pf_perfiles.push({ id: pP, nombre: 'Personal', tipo: 'personal' }, { id: pF, nombre: 'Casa y niños', tipo: 'compartido', descripcion: 'Gastos comunes de la familia' })
  db.pf_perfil_miembros.push({ perfil_id: pP, user_id: YO }, { perfil_id: pF, user_id: YO }, { perfil_id: pF, user_id: OTRO })
  db.pf_saldos.push({ perfil_id: pP, anyo: Y, mes: 1, importe: 1800 }, { perfil_id: pF, anyo: Y, mes: 1, importe: 600 })

  // [nombre, tipo, color, presupuesto mensual (o array de 12), movimientos al mes, conceptos]
  const planes = {
    [pP]: [
      ['Supermercado', 'gasto', '#8B5CF6', 420, 5, ['Mercadona', 'Lidl', 'Fruteria del barrio', 'Carrefour Express']],
      ['Alquiler', 'gasto', '#3B82F6', 850, 1, ['Alquiler piso']],
      ['Suministros', 'gasto', '#0EA5E9', [140, 135, 120, 100, 90, 85, 95, 100, 95, 105, 125, 150], 3, ['Luz', 'Agua', 'Fibra y móvil']],
      ['Restaurantes', 'gasto', '#A855F7', 160, 3, ['La Tasca', 'Pizzeria Napoli', 'Café Central']],
      ['Transporte', 'gasto', '#F59E0B', 120, 2, ['Gasolinera', 'Abono transporte']],
      ['Ocio', 'gasto', '#F97316', 100, 2, ['Cine', 'Conciertos', 'Libros']],
      ['Suscripciones', 'gasto', '#EC4899', 35, 1, ['Streaming y gimnasio']],
      ['Ropa', 'gasto', '#14B8A6', [0, 120, 0, 60, 0, 90, 150, 0, 0, 80, 0, 120], 1, ['Tienda de ropa']],
      ['Nómina', 'ingreso', '#10B981', [2150, 2150, 2150, 2150, 2150, 3300, 2150, 2150, 2150, 2150, 2150, 3300], 1, ['Nómina']],
      ['Otros ingresos', 'ingreso', '#22C55E', [0, 0, 120, 0, 0, 0, 0, 0, 200, 0, 0, 0], 1, ['Venta segunda mano', 'Devolución']],
    ],
    [pF]: [
      ['Colegio', 'gasto', '#14B8A6', 230, 1, ['Comedor escolar']],
      ['Extraescolares', 'gasto', '#0EA5E9', [90, 90, 90, 90, 90, 90, 0, 0, 120, 90, 90, 90], 2, ['Inglés', 'Natación']],
      ['Ropa niños', 'gasto', '#EC4899', [0, 90, 0, 60, 0, 0, 0, 0, 180, 0, 70, 0], 1, ['Ropa infantil']],
      ['Salud', 'gasto', '#EF4444', 40, 1, ['Farmacia', 'Dentista']],
      ['Vacaciones', 'gasto', '#F59E0B', [0, 0, 0, 250, 0, 0, 1200, 900, 0, 0, 0, 300], 1, ['Apartamento playa', 'Escapada']],
      ['Aportación Laura', 'ingreso', '#10B981', 450, 1, ['Aportación Laura']],
      ['Aportación Marc', 'ingreso', '#22C55E', 450, 1, ['Aportación Marc']],
    ],
  }
  let seed = 11; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280
  for (const [perfil, lista] of Object.entries(planes)) {
    lista.forEach(([nombre, tipo, color, pres, n, conceptos], i) => {
      const id = uid()
      db.pf_categorias.push({ id, perfil_id: perfil, nombre, tipo, color, orden: i + 1, activa: true })
      for (const y of [Y, Y + 1]) for (let m = 1; m <= 12; m++) {
        const v = Array.isArray(pres) ? pres[m - 1] : pres
        if (v) db.pf_presupuestos.push({ perfil_id: perfil, categoria_id: id, anyo: y, mes: m, importe: v })
      }
      for (let m = 0; m <= MH; m++) {
        const v = Array.isArray(pres) ? pres[m] : pres
        if (!v) continue
        for (let j = 0; j < n; j++) {
          const dia = tipo === 'ingreso' || n === 1 ? (tipo === 'ingreso' ? 1 + j : 5) : Math.min(28, 2 + Math.floor(rnd() * 26))
          if (m === MH && dia > DH) continue
          const fijo = n === 1 && ['Alquiler', 'Colegio', 'Suscripciones'].includes(nombre)
          const factor = tipo === 'ingreso' || fijo ? 1 : (0.55 + rnd() * 0.6) * (nombre === 'Restaurantes' && m === 7 ? 1.7 : 1) * (nombre === 'Supermercado' && m === MH ? 1.25 : 1)
          const imp = tipo === 'ingreso' ? v / n : -(v / n) * factor
          db.pf_movimientos.push({ id: uid(), perfil_id: perfil, fecha: `${Y}-${String(m + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`, concepto: conceptos[j % conceptos.length], importe: Math.round(imp * 100) / 100, categoria_id: id, cuenta: j % 2 ? 'Tarjeta' : 'Cuenta principal', etiquetas: nombre === 'Vacaciones' ? ['Verano'] : [], notas: null, created_at: new Date().toISOString() })
        }
      }
    })
  }
  // Un par de movimientos sin categoría para que aparezcan los avisos
  const f = `${Y}-${String(MH + 1).padStart(2, '0')}-${String(Math.max(1, DH - 2)).padStart(2, '0')}`
  db.pf_movimientos.push({ id: uid(), perfil_id: pP, fecha: f, concepto: 'Bizum a Ana', importe: -25, categoria_id: null, cuenta: 'Cuenta principal', etiquetas: [], created_at: '' })
  db.pf_movimientos.push({ id: uid(), perfil_id: pP, fecha: f, concepto: 'Compra online', importe: -64.9, categoria_id: null, cuenta: 'Tarjeta', etiquetas: [], created_at: '' })
  return db
}

class Q {
  constructor(db, t) { this.db = db; this.t = t; this.f = []; this.op = 'select'; this.ord = []; this.single = false; this.rg = null }
  select() { if (this.op === 'insert' || this.op === 'update' || this.op === 'upsert') this.ret = true; else this.op = 'select'; return this }
  eq(k, v) { this.f.push(r => r[k] === v); return this }
  in(k, v) { this.f.push(r => v.includes(r[k])); return this }
  order(k, o = {}) { this.ord.push([k, o.ascending === false ? -1 : 1]); return this }
  range(a, b) { this.rg = [a, b]; return this }
  limit(n) { this.rg = [0, n - 1]; return this }
  maybeSingle() { this.single = true; return this }
  single_() { this.single = true; return this }
  insert(rows) { this.op = 'insert'; this.rows = [].concat(rows); return this }
  update(v) { this.op = 'update'; this.val = v; return this }
  delete() { this.op = 'delete'; return this }
  upsert(rows, o) { this.op = 'upsert'; this.rows = [].concat(rows); this.conf = (o?.onConflict || 'id').split(','); return this }
  then(res, rej) { return Promise.resolve(this.run()).then(res, rej) }
  run() {
    const db = this.db
    if (!db[this.t]) db[this.t] = []
    const T = db[this.t], m = r => this.f.every(f => f(r))
    if (this.op === 'insert') { const out = this.rows.map(r => ({ id: uid(), activa: true, etiquetas: [], created_at: new Date().toISOString(), user_id: YO, ...r })); T.push(...out); return { data: this.ret ? JSON.parse(JSON.stringify(out)) : null, error: null } }
    if (this.op === 'update') { T.filter(m).forEach(r => Object.assign(r, this.val)); return { data: null, error: null } }
    if (this.op === 'delete') { db[this.t] = T.filter(r => !m(r)); if (this.t === 'pf_categorias') { const ids = new Set(db.pf_categorias.map(c => c.id)); db.pf_movimientos.forEach(x => { if (x.categoria_id && !ids.has(x.categoria_id)) x.categoria_id = null }) } return { data: null, error: null } }
    if (this.op === 'upsert') { for (const r of this.rows) { const ex = T.find(x => this.conf.every(k => k === 'user_id' || x[k] === r[k])); ex ? Object.assign(ex, r) : T.push({ ...r }) } return { data: null, error: null } }
    let out = T.filter(m)
    for (const [k, d] of [...this.ord].reverse()) out = [...out].sort((a, b) => (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0) * d)
    if (this.rg) out = out.slice(this.rg[0], this.rg[1] + 1)
    out = JSON.parse(JSON.stringify(out))
    return { data: this.single ? out[0] || null : out, error: null }
  }
}

export function crearClienteDemo() {
  const db = crearDatos()
  const session = { access_token: 'demo', user: { id: YO, email: 'laura@ejemplo.com' } }
  return {
    auth: {
      getSession: async () => ({ data: { session } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signInWithPassword: async () => ({ error: { message: 'Estás en la demo' } }),
      signOut: async () => { location.href = '/' ; return {} },
      updateUser: async () => ({ error: { message: 'En la demo no se puede cambiar la contraseña' } }),
      resetPasswordForEmail: async () => ({ error: null }),
    },
    from: t => new Q(db, t),
    rpc: async () => ({ data: null, error: { message: 'No disponible en la demo' } }),
  }
}
