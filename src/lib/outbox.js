// Coda delle scritture fatte senza rete («outbox»). Logica pura: il salvataggio (localStorage) si passa da fuori, così si prova in Node.
//
// Regole:
// - Si mette in coda SOLO se la richiesta non ha raggiunto il server (rete assente, timeout). Un rifiuto del server
//   (permessi, dati non validi) è un errore vero e si mostra subito, non si accoda.
// - Ogni voce porta l'utente che l'ha creata: si invia solo con la sessione di quell'utente (la RLS lo richiede comunque).
// - Segnalazioni: l'id si decide sul telefono, quindi un secondo invio (risposta persa) dà «già esistente» = fatto.
// - Camere (stato, nota): vince l'ultima modifica; più tocchi sulla stessa camera diventano una sola voce.
// - Un errore permanente non si ripete all'infinito: la voce resta visibile come «non inviata» finché la persona la scarta.

const KEY = 'randapp.outbox.v1'
export const OUTBOX_MAX = 200
export const OUTBOX_EVENT = 'outbox:changed'
export const OUTBOX_FLUSHED = 'outbox:flushed'

const COALESCE = new Set(['hk.status', 'hk.note', 'alert.status'])
// Elemento a cui si riferisce una modifica (camera o avviso): più modifiche allo stesso elemento diventano una.
const targetOf = (payload) => payload?.roomId ?? payload?.alertId

const defaultStorage = () => { try { return globalThis.localStorage || null } catch { return null } }

export function newId() {
  const c = globalThis.crypto
  if (c?.randomUUID) return c.randomUUID()
  const b = c?.getRandomValues ? c.getRandomValues(new Uint8Array(16)) : Array.from({ length: 16 }, () => Math.floor(Math.random() * 256))
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

// ---- Riconoscere «il server non è stato raggiunto» (e solo quello)
const NETWORK_TEXT = /Failed to fetch|NetworkError|Load failed|Network request failed|fetch failed|connessione assente|network timeout/i
export function isNetworkError(err, online = globalThis.navigator?.onLine) {
  if (!err) return false
  if (err.network === true) return true
  if (err.name === 'AuthRetryableFetchError') return true
  const text = [err.message, err.details].filter(Boolean).join(' ')
  if (NETWORK_TEXT.test(text)) return true
  return online === false && !err.code && !err.status
}

// Errori di accesso (sessione scaduta o da rinnovare): la voce non è sbagliata, va solo ritentata dopo.
export const isAuthError = (err) => {
  const e = err?.cause || err
  return e?.status === 401 || /JWT expired|JWT issued at future|Invalid Refresh Token|PGRST301/i.test(`${e?.message || ''} ${e?.code || ''}`)
}

// Errore per la schermata (messaggio chiaro) che ricorda se la causa era la rete.
export function fail(message, error) {
  return Object.assign(new Error(message), { network: isNetworkError(error), cause: error, code: error?.code })
}

// Una richiesta appesa (segnale debole) non deve bloccare la persona per sempre.
export function withTimeout(promise, ms = 8000) {
  let timer
  const limit = new Promise((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error('network timeout'), { network: true })), ms)
  })
  return Promise.race([Promise.resolve(promise), limit]).finally(() => clearTimeout(timer))
}

// ---- Archivio
function read(storage) {
  try {
    const v = JSON.parse(storage?.getItem(KEY) || '[]')
    return Array.isArray(v) ? v : []
  } catch { return [] }
}
function write(storage, queue) {
  try { storage.setItem(KEY, JSON.stringify(queue)); return true } catch { return false }
}
function changed() {
  try { globalThis.window?.dispatchEvent(new Event(OUTBOX_EVENT)) } catch { /* ignora */ }
}

// Mette in coda. Restituisce la voce, oppure null se non si è potuto salvare (memoria piena o archivio bloccato):
// in quel caso chi chiama deve dirlo alla persona, non far finta di aver salvato.
export function enqueue({ kind, hotelId, userId, payload }, { storage = defaultStorage(), now = Date.now } = {}) {
  if (!storage) return null
  let queue = read(storage)
  if (COALESCE.has(kind)) {
    queue = queue.filter((e) => !(e.status === 'pending' && e.kind === kind && e.hotelId === hotelId && e.userId === userId && targetOf(e.payload) === targetOf(payload)))
  }
  if (queue.length >= OUTBOX_MAX) return null
  const entry = { id: newId(), kind, hotelId, userId, payload, createdAt: new Date(now()).toISOString(), status: 'pending', attempts: 0, error: null }
  queue.push(entry)
  if (!write(storage, queue)) return null
  changed()
  return entry
}

export function listOutbox({ userId, hotelId } = {}, { storage = defaultStorage() } = {}) {
  return read(storage).filter((e) => (!userId || e.userId === userId) && (!hotelId || e.hotelId === hotelId))
}

export function removeEntry(id, { storage = defaultStorage() } = {}) {
  if (!storage) return
  write(storage, read(storage).filter((e) => e.id !== id))
  changed()
}

// Dopo una scrittura riuscita in diretta, le modifiche vecchie in coda per la stessa camera non devono sovrascriverla.
export function dropPending({ kind, hotelId, userId, roomId, alertId }, { storage = defaultStorage() } = {}) {
  if (!storage) return
  const queue = read(storage)
  const next = queue.filter((e) => !(e.status === 'pending' && e.kind === kind && e.hotelId === hotelId && e.userId === userId && targetOf(e.payload) === (roomId ?? alertId)))
  if (next.length !== queue.length) { write(storage, next); changed() }
}

function markFailed(storage, id, message) {
  write(storage, read(storage).map((e) => (e.id === id ? { ...e, status: 'failed', attempts: e.attempts + 1, error: String(message || 'Errore').slice(0, 160) } : e)))
}

// ---- Invio: in ordine, una voce alla volta. Si ferma alla prima rete assente o sessione da rinnovare (l'ordine conta).
let active = null
export function flushQueue(run, opts = {}) {
  if (active) return active
  active = doFlush(run, opts).finally(() => { active = null; changed() })
  return active
}

async function doFlush(run, { userId, storage = defaultStorage() } = {}) {
  const result = { sent: 0, failed: 0, remaining: 0, stopped: null }
  if (!storage || !userId) return result
  const todo = read(storage).filter((e) => e.userId === userId && e.status === 'pending')
  for (const entry of todo) {
    try {
      await run(entry)
      removeEntry(entry.id, { storage })
      result.sent += 1
    } catch (err) {
      if (isNetworkError(err)) { result.stopped = 'network'; break }
      if (isAuthError(err)) { result.stopped = 'auth'; break }
      markFailed(storage, entry.id, err?.cause?.message || err?.message)
      result.failed += 1
    }
  }
  result.remaining = read(storage).filter((e) => e.userId === userId && e.status === 'pending').length
  return result
}

export const _resetForTests = () => { active = null }
