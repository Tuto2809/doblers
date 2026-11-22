import { createClient } from '@supabase/supabase-js'
import { crearClienteDemo } from './demo'

// En /demo la app funciona con datos inventados en memoria; nunca toca la base de datos real
export const esDemo = typeof location !== 'undefined' && location.pathname.replace(/\/+$/, '') === '/demo'
// Datos públicos del proyecto (la clave publicable está pensada para ir en el navegador)
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://tzmkyyrzdaysyldkbfbl.supabase.co'
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_FtIUrte2rK0HQWsfAQ8avQ_50AURPLc'
export const supabaseReal = createClient(SUPABASE_URL, SUPABASE_KEY, {
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
