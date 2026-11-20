import { supabase } from '../lib/supabase.js'
import { enqueue, fail, isNetworkError, newId, withTimeout } from '../lib/outbox.js'
import { readThrough } from '../lib/offline-cache.js'

const COLUMNS =
  'id,hotel_id,title,description,category,urgency,status,room,created_by,assigned_to,created_at,updated_at,completed_at'
// Solo nel dettaglio: chi l'ha scritta/chiusa, nota di chiusura, tecnico e pezzo (arrivano anche dall'importazione).
const DETAIL_COLUMNS = `${COLUMNS},source,created_by_name,completed_by_name,completion_note,technician_name,part_replaced,part_needed`

// Ogni query è sempre filtrata per hotel_id: le policy RLS lo impongono comunque,
// ma il filtro esplicito evita di scaricare dati inutili.
export async function listIssues(hotelId, { limit = 1000 } = {}) {
  // Senza rete si rivede l'ultima copia (le 300 più recenti).
  return readThrough(`issues:${hotelId}`, async () => {
    const { data, error } = await supabase
      .from('issues')
      .select(`${COLUMNS},issue_photos(count)`)
      .eq('hotel_id', hotelId)
      .order('created_at', { ascending: false })
      .limit(limit)
      .retry(false)
    if (error) throw fail('Impossibile caricare le segnalazioni', error)
    // Solo il numero di foto (0-2): le foto vere si scaricano nel dettaglio.
    return (data || []).map(({ issue_photos: ph, ...row }) => ({ ...row, photo_count: ph?.[0]?.count || 0 }))
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

// Miniatura per l'elenco (come l'app HotelGio): si scarica la sola foto «prima» della segnalazione,
// una volta per sessione e solo per le schede visibili (vedi IssueThumb).
const thumbCache = new Map()
export function getIssueThumb(hotelId, issueId) {
  const key = `${hotelId}:${issueId}`
  if (!thumbCache.has(key)) {
    thumbCache.set(key, supabase
      .from('issue_photos')
      .select('data_url')
      .eq('hotel_id', hotelId)
      .eq('issue_id', issueId)
      .eq('kind', 'prima')
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) throw new Error('Impossibile caricare la foto')
        return data?.data_url || null
      })
      .catch((e) => { thumbCache.delete(key); throw e }))
  }
  return thumbCache.get(key)
}

// Aggiunge la foto «prima» o «dopo» (una sola per tipo: vale la regola unique del database).
export async function addIssuePhoto(hotelId, issueId, kind, dataUrl) {
  const { error } = await supabase.from('issue_photos').insert({ hotel_id: hotelId, issue_id: issueId, kind, data_url: dataUrl })
  if (error) {
    if (error.code === '23505') throw new Error('Questa foto c\'è già')
    throw new Error('Impossibile salvare la foto')
  }
}

const clean = (v, max) => String(v || '').trim().slice(0, max) || null

// «Lavoro svolto» (come HotelGio): nota, pezzo sostituito, tecnico. Con complete=true chiude anche la segnalazione.
// Solo colonne già concesse dal grant (vedi 0033): nessuna migrazione.
export async function saveIssueWork(hotelId, id, { note, part, technician, complete = false, closerName = '' }) {
  const patch = { completion_note: clean(note, 2000), part_replaced: clean(part, 200), technician_name: clean(technician, 120) }
  if (complete) {
    patch.status = 'completata'
    patch.completed_at = new Date().toISOString()
    patch.completed_by_name = clean(closerName, 80)
  }
  const { data, error } = await supabase.from('issues').update(patch).eq('hotel_id', hotelId).eq('id', id).select(COLUMNS).single()
  if (error) throw new Error('Impossibile salvare')
  return data
}

// «Serve pezzo»: la segnalazione passa in «Attesa pezzo» con il nome del pezzo; «Pezzo arrivato» la rimette «Da fare».
export async function requestPart(hotelId, id, partName) {
  const name = clean(partName, 200)
  if (!name) throw new Error('Scrivi quale pezzo serve')
  const { data, error } = await supabase.from('issues').update({ status: 'attesa_pezzo', part_needed: name }).eq('hotel_id', hotelId).eq('id', id).select(COLUMNS).single()
  if (error) throw new Error('Impossibile salvare')
  return data
}

export async function partArrived(hotelId, id) {
  const { data, error } = await supabase.from('issues').update({ status: 'da_fare' }).eq('hotel_id', hotelId).eq('id', id).select(COLUMNS).single()
  if (error) throw new Error('Impossibile salvare')
  return data
}

// Modifica dei dettagli (camera/zona, descrizione, urgenza, categoria): colonne già concesse dalla 0033.
export async function updateIssueDetails(hotelId, id, { room, title, urgency, category }) {
  const t = clean(title, 140)
  if (!t) throw new Error('Scrivi la descrizione')
  const { data, error } = await supabase.from('issues')
    .update({ title: t, room: clean(room, 60), urgency, category })
    .eq('hotel_id', hotelId).eq('id', id).select(COLUMNS).single()
  if (error) throw new Error('Impossibile salvare')
  return data
}
