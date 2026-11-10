// Logica pura dell'avviso urgente globale: quando suona, a chi, e come si vedono le modifiche fatte senza rete.

export const RING_EVERY_MS = 30000 // il suono si ripete finché c'è un avviso da prendere
export const POLL_MS = 20000 // controllo del server a schermata visibile (niente realtime all'avvio)
const PRESENCE_MAX_MS = (7 * 60 + 20) * 60000 // come il server: la presenza scade dopo 7 h 20

// Avvisi ancora da prendere in carico, il più vecchio per primo (aspetta da più tempo).
export const openAlerts = (alerts) =>
  (alerts || []).filter((a) => a.status === 'aperto')
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

// «In struttura» come lo intende il server (presenza accesa e non scaduta).
// Se la presenza non si può leggere (null) si suona lo stesso: meglio un suono in più che un'urgenza persa.
export function isPresent(rows, userId, now = Date.now()) {
  if (rows == null) return true
  const me = rows.find((r) => r.user_id === userId)
  return Boolean(me?.present && now - new Date(me.since).getTime() < PRESENCE_MAX_MS)
}

// Suona solo chi può prendere in carico ed è in struttura.
export const canRing = ({ canUpdate, present }) => Boolean(canUpdate && present)

// Suona se c'è un avviso non silenziato e (è passato l'intervallo oppure ne è arrivato uno nuovo).
export function shouldRing({ open, silenced, ringAllowed, lastRingAt, now, hasNew }) {
  if (!ringAllowed) return false
  if (!open.some((a) => !silenced.has(a.id))) return false
  return hasNew || now - lastRingAt >= RING_EVERY_MS
}

export const hasNewAlert = (known, open) => open.some((a) => !known.has(a.id))

// Cosa vede subito chi ha preso in carico / risolto senza rete (voci «alert.status» ancora in coda).
export function applyPendingAlerts(alerts, entries) {
  const byAlert = new Map()
  for (const e of entries || []) {
    if (e.status === 'pending' && e.kind === 'alert.status') byAlert.set(e.payload.alertId, e.payload.status)
  }
  if (!byAlert.size) return alerts
  return alerts.map((a) => (byAlert.has(a.id) ? { ...a, status: byAlert.get(a.id), pending: true } : a))
}

// Segnalazione creata da un avviso urgente (titolo max 140 come nel modulo; il testo intero va nei dettagli).
export function issueFromAlert(alert) {
  const note = String(alert.note || '').trim()
  return {
    title: note.slice(0, 140),
    description: `Da avviso urgente${note.length > 140 ? `: ${note}` : ''}`.slice(0, 2000),
    category: 'Altro',
    urgency: 'alta',
    room: '',
  }
}

// Suono a due toni alternati, sintetizzato (nessun file audio nel bundle): [{ at, freq, dur }] in secondi.
export function sirenNotes(repeats = 3) {
  const notes = []
  for (let i = 0; i < repeats; i += 1) {
    notes.push({ at: i * 0.5, freq: 880, dur: 0.22 }, { at: i * 0.5 + 0.25, freq: 660, dur: 0.22 })
  }
  return notes
}
