import { supabase } from '../lib/supabase.js'

const PRODUCT_COLUMNS = 'id,hotel_id,category,name,active,sort_order'
const REQUEST_COLUMNS = 'id,hotel_id,requested_by,requested_by_name,note,created_at,completed_at'
const ITEM_COLUMNS = 'id,hotel_id,request_id,product_id,product_name,category,status,resolved_by_name,resolved_at,created_at'

export async function listProducts(hotelId) {
  const { data, error } = await supabase.from('supply_products').select(PRODUCT_COLUMNS)
    .eq('hotel_id', hotelId).order('category').order('sort_order').order('name')
  if (error) throw new Error('Impossibile caricare i prodotti')
  return data || []
}

export async function createProduct(hotelId, userId, category, name) {
  const { data, error } = await supabase.from('supply_products')
    .insert({ hotel_id: hotelId, created_by: userId, category, name: name.trim() })
    .select(PRODUCT_COLUMNS).single()
  if (error) throw new Error(error.code === '23505' ? 'Prodotto già presente' : 'Impossibile aggiungere il prodotto')
  return data
}

export async function setProductActive(hotelId, id, active) {
  const { error } = await supabase.from('supply_products').update({ active })
    .eq('hotel_id', hotelId).eq('id', id)
  if (error) throw new Error('Impossibile aggiornare il prodotto')
}

// Richieste recenti con le loro righe (due letture, filtrate per hotel_id).
export async function listRequests(hotelId, { limit = 60 } = {}) {
  const { data: requests, error } = await supabase.from('supply_requests').select(REQUEST_COLUMNS)
    .eq('hotel_id', hotelId).order('created_at', { ascending: false }).limit(limit)
  if (error) throw new Error('Impossibile caricare le richieste')
  if (!requests?.length) return { requests: [], items: [] }
  const { data: items, error: itemsError } = await supabase.from('supply_request_items').select(ITEM_COLUMNS)
    .eq('hotel_id', hotelId).in('request_id', requests.map((r) => r.id))
  if (itemsError) throw new Error('Impossibile caricare le richieste')
  return { requests, items: items || [] }
}

export async function createRequest(hotelId, productIds, note) {
  const { data, error } = await supabase.rpc('supply_create_request', {
    p_hotel: hotelId, p_product_ids: productIds, p_note: note || null,
  })
  if (error) throw new Error('Impossibile inviare la richiesta')
  return data
}

export async function resolveItem(itemId, status) {
  const { error } = await supabase.rpc('supply_resolve_item', { p_item: itemId, p_status: status })
  if (error) throw new Error('Impossibile aggiornare la riga')
}
