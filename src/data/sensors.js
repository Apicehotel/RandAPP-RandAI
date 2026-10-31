import { supabase } from '../lib/supabase.js'

const COLUMNS =
  'id,hotel_id,device_key,name,kind,temperature,humidity,switch_state,online,alert_min,alert_max,last_seen,sort_order,active'

export async function listSensors(hotelId) {
  const { data, error } = await supabase.from('sensors').select(COLUMNS)
    .eq('hotel_id', hotelId).order('sort_order').order('name')
  if (error) throw new Error('Impossibile caricare i sensori')
  return data || []
}

export async function createSensor(hotelId, userId, input) {
  const { data, error } = await supabase.from('sensors').insert({
    hotel_id: hotelId, created_by: userId,
    device_key: input.device_key.trim(), name: input.name.trim(), kind: input.kind,
    alert_min: input.alert_min, alert_max: input.alert_max,
  }).select(COLUMNS).single()
  if (error) throw new Error(error.code === '23505' ? 'Esiste già un sensore con questo codice' : 'Impossibile aggiungere il sensore')
  return data
}

export async function updateSensor(hotelId, id, patch) {
  const { data, error } = await supabase.from('sensors').update(patch)
    .eq('hotel_id', hotelId).eq('id', id).select(COLUMNS).single()
  if (error) throw new Error('Impossibile aggiornare il sensore')
  return data
}
