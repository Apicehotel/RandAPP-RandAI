import { supabase } from '../lib/supabase.js'
import { fail, flushQueue, OUTBOX_FLUSHED } from '../lib/outbox.js'

// Come si invia al server ogni tipo di voce della coda. Chi chiama (flushQueue) decide cosa fare degli errori:
// rete assente → si ferma e riprova; rifiuto del server → «non inviata».
const RUNNERS = {
  // L'id lo ha deciso il telefono: se una risposta si è persa e la segnalazione c'è già, «già esistente» vale come inviata.
  'issue.create': async ({ payload }) => {
    const { error } = await supabase.from('issues').insert(payload.row)
    if (error && error.code !== '23505') throw fail('Impossibile inviare la segnalazione', error)
  },
  'hk.status': async ({ hotelId, userId, payload }) => {
    const { error } = await supabase.from('hk_rooms').update({ status: payload.status, updated_by: userId })
      .eq('hotel_id', hotelId).eq('id', payload.roomId).select('id').single()
    if (error) throw fail('Camera non aggiornata', error)
  },
  'hk.note': async ({ hotelId, userId, payload }) => {
    const { error } = await supabase.from('hk_rooms').update({ note: payload.note, updated_by: userId })
      .eq('hotel_id', hotelId).eq('id', payload.roomId).select('id').single()
    if (error) throw fail('Nota non salvata', error)
  },
}

export async function flushOutbox(userId) {
  if (!supabase || globalThis.navigator?.onLine === false) return { sent: 0, failed: 0, remaining: 0, stopped: 'network' }
  const result = await flushQueue(async (entry) => {
    const run = RUNNERS[entry.kind]
    if (!run) throw new Error(`Voce sconosciuta: ${entry.kind}`)
    await run(entry)
  }, { userId })
  // Chi sta guardando una lista la ricarica: ora il server ha anche le modifiche fatte offline.
  if (result.sent > 0) { try { window.dispatchEvent(new Event(OUTBOX_FLUSHED)) } catch { /* ignora */ } }
  return result
}
