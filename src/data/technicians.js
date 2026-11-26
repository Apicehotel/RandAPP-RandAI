import { supabase } from '../lib/supabase.js'
import { shared } from '../lib/shared-requests.js'

// Elenco dei tecnici esterni della struttura (con numero) e le loro competenze. Lo vede chi ha technicians.view (RLS).
export async function listTechnicians(hotelId) {
  return shared(`technicians:${hotelId}`, () => loadTechnicians(hotelId))
}

async function loadTechnicians(hotelId) {
  const [t, c] = await Promise.all([
    supabase.from('external_technicians').select('id,name,phone,company,email,notes,active').eq('hotel_id', hotelId).order('name'),
    supabase.from('external_technician_competencies').select('technician_id,competency_id'),
  ])
  if (t.error || c.error) throw new Error('Impossibile caricare i tecnici')
  const byTech = new Map()
  for (const r of c.data || []) byTech.set(r.technician_id, [...(byTech.get(r.technician_id) || []), r.competency_id])
  return (t.data || []).map((x) => ({ ...x, competencyIds: byTech.get(x.id) || [] }))
}

export async function listCompetencies() {
  const { data, error } = await supabase.from('technician_competencies').select('id,code,label').order('label')
  if (error) throw new Error('Impossibile caricare le competenze')
  return data || []
}

const KNOWN = /Numero non valido|Scrivi il nome|Non autorizzato|Tecnico non trovato/

// Nuovo tecnico (id vuoto) o modifica. I tecnici non si cancellano: si disattivano.
export async function saveTechnician(hotelId, t) {
  const { data, error } = await supabase.rpc('manage_technician', {
    p_hotel: hotelId, p_id: t.id || null, p_name: t.name, p_phone: t.phone,
    p_company: t.company || null, p_email: t.email || null, p_notes: t.notes || null, p_active: t.active !== false,
  })
  if (error) throw new Error(KNOWN.test(error.message || '') ? error.message : 'Impossibile salvare il tecnico')
  const { error: e2 } = await supabase.rpc('set_technician_competencies', { p_hotel: hotelId, p_technician: data, p_competencies: t.competencyIds || [] })
  if (e2) throw new Error('Tecnico salvato, ma non le competenze')
  return data
}
