import { supabase } from '../lib/supabase.js'

const COLUMNS = 'hotel_id,user_id,display_name,role,present,since'

export async function listPresence(hotelId) {
  const { data, error } = await supabase.from('presence').select(COLUMNS).eq('hotel_id', hotelId)
  if (error) throw new Error('Impossibile caricare le presenze')
  return data || []
}

// Si scrive solo con la funzione del server: nome e ruolo li mette lei.
export async function setPresence(hotelId, present) {
  const { data, error } = await supabase.rpc('set_presence', { p_hotel: hotelId, p_present: present })
  if (error) throw new Error('Impossibile aggiornare la presenza')
  return data
}
