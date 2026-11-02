import { supabase } from '../lib/supabase.js'

// Catalogo camere/zone della struttura (sola lettura per tutti i colleghi).
export async function listLocations(hotelId) {
  const { data, error } = await supabase
    .from('hotel_locations')
    .select('id,kind,name,group_name,aliases,sort_order,active')
    .eq('hotel_id', hotelId)
    .eq('active', true)
    .order('sort_order', { ascending: true })
    .limit(1000)
  if (error) throw new Error('Impossibile caricare camere e zone')
  return data || []
}

// Colleghi della stessa struttura: la funzione del server restituisce solo nome e ruolo.
export async function listStaff(hotelId) {
  const { data, error } = await supabase.rpc('hotel_staff', { p_hotel: hotelId })
  if (error) throw new Error('Impossibile caricare i colleghi')
  return data || []
}

// ---- Sale: configurazione, allestimenti, clienti
export async function getSaleConfig(hotelId) {
  const [rooms, layouts, clients] = await Promise.all([
    supabase.from('sale_rooms').select('id,name,capacity,sort_order,active').eq('hotel_id', hotelId).order('sort_order').limit(200),
    supabase.from('sale_layouts').select('id,name,sort_order').eq('hotel_id', hotelId).order('sort_order').limit(200),
    supabase
      .from('sale_clients')
      .select('id,name,preferred_room,preferred_layout,preferred_pax,notes')
      .eq('hotel_id', hotelId)
      .order('name')
      .limit(500),
  ])
  if (rooms.error || layouts.error || clients.error) throw new Error('Impossibile caricare sale e clienti')
  return { rooms: rooms.data || [], layouts: layouts.data || [], clients: clients.data || [] }
}

export async function addSaleRoom(hotelId, { name, capacity, sort_order }) {
  const row = { hotel_id: hotelId, name: name.trim(), capacity: capacity ? Number(capacity) : null, sort_order: sort_order || 0 }
  const { data, error } = await supabase.from('sale_rooms').insert(row).select('id,name,capacity,sort_order,active').single()
  if (error) throw new Error(error.code === '23505' ? 'Esiste già una sala con questo nome' : 'Impossibile aggiungere la sala')
  return data
}

export async function setSaleRoomActive(hotelId, id, active) {
  const { error } = await supabase.from('sale_rooms').update({ active }).eq('hotel_id', hotelId).eq('id', id)
  if (error) throw new Error('Impossibile aggiornare la sala')
}

export async function addSaleLayout(hotelId, name) {
  const { data, error } = await supabase
    .from('sale_layouts')
    .insert({ hotel_id: hotelId, name: name.trim() })
    .select('id,name,sort_order')
    .single()
  if (error) throw new Error(error.code === '23505' ? 'Esiste già questo allestimento' : "Impossibile aggiungere l'allestimento")
  return data
}

// Richiamo cliente: se il nome esiste lo aggiorna, altrimenti lo crea.
export async function saveSaleClient(hotelId, client) {
  const row = {
    hotel_id: hotelId,
    name: client.name.trim(),
    preferred_room: client.room || null,
    preferred_layout: client.layout || null,
    preferred_pax: client.pax ? Number(client.pax) : null,
    notes: (client.notes || '').trim() || null,
  }
  const { error } = await supabase.from('sale_clients').upsert(row, { onConflict: 'hotel_id,name' })
  if (error) throw new Error('Impossibile salvare il richiamo cliente')
}
