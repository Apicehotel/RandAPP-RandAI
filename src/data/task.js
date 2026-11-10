import { supabase } from '../lib/supabase.js'
import { alertPatch, normalizeTimes } from '../lib/task.js'
import { dropPending, enqueue, fail, isNetworkError, withTimeout } from '../lib/outbox.js'
import { readThrough } from '../lib/offline-cache.js'

const ALERT_COLUMNS = 'id,hotel_id,note,status,created_by,taken_by,taken_at,resolved_at,created_at,updated_at'
const REMINDER_COLUMNS =
  'id,hotel_id,message,target_roles,repeat_kind,weekdays,times,start_date,end_date,active,created_by,created_at,updated_at'

// ---- Avvisi urgenti (sempre filtrati per hotel_id)
export async function listAlerts(hotelId, { limit = 200 } = {}) {
  return readThrough(`alerts:${hotelId}`, async () => {
    const { data, error } = await supabase
      .from('urgent_alerts')
      .select(ALERT_COLUMNS)
      .eq('hotel_id', hotelId)
      .order('created_at', { ascending: false })
      .limit(limit)
      .retry(false)
    if (error) throw fail('Impossibile caricare gli avvisi', error)
    return data || []
  }, { limit: 100 })
}

export async function getAlert(hotelId, id) {
  return readThrough(`alert:${hotelId}:${id}`, async () => {
    const { data, error } = await supabase
      .from('urgent_alerts')
      .select(ALERT_COLUMNS)
      .eq('hotel_id', hotelId)
      .eq('id', id)
      .maybeSingle()
      .retry(false)
    if (error) throw fail("Impossibile caricare l'avviso", error)
    return data
  })
}

export async function createAlert(hotelId, userId, note) {
  const { data, error } = await supabase
    .from('urgent_alerts')
    .insert({ hotel_id: hotelId, created_by: userId, note: note.trim() })
    .select(ALERT_COLUMNS)
    .single()
  if (error) throw new Error("Impossibile creare l'avviso")
  return data
}

// Prendere in carico / risolvere funziona anche senza rete: la modifica resta in coda (con l'ora in cui è stata fatta) e parte da sola.
export async function updateAlertStatus(hotelId, userId, id, status) {
  const patch = alertPatch(status, userId)
  const { data, error } = await withTimeout(
    supabase.from('urgent_alerts').update(patch).eq('hotel_id', hotelId).eq('id', id).select(ALERT_COLUMNS).single(),
  ).catch((e) => ({ data: null, error: e }))
  if (!error) {
    dropPending({ kind: 'alert.status', hotelId, userId, alertId: id }) // una modifica più vecchia in coda non deve sovrascrivere questa
    return data
  }
  if (!isNetworkError(error)) throw new Error("Impossibile aggiornare l'avviso")
  if (!enqueue({ kind: 'alert.status', hotelId, userId, payload: { alertId: id, status } })) {
    throw new Error('Senza connessione e con la memoria del telefono piena: modifica NON salvata')
  }
  return { id, ...patch, pending: true }
}

// ---- Promemoria
export async function listReminders(hotelId, { limit = 200 } = {}) {
  const { data, error } = await supabase
    .from('reminders')
    .select(REMINDER_COLUMNS)
    .eq('hotel_id', hotelId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error('Impossibile caricare i promemoria')
  return data || []
}

export async function getReminder(hotelId, id) {
  const { data, error } = await supabase
    .from('reminders')
    .select(REMINDER_COLUMNS)
    .eq('hotel_id', hotelId)
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error('Impossibile caricare il promemoria')
  return data
}

export async function createReminder(hotelId, userId, input) {
  const row = {
    hotel_id: hotelId,
    created_by: userId,
    message: input.message.trim(),
    target_roles: input.target_roles,
    repeat_kind: input.repeat_kind,
    weekdays: input.repeat_kind === 'weekly' ? input.weekdays : [],
    times: normalizeTimes(input.times),
    start_date: input.start_date,
    end_date: input.end_date || null,
  }
  const { data, error } = await supabase.from('reminders').insert(row).select(REMINDER_COLUMNS).single()
  if (error) throw new Error('Impossibile creare il promemoria')
  return data
}

export async function setReminderActive(hotelId, id, active) {
  const { data, error } = await supabase
    .from('reminders')
    .update({ active })
    .eq('hotel_id', hotelId)
    .eq('id', id)
    .select(REMINDER_COLUMNS)
    .single()
  if (error) throw new Error('Impossibile aggiornare il promemoria')
  return data
}
