import { supabase } from '../lib/supabase.js'
import { enqueue, fail, isNetworkError, newId, withTimeout } from '../lib/outbox.js'
import { readThrough } from '../lib/offline-cache.js'

const COLUMNS =
  'id,hotel_id,title,description,category,urgency,status,room,created_by,assigned_to,created_at,updated_at,completed_at'
// Solo nel dettaglio: chi l'ha scritta/chiusa, nota di chiusura, tecnico e pezzo (arrivano anche dall'importazione).
const DETAIL_COLUMNS = `${COLUMNS},source,created_by_name,completed_by_name,completion_note,technician_name,part_replaced`

// Ogni query è sempre filtrata per hotel_id: le policy RLS lo impongono comunque,
// ma il filtro esplicito evita di scaricare dati inutili.
export async function listIssues(hotelId, { limit = 1000 } = {}) {
  // Senza rete si rivede l'ultima copia (le 300 più recenti).
  return readThrough(`issues:${hotelId}`, async () => {
    const { data, error } = await supabase
      .from('issues')
      .select(COLUMNS)
      .eq('hotel_id', hotelId)
      .order('created_at', { ascending: false })
      .limit(limit)
      .retry(false)
    if (error) throw fail('Impossibile caricare le segnalazioni', error)
    return data || []
  }, { limit: 300 })
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

// Senza rete la segnalazione si salva sul telefono e parte da sola (risposta con `pending: true`).
// L'id è deciso qui: se la risposta del server si perde e si invia due volte, il secondo invio non crea un doppione.
export async function createIssue(hotelId, userId, input) {
  const row = {
    id: newId(),
    hotel_id: hotelId,
    created_by: userId,
    title: input.title.trim(),
    description: (input.description || '').trim() || null,
    category: input.category,
    urgency: input.urgency,
    room: (input.room || '').trim() || null,
  }
  const { data, error } = await withTimeout(supabase.from('issues').insert(row).select(COLUMNS).single()).catch((e) => ({ data: null, error: e }))
  if (!error) return data
  if (!isNetworkError(error)) throw new Error('Impossibile creare la segnalazione')
  const queued = enqueue({ kind: 'issue.create', hotelId, userId, payload: { row } })
  if (!queued) throw new Error('Senza connessione e con la memoria del telefono piena: la segnalazione NON è stata salvata')
  return { ...row, status: 'da_fare', created_at: queued.createdAt, pending: true }
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
