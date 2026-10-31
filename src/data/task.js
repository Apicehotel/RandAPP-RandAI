import { supabase } from '../lib/supabase.js'
import { alertPatch, normalizeTimes } from '../lib/task.js'

const ALERT_COLUMNS = 'id,hotel_id,note,status,created_by,taken_by,taken_at,resolved_at,created_at,updated_at'
const REMINDER_COLUMNS =
  'id,hotel_id,message,target_roles,repeat_kind,weekdays,times,start_date,end_date,active,created_by,created_at,updated_at'

// ---- Avvisi urgenti (sempre filtrati per hotel_id)
export async function listAlerts(hotelId, { limit = 200 } = {}) {
  const { data, error } = await supabase
    .from('urgent_alerts')
    .select(ALERT_COLUMNS)
    .eq('hotel_id', hotelId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error('Impossibile caricare gli avvisi')
  return data || []
}

export async function getAlert(hotelId, id) {
  const { data, error } = await supabase
    .from('urgent_alerts')
    .select(ALERT_COLUMNS)
    .eq('hotel_id', hotelId)
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error("Impossibile caricare l'avviso")
  return data
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

export async function updateAlertStatus(hotelId, userId, id, status) {
  const { data, error } = await supabase
    .from('urgent_alerts')
    .update(alertPatch(status, userId))
    .eq('hotel_id', hotelId)
    .eq('id', id)
    .select(ALERT_COLUMNS)
    .single()
  if (error) throw new Error("Impossibile aggiornare l'avviso")
  return data
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
