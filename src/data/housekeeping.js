import { supabase } from '../lib/supabase.js'

const COLUMNS = 'id,hotel_id,room,floor,kind,status,note,active,updated_at'

export async function listRooms(hotelId) {
  const { data, error } = await supabase.from('hk_rooms').select(COLUMNS)
    .eq('hotel_id', hotelId).order('floor').order('room').limit(1000)
  if (error) throw new Error('Impossibile caricare le camere')
  return data || []
}

export async function setRoomStatus(hotelId, userId, id, status) {
  const { data, error } = await supabase.from('hk_rooms').update({ status, updated_by: userId })
    .eq('hotel_id', hotelId).eq('id', id).select(COLUMNS).single()
  if (error) throw new Error('Impossibile aggiornare la camera')
  return data
}

export async function setRoomNote(hotelId, userId, id, note) {
  const { data, error } = await supabase.from('hk_rooms').update({ note: note.trim() || null, updated_by: userId })
    .eq('hotel_id', hotelId).eq('id', id).select(COLUMNS).single()
  if (error) throw new Error('Impossibile salvare la nota')
  return data
}

// Aggiunge più camere di un piano; quelle già presenti vengono saltate (esito per ogni camera).
export async function addRooms(hotelId, userId, floor, rooms, kind) {
  let added = 0
  const skipped = []
  for (const room of rooms) {
    const { error } = await supabase.from('hk_rooms')
      .insert({ hotel_id: hotelId, created_by: userId, room, floor, kind: kind || null })
    if (!error) added += 1
    else if (error.code === '23505') skipped.push(room)
    else throw new Error('Impossibile aggiungere le camere')
  }
  return { added, skipped }
}

export async function setRoomActive(roomId, active) {
  const { error } = await supabase.rpc('hk_set_room_active', { p_room: roomId, p_active: active })
  if (error) throw new Error('Impossibile aggiornare la camera')
}

export async function resetDay(hotelId) {
  const { data, error } = await supabase.rpc('hk_reset_day', { p_hotel: hotelId })
  if (error) throw new Error('Impossibile ripartire la giornata')
  return data
}
