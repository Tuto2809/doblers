import { createClient } from '@supabase/supabase-js'
import { crearClienteDemo } from './demo'

// En /demo la app funciona con datos inventados en memoria; nunca toca la base de datos real
export const esDemo = typeof location !== 'undefined' && location.pathname.replace(/\/+$/, '') === '/demo'
export const supabaseReal = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'pf-auth' },
})
export const supabase = esDemo ? crearClienteDemo() : supabaseReal

// Supabase devuelve como máximo 1000 filas por petición: paginamos
export async function fetchAll(build) {
  const size = 1000
  let from = 0
  const out = []
  for (;;) {
    const { data, error } = await build().range(from, from + size - 1)
    if (error) throw error
    out.push(...data)
    if (data.length < size) break
    from += size
  }
  return out
}
