import { supabase } from '../lib/supabase.js'

const COLUMNS =
  'id,hotel_id,device_key,name,kind,role,temperature,humidity,switch_state,online,alert_min,alert_max,last_seen,sort_order,active'

export async function listSensors(hotelId) {
  const { data, error } = await supabase.from('sensors').select(COLUMNS)
    .eq('hotel_id', hotelId).order('sort_order').order('name')
  if (error) throw new Error('Impossibile caricare i sensori')
  return data || []
}

export async function createSensor(hotelId, userId, input) {
  const { data, error } = await supabase.from('sensors').insert({
    hotel_id: hotelId, created_by: userId,
    device_key: input.device_key.trim(), name: input.name.trim(), kind: input.kind, role: input.role || 'ambiente',
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

const SETTINGS_COLUMNS = 'hotel_id,season,winter_min,summer_max,fridge_max'

// Stagione e soglie della struttura (se non ci sono ancora, l'app usa i valori di partenza).
export async function getSettings(hotelId) {
  const { data, error } = await supabase.from('sensor_settings').select(SETTINGS_COLUMNS)
    .eq('hotel_id', hotelId).maybeSingle()
  if (error) throw new Error('Impossibile caricare la stagione')
  return data
}

// Cambia stagione: aggiorna la riga della struttura, oppure la crea la prima volta.
export async function setSeason(hotelId, userId, season) {
  const { data, error } = await supabase.from('sensor_settings').update({ season, updated_by: userId })
    .eq('hotel_id', hotelId).select(SETTINGS_COLUMNS).maybeSingle()
  if (error) throw new Error('Impossibile cambiare stagione')
  if (data) return data
  const created = await supabase.from('sensor_settings').insert({ hotel_id: hotelId, season, updated_by: userId })
    .select(SETTINGS_COLUMNS).single()
  if (created.error) throw new Error('Impossibile cambiare stagione')
  return created.data
}
