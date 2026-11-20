import { supabase, functionsUrl, publicKey } from '../lib/supabase.js'

// Personale: crea il link personale per il tecnico (il codice si vede una sola volta).
export async function createTechnicianLink(hotelId, issueId, technicianId) {
  const { data, error } = await supabase.rpc('create_technician_link', { p_hotel: hotelId, p_issue: issueId, p_technician: technicianId })
  if (error) throw new Error('Impossibile creare il link')
  return data
}

export const technicianLinkUrl = (token, origin = window.location.origin) => `${origin}/#/t/${token}`

// Cosa ha comunicato il tecnico (arrivo, inizio, note, fine intervento): per la cronologia della segnalazione.
export async function listTechnicianEvents(hotelId, issueId) {
  const { data, error } = await supabase
    .from('technician_events')
    .select('id,kind,note,created_at')
    .eq('hotel_id', hotelId)
    .eq('issue_id', issueId)
    .order('created_at', { ascending: true })
  if (error) throw new Error('Impossibile caricare gli eventi del tecnico')
  return data || []
}

// Pagina pubblica del tecnico: nessun accesso, solo il codice del link.
async function call(body) {
  let res
  try {
    res = await fetch(`${functionsUrl}/randapp-technician-portal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: publicKey, Authorization: `Bearer ${publicKey}` },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error('Connessione assente. Riprova.')
  }
  const payload = await res.json().catch(() => null)
  if (!res.ok || !payload?.ok) {
    const e = new Error(payload?.error || 'Errore. Riprova.')
    e.status = res.status
    throw e
  }
  return payload.job
}
export const getPortalJob = (token) => call({ action: 'get', token })
export const sendPortalEvent = (token, kind, note = '') => call({ action: 'event', token, kind, note })
