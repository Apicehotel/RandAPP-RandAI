import { supabase } from '../lib/supabase.js'

const ITEM_COLUMNS = 'id,hotel_id,name,category,unit,quantity,min_quantity,location,notes,active,created_at,updated_at'
const MOVE_COLUMNS = 'id,hotel_id,item_id,kind,delta,quantity_after,note,created_by,created_at'

// Sempre filtrato per hotel_id (la RLS lo impone comunque).
export async function listItems(hotelId, { limit = 500 } = {}) {
  const { data, error } = await supabase.from('inventory_items').select(ITEM_COLUMNS)
    .eq('hotel_id', hotelId).order('name').limit(limit)
  if (error) throw new Error("Impossibile caricare il magazzino")
  return data || []
}

export async function getItem(hotelId, id) {
  const { data, error } = await supabase.from('inventory_items').select(ITEM_COLUMNS)
    .eq('hotel_id', hotelId).eq('id', id).maybeSingle()
  if (error) throw new Error("Impossibile caricare l'articolo")
  return data
}

export async function listMovements(hotelId, itemId, { limit = 50 } = {}) {
  const { data, error } = await supabase.from('inventory_movements').select(MOVE_COLUMNS)
    .eq('hotel_id', hotelId).eq('item_id', itemId).order('created_at', { ascending: false }).limit(limit)
  if (error) throw new Error('Impossibile caricare i movimenti')
  return data || []
}

export async function createItem(hotelId, userId, input) {
  const row = {
    hotel_id: hotelId,
    created_by: userId,
    name: input.name.trim(),
    category: (input.category || '').trim() || null,
    unit: (input.unit || '').trim() || 'pz',
    min_quantity: input.min_quantity ?? 0,
    location: (input.location || '').trim() || null,
    notes: (input.notes || '').trim() || null,
  }
  const { data, error } = await supabase.from('inventory_items').insert(row).select(ITEM_COLUMNS).single()
  if (error) throw new Error(error.code === '23505' ? 'Esiste già un articolo con questo nome' : "Impossibile creare l'articolo")
  return data
}

export async function updateItem(hotelId, id, patch) {
  const { data, error } = await supabase.from('inventory_items').update(patch)
    .eq('hotel_id', hotelId).eq('id', id).select(ITEM_COLUMNS).single()
  if (error) throw new Error("Impossibile aggiornare l'articolo")
  return data
}

// La giacenza cambia solo da qui (funzione del server): lascia sempre un movimento.
export async function moveStock(itemId, kind, amount, note) {
  const { data, error } = await supabase.rpc('inventory_move', {
    p_item: itemId, p_kind: kind, p_amount: amount, p_note: note || null,
  })
  if (error) throw new Error(/insufficiente/i.test(error.message) ? 'Giacenza insufficiente' : 'Movimento non riuscito')
  return data
}
