import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const missingConfig = [
  !url && 'VITE_SUPABASE_URL',
  !anonKey && 'VITE_SUPABASE_ANON_KEY',
].filter(Boolean)

export const isConfigured = missingConfig.length === 0
export const functionsUrl = isConfigured ? `${url.replace(/\/$/, '')}/functions/v1` : ''
export const publicKey = anonKey || ''

// Nessun realtime all'avvio: i dati si caricano quando servono.
export const supabase = isConfigured
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    })
  : null
