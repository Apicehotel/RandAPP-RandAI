import { supabase } from '../lib/supabase.js'
import { dropPending, enqueue, fail, isNetworkError, withTimeout } from '../lib/outbox.js'
import { readThrough } from '../lib/offline-cache.js'

const COLUMNS = 'id,hotel_id,room,floor,kind,status,note,active,updated_at'

export async function listRooms(hotelId) {
  return readThrough(`rooms:${hotelId}`, async () => {
    const { data, error } = await supabase.from('hk_rooms').select(COLUMNS)
      .eq('hotel_id', hotelId).order('floor').order('room').limit(1000).retry(false)
    if (error) throw fail('Impossibile caricare le camere', error)
    return data || []
  })
}

// Stato e nota di una camera si possono cambiare anche senza rete: restano in coda (vince l'ultima modifica) e partono da soli.
async function writeRoom(kind, hotelId, userId, id, fields, errorText) {
  const { data, error } = await withTimeout(
    supabase.from('hk_rooms').update({ ...fields, updated_by: userId }).eq('hotel_id', hotelId).eq('id', id).select(COLUMNS).single(),
  ).catch((e) => ({ data: null, error: e }))
  if (!error) {
    dropPending({ kind, hotelId, userId, roomId: id }) // una modifica più vecchia in coda non deve sovrascrivere questa
    return data
  }
  if (!isNetworkError(error)) throw new Error(errorText)
  const payload = kind === 'hk.status' ? { roomId: id, status: fields.status } : { roomId: id, note: fields.note }
  if (!enqueue({ kind, hotelId, userId, payload })) throw new Error('Senza connessione e con la memoria del telefono piena: modifica NON salvata')
  return { id, ...fields, pending: true }
}

export const setRoomStatus = (hotelId, userId, id, status) =>
  writeRoom('hk.status', hotelId, userId, id, { status }, 'Impossibile aggiornare la camera')

export const setRoomNote = (hotelId, userId, id, note) =>
  writeRoom('hk.note', hotelId, userId, id, { note: note.trim() || null }, 'Impossibile salvare la nota')

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
