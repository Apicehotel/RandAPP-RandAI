// Collegamento al servizio RandAI. PREDISPOSTO ma non collegato: quando lo accenderemo
// si sostituisce solo il corpo di `askRandAI` (stessa firma), la chat non cambia.
// Deve seguire il percorso di `src/lib/ai.js` (regole → storico → locale → cloud) e registrare con `logAi` (src/data/ai.js).
export async function askRandAI({ hotelId, messages }) {
  void hotelId
  void messages
  throw new Error('RandAI non è ancora collegato.')
}
