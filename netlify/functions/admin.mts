import { createClient } from '@supabase/supabase-js'

// Acciones de administración que necesitan la clave de servicio de Supabase:
// crear usuarios y poner contraseñas temporales. Solo las puede llamar un admin activo.

const json = (data: unknown, status = 200) => Response.json(data, { status })

function passwordTemporal() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  return Array.from(bytes, b => chars[b % chars.length]).join('').replace(/(.{4})(?!$)/g, '$1-')
}

export default async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)
  const url = Netlify.env.get('SUPABASE_URL') || Netlify.env.get('VITE_SUPABASE_URL')
  const serviceKey = Netlify.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) return json({ error: 'Falta configurar SUPABASE_SERVICE_ROLE_KEY en Netlify.' }, 500)

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  // ¿Quién llama? Debe ser un administrador activo de Presupuesto
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'No autenticado' }, 401)
  const { data: who, error: whoErr } = await admin.auth.getUser(token)
  if (whoErr || !who?.user) return json({ error: 'Sesión no válida' }, 401)
  const { data: yo } = await admin.from('pf_usuarios').select('es_admin, activo').eq('id', who.user.id).maybeSingle()
  if (!yo?.es_admin || !yo.activo) return json({ error: 'Solo el administrador puede hacer esto' }, 403)

  let body: any
  try { body = await req.json() } catch { return json({ error: 'Petición no válida' }, 400) }

  if (body.accion === 'crear') {
    const nombre = String(body.nombre || '').trim()
    const email = String(body.email || '').trim().toLowerCase()
    if (!nombre || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'Nombre o email no válidos' }, 400)

    // ¿Ya existe la cuenta en este proyecto (por ejemplo, de otra app)?
    let existente: any = null
    for (let page = 1; page <= 20 && !existente; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
      if (error) return json({ error: error.message }, 500)
      existente = data.users.find(u => (u.email || '').toLowerCase() === email) || null
      if (data.users.length < 200) break
    }

    let userId: string, password: string | null = null
    if (existente) {
      userId = existente.id
    } else {
      password = passwordTemporal()
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { nombre } })
      if (error) return json({ error: error.message }, 400)
      userId = data.user.id
    }

    const { error: altaErr } = await admin.rpc('pf_alta_usuario', { p_id: userId, p_nombre: nombre, p_email: email, p_admin: false })
    if (altaErr) return json({ error: altaErr.message }, 500)

    const perfiles: string[] = Array.isArray(body.perfiles) ? body.perfiles : []
    if (perfiles.length) {
      const { data: comp } = await admin.from('pf_perfiles').select('id').in('id', perfiles).eq('tipo', 'compartido')
      const filas = (comp || []).map(p => ({ perfil_id: p.id, user_id: userId }))
      if (filas.length) {
        const { error } = await admin.from('pf_perfil_miembros').upsert(filas, { onConflict: 'perfil_id,user_id', ignoreDuplicates: true })
        if (error) return json({ error: error.message }, 500)
      }
    }
    return json({ ok: true, user_id: userId, password, existente: !!existente })
  }

  if (body.accion === 'reset') {
    const id = String(body.user_id || '')
    if (id === who.user.id) return json({ error: 'Tu propia contraseña se cambia desde Ajustes' }, 400)
    const { data: u } = await admin.from('pf_usuarios').select('id').eq('id', id).maybeSingle()
    if (!u) return json({ error: 'Ese usuario no pertenece a Presupuesto' }, 404)
    const password = passwordTemporal()
    const { error } = await admin.auth.admin.updateUserById(id, { password })
    if (error) return json({ error: error.message }, 400)
    return json({ ok: true, password })
  }

  return json({ error: 'Acción desconocida' }, 400)
}
