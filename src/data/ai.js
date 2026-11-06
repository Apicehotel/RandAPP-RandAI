import { supabase } from '../lib/supabase.js'
import { logError } from '../lib/errorlog.js'

// Casi già risolti simili al testo (ricerca nello storico della struttura, nessun modello).
export async function similarCases(hotelId, query, { limit = 3, exclude = null } = {}) {
  const { data, error } = await supabase.rpc('similar_cases', { p_hotel: hotelId, p_query: query, p_limit: limit, p_exclude: exclude })
  if (error) throw new Error('Impossibile cercare casi simili')
  return data || []
}

// Registro delle scelte (per l'IA locale futura). Non deve MAI bloccare l'app: se fallisce si ignora e si annota il motivo.
export async function logAi(hotelId, { feature, source, model = null, input, output = null, confidence = null, latency = null }) {
  try {
    const { data, error } = await supabase.rpc('ai_log', {
      p_hotel: hotelId, p_feature: feature, p_source: source, p_model: model, p_input: input, p_output: output, p_confidence: confidence, p_latency: latency,
    })
    if (error) throw new Error(error.message)
    return data || null
  } catch (e) {
    logError('ia', `registro IA non riuscito: ${e.message}`)
    return null
  }
}

export async function giveFeedback(interactionId, verdict, correction = null) {
  if (!interactionId) return
  const { error } = await supabase.rpc('ai_feedback_give', { p_interaction: interactionId, p_verdict: verdict, p_correction: correction })
  if (error) throw new Error('Impossibile salvare il giudizio')
}

export async function aiStats(hotelId) {
  const { data, error } = await supabase.rpc('ai_stats', { p_hotel: hotelId })
  if (error) throw new Error('Impossibile leggere le statistiche IA')
  return data || {}
}

export async function aiTrainingExport(hotelId, limit = 2000) {
  const { data, error } = await supabase.rpc('ai_training_export', { p_hotel: hotelId, p_limit: limit })
  if (error) throw new Error('Impossibile esportare gli esempi')
  return data || []
}
