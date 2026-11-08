import { supabase, functionsUrl, publicKey } from '../lib/supabase.js'
import { logError } from '../lib/errorlog.js'

const SAFE = /già|non valido|non valida|Non puoi|non trovata|sconosciuto|deve sempre|autorizzato/i

async function rpc(name, args, fallback) {
  const { data, error } = await supabase.rpc(name, args)
  if (error) {
    if (SAFE.test(error.message || '')) throw new Error(error.message)
    throw new Error(fallback)
  }
  return data
}

export const listUsers = async (hotelId) => (await rpc('admin_users_list', { p_hotel: hotelId }, 'Impossibile leggere gli utenti')) || []
export const updateUser = (hotelId, userId, { name, role, active }) =>
  rpc('admin_user_update', { p_hotel: hotelId, p_user: userId, p_name: name, p_role: role, p_active: active }, 'Impossibile salvare l\'utente')
export const unlockUser = (hotelId, userId) => rpc('admin_user_unlock', { p_hotel: hotelId, p_user: userId }, 'Impossibile sbloccare l\'utente')
export const rolesOverview = async (hotelId) => (await rpc('admin_roles_overview', { p_hotel: hotelId }, 'Impossibile leggere i ruoli')) || []
export const canManageGlobalRoles = async (hotelId) => (await rpc('can_manage_global_roles', { p_hotel: hotelId }, 'Impossibile verificare i permessi globali')) === true
export const setRolePermission = (hotelId, role, permission, on) =>
  rpc('admin_role_set', { p_hotel: hotelId, p_role: role, p_permission: permission, p_on: on }, 'Impossibile salvare il permesso')
export const usage = (hotelId) => rpc('admin_usage', { p_hotel: hotelId }, 'Impossibile leggere i consumi')
export const notificationOverview = (hotelId) => rpc('admin_notification_overview', { p_hotel: hotelId }, 'Impossibile leggere le notifiche')

export async function setChannelEnabled(hotelId, channel, enabled) {
  const { error } = await supabase.from('notification_channels').update({ enabled }).eq('hotel_id', hotelId).eq('channel', channel)
  if (error) throw new Error('Impossibile cambiare il canale')
}

// Azioni che servono l'Auth admin API: le fa la funzione server "randapp-admin" (controlla sessione e permesso admin).
async function callAdmin(body) {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token
  if (!token) throw new Error('Sessione scaduta: rientra')
  let response
  try {
    response = await fetch(`${functionsUrl}/randapp-admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: publicKey, Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
  } catch (e) {
    logError('admin', `${body.action}: connessione assente o bloccata`, e?.message)
    throw new Error('Connessione assente. Riprova.')
  }
  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.ok) {
    logError('admin', `${body.action}: ${payload?.error || response.status}`, `HTTP ${response.status}`)
    throw new Error(payload?.error || 'Operazione non riuscita')
  }
  return payload
}

export const createUser = (hotelId, { name, role, pin }) => callAdmin({ action: 'create_user', hotel_id: hotelId, name, role, pin })
export const resetPin = (hotelId, userId, pin) => callAdmin({ action: 'reset_pin', hotel_id: hotelId, user_id: userId, pin })
