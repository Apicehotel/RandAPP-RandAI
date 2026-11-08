import { supabase } from '../lib/supabase.js'

const COLUMNS =
  'id,hotel_id,title,description,category,urgency,status,room,created_by,assigned_to,created_at,updated_at,completed_at'
// Solo nel dettaglio: chi l'ha scritta/chiusa, nota di chiusura, tecnico e pezzo (arrivano anche dall'importazione).
const DETAIL_COLUMNS = `${COLUMNS},source,created_by_name,completed_by_name,completion_note,technician_name,part_replaced`

// Ogni query è sempre filtrata per hotel_id: le policy RLS lo impongono comunque,
// ma il filtro esplicito evita di scaricare dati inutili.
export async function listIssues(hotelId, { limit = 1000 } = {}) {
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
    .select(DETAIL_COLUMNS)
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

// closerName = nome di chi chiude (ctx.name); si salva solo passando a "completata".
export async function updateIssueStatus(hotelId, id, status, closerName = '') {
  const done = status === 'completata'
  const name = String(closerName || '').trim().slice(0, 80)
  const { data, error } = await supabase
    .from('issues')
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

// Foto prima/dopo: si scaricano solo aprendo il dettaglio (pesano fino a 400 KB l'una).
export async function listIssuePhotos(hotelId, issueId) {
  const { data, error } = await supabase
    .from('issue_photos')
    .select('id,kind,data_url')
    .eq('hotel_id', hotelId)
    .eq('issue_id', issueId)
  if (error) throw new Error('Impossibile caricare le foto')
  return data || []
}
