import { supabase } from '../lib/supabase.js'
import { bookingConflicts, shiftLabel, shortDate } from '../lib/planning.js'

const WORK_COLUMNS = 'id,hotel_id,description,days,category,assignee_ids,status,created_by,created_at,updated_at,completed_at'
const BOOKING_COLUMNS =
  'id,hotel_id,room,client,date_from,date_to,shift,pax,notes,layout,prep_date,audio_required,video_required,op_status,op_by_name,op_at,audio_status,audio_by_name,audio_at,video_status,video_by_name,video_at,status,created_by,created_at,updated_at'

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
    category: input.category || null,
    assignee_ids: input.assignee_ids || [],
  }
  const { data, error } = await supabase.from('planning_works').insert(row).select(WORK_COLUMNS).single()
  if (error) throw new Error('Impossibile creare il lavoro')
  return data
}

// Giorni dei lavori (uno stato per giorno), con descrizione/categoria/assegnatari del lavoro.
const DAY_COLUMNS =
  'id,hotel_id,work_id,day,status,status_by_name,status_at,planning_works(description,category,assignee_ids)'

export async function listWorkDays(hotelId, { from, to, limit = 500 } = {}) {
  let q = supabase.from('planning_work_days').select(DAY_COLUMNS).eq('hotel_id', hotelId)
  if (from) q = q.gte('day', from)
  if (to) q = q.lte('day', to)
  const { data, error } = await q.order('day', { ascending: true }).limit(limit)
  if (error) throw new Error('Impossibile caricare i giorni di lavoro')
  return (data || []).map(flatDay)
}

export async function listWorkDaysOf(hotelId, workId) {
  const { data, error } = await supabase
    .from('planning_work_days')
    .select(DAY_COLUMNS)
    .eq('hotel_id', hotelId)
    .eq('work_id', workId)
    .order('day', { ascending: true })
    .limit(40)
  if (error) throw new Error('Impossibile caricare i giorni del lavoro')
  return (data || []).map(flatDay)
}

const flatDay = (r) => ({
  id: r.id, hotel_id: r.hotel_id, work_id: r.work_id, day: r.day, status: r.status,
  status_by_name: r.status_by_name, status_at: r.status_at,
  description: r.planning_works?.description || '', category: r.planning_works?.category || null,
  assignee_ids: r.planning_works?.assignee_ids || [],
})

// Cambia lo stato di UN giorno (chi e quando li scrive il server).
export async function setWorkDayStatus(dayId, status) {
  const { data, error } = await supabase.rpc('planning_work_day_set', { p_day: dayId, p_status: status })
  if (error) throw new Error('Impossibile aggiornare il giorno')
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

export async function createBooking(hotelId, userId, input, rooms = []) {
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
    layout: input.layout || null,
    prep_date: input.prep_date || null,
    audio_required: Boolean(input.audio_required),
    video_required: Boolean(input.video_required),
  }
  // Ricontrollo con i dati freschi: riduce il rischio di doppia prenotazione.
  const fresh = await listBookings(hotelId, row.date_from)
  const clash = bookingConflicts(row, fresh, rooms)[0]
  if (clash) {
    throw new Error(`Sala già occupata: ${clash.client} (${shortDate(clash.date_from)}, ${shiftLabel(clash.shift)})`)
  }
  const { data, error } = await supabase.from('sale_bookings').insert(row).select(BOOKING_COLUMNS).single()
  if (error) throw new Error('Impossibile creare la prenotazione')
  return data
}

// Prenotazione su più giorni: una riga per giorno, ognuna col suo turno. Controllo e inserimento in un colpo solo
// (se un giorno è occupato non si salva nulla). La preparazione scelta vale per il primo giorno; gli altri giorni si preparano il giorno stesso.
export async function createBookingDays(hotelId, userId, input, days, rooms = []) {
  if (!days.length) throw new Error('Scegli almeno un giorno')
  const base = {
    hotel_id: hotelId,
    created_by: userId,
    room: input.room.trim(),
    client: input.client.trim(),
    pax: input.pax ? Number(input.pax) : null,
    notes: (input.notes || '').trim() || null,
    layout: input.layout || null,
    audio_required: Boolean(input.audio_required),
    video_required: Boolean(input.video_required),
  }
  const rows = days.map((x, i) => ({ ...base, date_from: x.day, date_to: x.day, shift: x.shift, prep_date: i === 0 ? (input.prep_date || x.day) : x.day }))
  const fresh = await listBookings(hotelId, rows[0].date_from)
  for (const r of rows) {
    const clash = bookingConflicts(r, fresh, rooms)[0]
    if (clash) throw new Error(`Sala già occupata il ${shortDate(r.date_from)}: ${clash.client} (${shiftLabel(clash.shift)})`)
  }
  const { data, error } = await supabase.from('sale_bookings').insert(rows).select(BOOKING_COLUMNS)
  if (error) throw new Error('Impossibile creare la prenotazione')
  return data
}

// Annulla / riattiva (anagrafica della prenotazione, non lo stato operativo).
export async function updateBookingStatus(hotelId, id, status, rooms = []) {
  if (status === 'attiva') {
    const current = await getBooking(hotelId, id)
    if (current) {
      const fresh = await listBookings(hotelId, current.date_from)
      const clash = bookingConflicts({ ...current, status: 'attiva' }, fresh, rooms)[0]
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

// Modifica dei dati della prenotazione (chi può: planning_sale.update).
export async function updateBooking(hotelId, id, input, rooms = []) {
  const row = {
    room: input.room.trim(),
    client: input.client.trim(),
    date_from: input.date_from,
    date_to: input.date_to,
    shift: input.shift,
    pax: input.pax ? Number(input.pax) : null,
    notes: (input.notes || '').trim() || null,
    layout: input.layout || null,
    prep_date: input.prep_date || null,
    audio_required: Boolean(input.audio_required),
    video_required: Boolean(input.video_required),
  }
  const fresh = await listBookings(hotelId, row.date_from)
  const clash = bookingConflicts({ ...row, id }, fresh, rooms)[0]
  if (clash) throw new Error(`Sala già occupata: ${clash.client} (${shortDate(clash.date_from)}, ${shiftLabel(clash.shift)})`)
  const { data, error } = await supabase
    .from('sale_bookings').update(row).eq('hotel_id', hotelId).eq('id', id).select(BOOKING_COLUMNS).single()
  if (error) throw new Error('Impossibile modificare la prenotazione')
  return data
}

// Stato operativo (Da fare · Da finire · Fatto) e check Audio/Video: solo tramite il server.
export async function setBookingOp(id, status) {
  const { data, error } = await supabase.rpc('sale_booking_set_op', { p_id: id, p_status: status })
  if (error) throw new Error(error.message?.includes('controlli') ? error.message : 'Impossibile aggiornare lo stato')
  return data
}
export async function setBookingCheck(id, kind, state) {
  const { data, error } = await supabase.rpc('sale_booking_set_check', { p_id: id, p_kind: kind, p_state: state })
  if (error) throw new Error('Impossibile aggiornare il controllo')
  return data
}
