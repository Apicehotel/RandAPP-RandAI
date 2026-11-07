import { supabase, functionsUrl, publicKey } from './supabase.js'
import { logError } from './errorlog.js'
import { HOTELS } from './hotels.js'

// Il frontend non confronta mai il PIN: lo manda alla funzione server "randapp-pin-auth".
async function callPinAuth(body) {
  let response
  try {
    response = await fetch(`${functionsUrl}/randapp-pin-auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: publicKey,
        Authorization: `Bearer ${publicKey}`,
      },
      body: JSON.stringify(body),
    })
  } catch (e) {
    logError('accesso', `${body.action}: connessione assente o bloccata`, e?.message)
    throw new Error('Connessione assente. Riprova.')
  }
  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.ok) {
    // Si registra sempre: se è colpa dell'utente (PIN sbagliato, utente bloccato, troppi tentativi) il registro lo dice.
    logError('accesso', `${body.action} → ${response.status}: ${payload?.error || 'risposta non valida'}`,
      payload?.error ? '' : 'La risposta non è quella della funzione di accesso (indirizzo sbagliato o funzione non pubblicata?)',
      { status: response.status })
    throw new Error(payload?.error || `Errore di accesso (${response.status}). Vedi il registro errori.`)
  }
  return payload
}

export async function searchUsers(hotelId, query) {
  const payload = await callPinAuth({ action: 'directory', hotel_id: hotelId, q: query })
  return payload.users || []
}

// Come nella vecchia app: si scrive il nome senza scegliere prima la struttura. L'elenco si cerca in tutte le strutture
// e le persone uguali si uniscono (stesso id) con l'elenco delle loro strutture.
export async function searchUsersAcrossHotels(query) {
  const results = await Promise.allSettled(HOTELS.map((h) => searchUsers(h.id, query).then((users) => ({ hotel: h.id, users }))))
  const ok = results.filter((r) => r.status === 'fulfilled').map((r) => r.value)
  if (!ok.length) throw results[0].reason
  const byId = new Map()
  for (const { hotel, users } of ok) {
    for (const u of users) {
      const cur = byId.get(u.id) || { id: u.id, name: u.name, hotels: [] }
      cur.hotels.push(hotel)
      byId.set(u.id, cur)
    }
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'it'))
}

// Accesso con nome + PIN. Il PIN si prova UNA volta (sulla struttura preferita o la prima): la sessione è della persona,
// quindi vale per tutte le sue strutture. Provarlo su ogni struttura sprecherebbe i tentativi (5 e blocco 10 minuti).
export async function loginUser({ user, pin, preferredHotel = null }) {
  const hotelId = user.hotels.includes(preferredHotel) ? preferredHotel : user.hotels[0]
  const ctx = await loginWithPin({ hotelId, userId: user.id, pin })
  if (!ctx) throw new Error('Accesso alla struttura non consentito')
  return ctx
}

// Impostazioni: come la vecchia app, un solo PIN amministratore (6 cifre), nessun nome. Entra come admin di sistema.
export async function loginAdminPin({ pin, preferredHotel = null }) {
  const payload = await callPinAuth({ action: 'admin_login', pin })
  const { access_token, refresh_token } = payload.session || {}
  if (!access_token || !refresh_token) throw new Error('Sessione non disponibile')
  const { error } = await supabase.auth.setSession({ access_token, refresh_token })
  if (error) throw new Error('Sessione non valida. Riprova.')
  const mine = await listMyHotels()
  const first = mine.find((m) => m.hotel_id === preferredHotel) || mine[0]
  const ctx = first ? await loadContext(first.hotel_id) : null
  if (!ctx) throw new Error('Accesso amministratore non disponibile')
  return ctx
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

// Prova di collegamento per il login: dice in chiaro dove si ferma (configurazione, rete, funzione).
export async function testConnection() {
  if (!functionsUrl) return { ok: false, text: 'App non configurata: mancano indirizzo o chiave del server nella versione installata (causa: app).' }
  const host = functionsUrl.replace(/^https?:\/\//, '').split('/')[0]
  const t0 = Date.now()
  try {
    const r = await fetch(`${functionsUrl}/randapp-pin-auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: publicKey, Authorization: `Bearer ${publicKey}` },
      body: JSON.stringify({ action: 'directory', hotel_id: 'hotelgio', q: 'ma' }),
    })
    const ms = Date.now() - t0
    const j = await r.json().catch(() => null)
    if (r.ok && j?.ok) return { ok: true, text: `Server raggiunto (${host}, ${ms} ms). Il login funziona da qui.` }
    return { ok: false, text: `Il server ${host} risponde ${r.status}${j?.error ? `: ${j.error}` : ' ma non è la funzione di accesso (indirizzo o chiave sbagliati: causa app)'}.` }
  } catch (e) {
    return { ok: false, text: `Non riesco a raggiungere ${host} (${e?.message || 'errore di rete'}). Causa probabile: connessione del telefono, blocco del browser o rete aziendale.` }
  }
}

// Sessione persa: il server l'ha chiusa (per esempio un accesso dello stesso utente su un altro dispositivo) oppure
// il rinnovo non è riuscito. supabase-js lo segnala con SIGNED_OUT: l'app torna al login invece di restare "dentro" con richieste 401.
export const isSessionLost = (event, session) => event === 'SIGNED_OUT' && !session

export function onSessionLost(callback) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    if (isSessionLost(event, session)) callback()
  })
  return () => data.subscription.unsubscribe()
}

// Quando si torna sull'app controlla col server che la sessione esista ancora; se non c'è, chiude in modo pulito.
export async function verifySession() {
  const { data, error } = await supabase.auth.getUser()
  if (data?.user) return true
  if (error && /session|jwt|token|403|401/i.test(`${error.status} ${error.code} ${error.message}`)) {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
    return false
  }
  return true // rete assente o errore temporaneo: non si butta fuori nessuno
}
