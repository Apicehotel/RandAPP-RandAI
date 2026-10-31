import { supabase, functionsUrl, publicKey } from './supabase.js'

// Il frontend non confronta mai il PIN: lo manda alla funzione server "pin-auth".
async function callPinAuth(body) {
  let response
  try {
    response = await fetch(`${functionsUrl}/pin-auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: publicKey,
        Authorization: `Bearer ${publicKey}`,
      },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error('Connessione assente. Riprova.')
  }
  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || 'Errore temporaneo di accesso')
  }
  return payload
}

export async function searchUsers(hotelId, query) {
  const payload = await callPinAuth({ action: 'directory', hotel_id: hotelId, q: query })
  return payload.users || []
}

export async function loginWithPin({ hotelId, userId, pin }) {
  const payload = await callPinAuth({ action: 'login', hotel_id: hotelId, user_id: userId, pin })
  const { access_token, refresh_token } = payload.session || {}
  if (!access_token || !refresh_token) throw new Error('Sessione non disponibile')
  const { error } = await supabase.auth.setSession({ access_token, refresh_token })
  if (error) throw new Error('Sessione non valida. Riprova.')
  return loadContext(hotelId)
}

// Ruolo e permessi si leggono dal database, non dalla risposta del login.
export async function loadContext(hotelId) {
  const { data: userData } = await supabase.auth.getUser()
  const user = userData?.user
  if (!user) return null

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from('profiles').select('display_name').eq('auth_user_id', user.id).maybeSingle(),
    supabase
      .from('hotel_memberships')
      .select('role, active')
      .eq('auth_user_id', user.id)
      .eq('hotel_id', hotelId)
      .maybeSingle(),
  ])
  if (!membership?.active) return null

  const { data: perms } = await supabase
    .from('role_permissions')
    .select('permission')
    .eq('role', membership.role)

  return {
    userId: user.id,
    name: profile?.display_name || '',
    hotelId,
    role: membership.role,
    permissions: new Set((perms || []).map((p) => p.permission)),
  }
}

// Le strutture a cui l'utente collegato ha accesso (per cambiare struttura senza rifare il PIN).
export async function listMyHotels() {
  const { data: userData } = await supabase.auth.getUser()
  const user = userData?.user
  if (!user) return []
  const { data, error } = await supabase
    .from('hotel_memberships')
    .select('hotel_id, role')
    .eq('auth_user_id', user.id)
    .eq('active', true)
  if (error) throw new Error('Impossibile caricare le strutture')
  return data || []
}

export async function hasActiveSession() {
  const { data } = await supabase.auth.getSession()
  return Boolean(data?.session)
}

export async function logout() {
  await supabase.auth.signOut()
}
