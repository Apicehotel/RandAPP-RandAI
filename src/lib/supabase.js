import { createClient } from '@supabase/supabase-js'
import { clean, logError, setSink } from './errorlog.js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const missingConfig = [
  !url && 'VITE_SUPABASE_URL',
  !anonKey && 'VITE_SUPABASE_ANON_KEY',
].filter(Boolean)

export const isConfigured = missingConfig.length === 0
export const functionsUrl = isConfigured ? `${url.replace(/\/$/, '')}/functions/v1` : ''
export const publicKey = anonKey || ''

// Ogni richiesta al server che fallisce finisce nel registro errori, con la causa vera (codice, messaggio, suggerimento).
// La chiamata che scrive il registro stesso è esclusa, altrimenti un errore genererebbe altri errori.
async function loggedFetch(input, init) {
  const target = typeof input === 'string' ? input : input?.url || ''
  const method = (init?.method || input?.method || 'GET').toUpperCase()
  const path = target.replace(/^https?:\/\/[^/]+/, '').split('?')[0]
  if (path.includes('log_client_error')) return fetch(input, init)
  let response
  try {
    response = await fetch(input, init)
  } catch (e) {
    logError('rete', `${method} ${path}: ${e?.message || 'connessione assente'}`)
    throw e
  }
  if (!response.ok) {
    let detail = ''
    try { detail = clean(await response.clone().text(), 600) } catch { /* corpo non leggibile */ }
    logError('rete', `${method} ${path} → ${response.status}`, detail, { status: response.status })
  }
  return response
}

// Nessun realtime all'avvio: i dati si caricano quando servono.
export const supabase = isConfigured
  ? createClient(url, anonKey, {
      db: { schema: 'randapp' }, // la nuova app vive nel suo schema; `public` è della vecchia app
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      global: { fetch: loggedFetch },
    })
  : null

if (supabase) {
  let hotel = null
  try { hotel = localStorage.getItem('randapp.hotel') } catch { /* ignora */ }
  setSink((row) => supabase.rpc('log_client_error', {
    p_kind: row.kind, p_message: row.message, p_detail: row.detail || null, p_route: row.route || null,
    p_version: row.version, p_device: row.device || null, p_hotel: hotel,
    p_cause: row.cause || null, p_hint: row.hint || null,
  }))
} else {
  logError('config', `Mancano le variabili: ${missingConfig.join(', ')}`)
}
