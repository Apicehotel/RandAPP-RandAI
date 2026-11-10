// Copia locale dei dati letti, per rivederli senza rete, e del «contesto» (utente, ruolo, permessi) per riaprire l'app offline.
//
// Sicurezza: la copia appartiene a UN utente (`claimCache`); se entra un altro utente sullo stesso telefono, o si esce, viene cancellata.
// I permessi salvati servono solo a disegnare le schermate: l'autorità resta il server (RLS), che li ricontrolla a ogni richiesta.
// Le scritture fatte offline restano nella coda (src/lib/outbox.js), che NON si cancella all'uscita.

const PREFIX = 'randapp.cache.'
const OWNER = `${PREFIX}owner`
const CTX = `${PREFIX}ctx`

const defaultStorage = () => { try { return globalThis.localStorage || null } catch { return null } }

export function purgeCache(storage = defaultStorage()) {
  if (!storage) return
  try {
    const keys = []
    for (let i = 0; i < storage.length; i += 1) { const k = storage.key(i); if (k && k.startsWith(PREFIX)) keys.push(k) }
    keys.forEach((k) => storage.removeItem(k))
  } catch { /* archivio bloccato */ }
}

// La copia diventa di questo utente; se era di un altro si svuota prima.
export function claimCache(userId, storage = defaultStorage()) {
  if (!storage || !userId) return
  try {
    if (storage.getItem(OWNER) !== userId) { purgeCache(storage); storage.setItem(OWNER, userId) }
  } catch { /* ignora */ }
}

// Legge dal server e tiene una copia; senza rete (e solo senza rete) ridà l'ultima copia. Gli altri errori passano.
export async function readThrough(key, loader, { limit = 0, storage = defaultStorage(), online = globalThis.navigator?.onLine } = {}) {
  // Telefono offline: niente attese, si mostra subito l'ultima copia (la libreria ritenterebbe le letture per 7 secondi).
  if (online === false) {
    try {
      const hit = JSON.parse(storage?.getItem(`${PREFIX}${key}`) || 'null')
      if (hit && 'data' in hit) return hit.data
    } catch { /* copia illeggibile: si prova col server */ }
  }
  try {
    const data = await loader()
    try {
      const keep = limit && Array.isArray(data) ? data.slice(0, limit) : data
      storage?.setItem(`${PREFIX}${key}`, JSON.stringify({ t: Date.now(), data: keep }))
    } catch { /* memoria piena: si va avanti senza copia */ }
    return data
  } catch (error) {
    if (!error?.network) throw error
    try {
      const hit = JSON.parse(storage?.getItem(`${PREFIX}${key}`) || 'null')
      if (hit && 'data' in hit) return hit.data
    } catch { /* copia illeggibile */ }
    throw error
  }
}

// ---- Contesto per riaprire offline
export function saveContext(ctx, storage = defaultStorage()) {
  try {
    storage?.setItem(CTX, JSON.stringify({ userId: ctx.userId, name: ctx.name, hotelId: ctx.hotelId, role: ctx.role, permissions: [...ctx.permissions] }))
  } catch { /* ignora */ }
}

// Solo se la copia è della stessa struttura E dello stesso utente della sessione salvata dal browser.
export function cachedContext(hotelId, sessionUserId, storage = defaultStorage()) {
  try {
    const c = JSON.parse(storage?.getItem(CTX) || 'null')
    if (!c || !sessionUserId || c.userId !== sessionUserId || c.hotelId !== hotelId) return null
    return { ...c, permissions: new Set(c.permissions || []), offline: true }
  } catch { return null }
}

// Utente della sessione che supabase-js tiene nel browser (anche con il token scaduto: serve a riaprire offline).
export function storedSessionUserId(storage = defaultStorage()) {
  try {
    for (let i = 0; i < (storage?.length || 0); i += 1) {
      const k = storage.key(i)
      if (k && /^sb-.+-auth-token$/.test(k)) {
        const s = JSON.parse(storage.getItem(k) || 'null')
        if (s?.refresh_token && s?.user?.id) return s.user.id
      }
    }
  } catch { /* ignora */ }
  return null
}
