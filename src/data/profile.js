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
