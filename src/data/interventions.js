import { supabase } from '../lib/supabase.js'

const COLUMNS =
  'id,hotel_id,title,location,notes,status,scheduled_at,issue_id,created_by,assigned_to,created_at,updated_at,completed_at'

// Sempre filtrato per hotel_id (la RLS lo impone comunque).
export async function listInterventions(hotelId, { limit = 200 } = {}) {
  const { data, error } = await supabase
    .from('interventions')
    .select(COLUMNS)
    .eq('hotel_id', hotelId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error('Impossibile caricare gli interventi')
  return data || []
}

export async function getIntervention(hotelId, id) {
  const { data, error } = await supabase
    .from('interventions')
    .select(COLUMNS)
    .eq('hotel_id', hotelId)
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error("Impossibile caricare l'intervento")
  return data
}

export async function createIntervention(hotelId, userId, input) {
  const row = {
    hotel_id: hotelId,
    created_by: userId,
    title: input.title.trim(),
    location: (input.location || '').trim() || null,
    notes: (input.notes || '').trim() || null,
    scheduled_at: input.scheduled_at || null,
  }
  const { data, error } = await supabase.from('interventions').insert(row).select(COLUMNS).single()
  if (error) throw new Error("Impossibile creare l'intervento")
  return data
}

export async function updateInterventionStatus(hotelId, id, status) {
  const { data, error } = await supabase
    .from('interventions')
    .update({ status, completed_at: status === 'fatto' ? new Date().toISOString() : null })
    .eq('hotel_id', hotelId)
    .eq('id', id)
    .select(COLUMNS)
    .single()
  if (error) throw new Error('Impossibile aggiornare lo stato')
  return data
}
