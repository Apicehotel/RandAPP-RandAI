import { supabase } from '../lib/supabase.js'

// Il numero WhatsApp personale: lo legge e lo scrive solo l'utente stesso (funzioni sul server).
export async function getMyPhone() {
  const { data, error } = await supabase.rpc('get_my_phone')
  if (error) throw new Error('Impossibile leggere il numero')
  return data || ''
}

export async function setMyPhone(phone) {
  const { data, error } = await supabase.rpc('set_my_phone', { p_phone: phone })
  if (error) {
    if (/già usato|Numero non valido/.test(error.message || '')) throw new Error(error.message)
    throw new Error('Impossibile salvare il numero')
  }
  return data || ''
}

// Solo admin: chi ha il numero, quali numeri WhatsApp non sono ancora collegati a nessuno.
export async function adminPhoneOverview(hotelId) {
  const { data, error } = await supabase.rpc('admin_phone_overview', { p_hotel: hotelId })
  if (error) throw new Error('Impossibile leggere i numeri')
  return data || []
}

export async function adminSetPhone(hotelId, userId, phone) {
  const { data, error } = await supabase.rpc('admin_set_phone', { p_hotel: hotelId, p_user: userId, p_phone: phone })
  if (error) {
    if (/già usato|Numero non valido|non trovata/.test(error.message || '')) throw new Error(error.message)
    throw new Error('Impossibile salvare il numero')
  }
  return data || ''
}

// Username, nome e cognome: solo la persona stessa (funzioni sul server). Il nome di accesso (display_name) non cambia.
export async function getMyProfile() {
  const { data, error } = await supabase.rpc('get_my_profile')
  if (error) throw new Error('Impossibile leggere i tuoi dati')
  const row = Array.isArray(data) ? data[0] : data
  return { username: row?.username || '', firstName: row?.first_name || '', lastName: row?.last_name || '' }
}

export async function setMyProfile({ username, firstName, lastName }) {
  const { data, error } = await supabase.rpc('set_my_profile', { p_username: username, p_first_name: firstName, p_last_name: lastName })
  if (error) {
    if (/Username|già usato|troppo lungo/.test(error.message || '')) throw new Error(error.message)
    throw new Error('Impossibile salvare i tuoi dati')
  }
  const row = Array.isArray(data) ? data[0] : data
  return { username: row?.username || '', firstName: row?.first_name || '', lastName: row?.last_name || '' }
}
