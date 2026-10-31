// Interruttori delle funzioni opzionali. Tutto ciò che è "false" non viene né mostrato né scaricato.
export function createFeatures(env = {}) {
  return {
    // RandAI è predisposto ma in pausa: si accende solo con VITE_FEATURE_RANDAI=true
    randai: String(env.VITE_FEATURE_RANDAI || '').toLowerCase() === 'true',
  }
}

export const FEATURES = createFeatures(import.meta.env)
