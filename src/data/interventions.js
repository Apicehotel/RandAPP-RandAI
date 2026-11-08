import { supabase } from '../lib/supabase.js'

const COLUMNS =
  'id,hotel_id,title,location,notes,status,scheduled_at,scheduled_until,category,rooms,assignee_ids,issue_id,created_by,assigned_to,created_at,updated_at,completed_at,created_by_name,completed_by_name,rooms_done'

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
    scheduled_until: input.scheduled_until || null,
    category: input.category || null,
    rooms: input.rooms || [],
    assignee_ids: input.assignee_ids || [],
    assigned_to: (input.assignee_ids || [])[0] || null,
    issue_id: input.issue_id || null,
  }
  const { data, error } = await supabase.from('interventions').insert(row).select(COLUMNS).single()
  if (error) throw new Error("Impossibile creare l'intervento")
  return data
}

// closerName = nome di chi chiude (ctx.name); si salva solo passando a "fatto".
export async function updateInterventionStatus(hotelId, id, status, closerName = '') {
  const done = status === 'fatto'
  const name = String(closerName || '').trim().slice(0, 80)
  const { data, error } = await supabase
    .from('interventions')
    .update({
      status,
      completed_at: done ? new Date().toISOString() : null,
      completed_by_name: done ? (name || null) : null,
    })
    .eq('hotel_id', hotelId)
    .eq('id', id)
    .select(COLUMNS)
    .single()
  if (error) throw new Error('Impossibile aggiornare lo stato')
  return data
}

// Interventi nati da una segnalazione.
export async function listInterventionsForIssue(hotelId, issueId) {
  const { data, error } = await supabase
    .from('interventions')
    .select('id,title,status')
    .eq('hotel_id', hotelId)
    .eq('issue_id', issueId)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw new Error('Impossibile caricare gli interventi collegati')
  return data || []
}
