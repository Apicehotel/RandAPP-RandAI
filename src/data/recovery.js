import { supabase, functionsUrl, publicKey } from '../lib/supabase.js'
import { logError } from '../lib/errorlog.js'

async function call(body) {
  let response
  try {
    response = await fetch(`${functionsUrl}/randapp-pin-recovery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: publicKey, Authorization: `Bearer ${publicKey}` },
      body: JSON.stringify(body),
    })
  } catch (e) {
    logError('recupero PIN', `${body.action}: connessione assente o bloccata`, e?.message)
    throw new Error('Connessione assente. Riprova.')
  }
  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.ok) {
    logError('recupero PIN', `${body.action} → ${response.status}: ${payload?.error || 'risposta non valida'}`, '', { status: response.status })
    throw new Error(payload?.error || `Errore (${response.status}). Vedi il registro errori.`)
  }
  return payload
}

// La risposta è sempre la stessa: non dice se l'utente ha un'email.
export const requestPinRecovery = (userId, channel = 'email') => call({ action: 'request', user_id: userId, channel })
export const completePinRecovery = (token, newPin, extra = {}) => call({ action: 'complete', token, new_pin: newPin, ...extra })
export const recoveryStatus = async () => (await call({ action: 'status' })).configured === true
export const recoveryChannels = async () => { const data = await call({ action: 'status' }); return { email: data.configured === true, whatsapp: data.whatsapp_enabled === true } }

export async function getMyEmail() {
  const { data, error } = await supabase.rpc('get_my_email')
  if (error) throw new Error('Impossibile leggere l\'email')
  return data || ''
}

export async function setMyEmail(email) {
  const { data, error } = await supabase.rpc('set_my_email', { p_email: email })
  if (error) {
    if (/Email non valida|già usata/.test(error.message || '')) throw new Error(error.message)
    throw new Error('Impossibile salvare l\'email')
  }
  return data || ''
}
