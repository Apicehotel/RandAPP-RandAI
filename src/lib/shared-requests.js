// Evita richieste doppie: più schermate che chiedono la stessa lista in pochi secondi (es. colleghi, tecnici,
// prodotti) condividono una sola richiesta. La memoria dura pochi secondi e si svuota a ogni ricarico
// esplicito (useAsync: «reload», ritorno sull'app, modifiche inviate), quindi non mostra dati vecchi dopo una modifica.
const TTL_MS = 8000
const entries = new Map()

export function shared(key, load) {
  const hit = entries.get(key)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.promise
  const promise = Promise.resolve().then(load)
  entries.set(key, { at: Date.now(), promise })
  // Un errore non resta in memoria: la richiesta successiva riprova.
  promise.catch(() => { if (entries.get(key)?.promise === promise) entries.delete(key) })
  return promise
}

export function clearShared() {
  entries.clear()
}
