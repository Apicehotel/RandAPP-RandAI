import { supabase } from '../lib/supabase.js'
import { bookingConflicts, shiftLabel, shortDate } from '../lib/planning.js'

const WORK_COLUMNS = 'id,hotel_id,description,days,status,created_by,created_at,updated_at,completed_at'
const BOOKING_COLUMNS =
  'id,hotel_id,room,client,date_from,date_to,shift,pax,notes,status,created_by,created_at,updated_at'

// ---- Planning Lavori (sempre filtrato per hotel_id)
export async function listWorks(hotelId, { limit = 300 } = {}) {
  const { data, error } = await supabase
    .from('planning_works')
    .select(WORK_COLUMNS)
    .eq('hotel_id', hotelId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error('Impossibile caricare i lavori')
  return data || []
}

export async function getWork(hotelId, id) {
  const { data, error } = await supabase
    .from('planning_works')
    .select(WORK_COLUMNS)
    .eq('hotel_id', hotelId)
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error('Impossibile caricare il lavoro')
  return data
}

export async function createWork(hotelId, userId, input) {
  const row = {
    hotel_id: hotelId,
    created_by: userId,
    description: input.description.trim(),
    days: [...new Set(input.days)].sort(),
  }
  const { data, error } = await supabase.from('planning_works').insert(row).select(WORK_COLUMNS).single()
  if (error) throw new Error('Impossibile creare il lavoro')
  return data
}

export async function updateWorkStatus(hotelId, id, status) {
  const { data, error } = await supabase
    .from('planning_works')
    .update({ status, completed_at: status === 'fatto' ? new Date().toISOString() : null })
    .eq('hotel_id', hotelId)
    .eq('id', id)
    .select(WORK_COLUMNS)
    .single()
  if (error) throw new Error('Impossibile aggiornare lo stato')
  return data
}

// ---- Planning Sale
// Carica le prenotazioni che finiscono da "fromIso" in poi (quelle passate non servono).
export async function listBookings(hotelId, fromIso, { limit = 500 } = {}) {
  const { data, error } = await supabase
    .from('sale_bookings')
    .select(BOOKING_COLUMNS)
    .eq('hotel_id', hotelId)
    .gte('date_to', fromIso)
    .order('date_from', { ascending: true })
    .limit(limit)
  if (error) throw new Error('Impossibile caricare le prenotazioni')
  return data || []
}

export async function getBooking(hotelId, id) {
  const { data, error } = await supabase
    .from('sale_bookings')
    .select(BOOKING_COLUMNS)
    .eq('hotel_id', hotelId)
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error('Impossibile caricare la prenotazione')
  return data
}

export async function createBooking(hotelId, userId, input) {
  const row = {
    hotel_id: hotelId,
    created_by: userId,
    room: input.room.trim(),
    client: input.client.trim(),
    date_from: input.date_from,
    date_to: input.date_to,
    shift: input.shift,
    pax: input.pax ? Number(input.pax) : null,
    notes: (input.notes || '').trim() || null,
  }
  // Ricontrollo con i dati freschi: riduce il rischio di doppia prenotazione.
  const fresh = await listBookings(hotelId, row.date_from)
  const clash = bookingConflicts(row, fresh)[0]
  if (clash) {
    throw new Error(`Sala già occupata: ${clash.client} (${shortDate(clash.date_from)}, ${shiftLabel(clash.shift)})`)
  }
  const { data, error } = await supabase.from('sale_bookings').insert(row).select(BOOKING_COLUMNS).single()
  if (error) throw new Error('Impossibile creare la prenotazione')
  return data
}

export async function updateBookingStatus(hotelId, id, status) {
  if (status === 'attiva') {
    const current = await getBooking(hotelId, id)
    if (current) {
      const fresh = await listBookings(hotelId, current.date_from)
      const clash = bookingConflicts({ ...current, status: 'attiva' }, fresh)[0]
      if (clash) throw new Error(`Non si può riattivare: sala occupata da ${clash.client}`)
    }
  }
  const { data, error } = await supabase
    .from('sale_bookings')
    .update({ status })
    .eq('hotel_id', hotelId)
    .eq('id', id)
    .select(BOOKING_COLUMNS)
    .single()
  if (error) throw new Error('Impossibile aggiornare la prenotazione')
  return data
}
