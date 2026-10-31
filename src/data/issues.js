import { supabase } from '../lib/supabase.js'

const COLUMNS =
  'id,hotel_id,title,description,category,urgency,status,room,created_by,assigned_to,created_at,updated_at,completed_at'

// Ogni query è sempre filtrata per hotel_id: le policy RLS lo impongono comunque,
// ma il filtro esplicito evita di scaricare dati inutili.
export async function listIssues(hotelId, { limit = 200 } = {}) {
  const { data, error } = await supabase
    .from('issues')
    .select(COLUMNS)
    .eq('hotel_id', hotelId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error('Impossibile caricare le segnalazioni')
  return data || []
}

export async function getIssue(hotelId, id) {
  const { data, error } = await supabase
    .from('issues')
    .select(COLUMNS)
    .eq('hotel_id', hotelId)
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error('Impossibile caricare la segnalazione')
  return data
}

export async function createIssue(hotelId, userId, input) {
  const row = {
    hotel_id: hotelId,
    created_by: userId,
    title: input.title.trim(),
    description: (input.description || '').trim() || null,
    category: input.category,
    urgency: input.urgency,
    room: (input.room || '').trim() || null,
  }
  const { data, error } = await supabase.from('issues').insert(row).select(COLUMNS).single()
  if (error) throw new Error('Impossibile creare la segnalazione')
  return data
}

export async function updateIssueStatus(hotelId, id, status) {
  const { data, error } = await supabase
    .from('issues')
    .update({
      status,
      completed_at: status === 'completata' ? new Date().toISOString() : null,
    })
    .eq('hotel_id', hotelId)
    .eq('id', id)
    .select(COLUMNS)
    .single()
  if (error) throw new Error('Impossibile aggiornare lo stato')
  return data
}
