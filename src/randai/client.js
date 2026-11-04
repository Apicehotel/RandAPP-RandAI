// Collegamento al servizio RandAI. PREDISPOSTO ma non collegato: quando lo accenderemo
// si sostituisce solo il corpo di `askRandAI` (stessa firma), la chat non cambia.
export async function askRandAI({ hotelId, messages }) {
  void hotelId
  void messages
  throw new Error('RandAI non è ancora collegato.')
}
