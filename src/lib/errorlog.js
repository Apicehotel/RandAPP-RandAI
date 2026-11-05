// Registro errori dell'app. Tiene gli ultimi errori su questo dispositivo (anche senza rete e prima del login)
// e li manda al server, dove gli admin li leggono. Mai dentro: PIN, token, chiavi (vedi clean()).
// Nessun import dall'app: il collegamento al server si registra da fuori con setSink().

const KEY = 'randapp-errors-v1'
const MAX = 50
const DEDUPE_MS = 30000
export const APP_VERSION = 'web'

let sink = null
let recent = new Map()

export const setSink = (fn) => { sink = fn }

// Di chi è la colpa, e cosa fare. Tre risposte: app (bug, configurazione o servizio), utente (PIN, permessi, dati), dispositivo (rete, browser, memoria).
// `probable`: quando dal solo errore non si può essere sicuri (es. rete che cade con il Wi‑Fi acceso).
export const CAUSES = {
  app: { label: 'App', tone: 'error' },
  utente: { label: 'Utente', tone: 'warn' },
  dispositivo: { label: 'Dispositivo', tone: 'muted' },
}

export function classify({ kind = '', message = '', detail = '', status = 0, online } = {}) {
  const text = `${message} ${detail}`
  const has = (re) => re.test(text)
  const isOnline = online ?? (typeof navigator === 'undefined' ? true : navigator.onLine !== false)
  const out = (cause, hint, probable = false) => ({ cause, hint, probable })

  // Dispositivo: connessione, versione in cache, memoria, estensioni del browser.
  if (!isOnline) return out('dispositivo', 'Nessuna connessione: controlla Wi‑Fi o dati mobili e riprova.')
  if (has(/dynamically imported module|Loading chunk|ChunkLoadError|Importing a module script failed/i)) {
    return out('dispositivo', 'Il telefono ha in memoria una versione vecchia o la rete è caduta: ricarica la pagina.', true)
  }
  if (has(/QuotaExceeded|storage.*(full|quota)|SecurityError.*(storage|localStorage)/i)) {
    return out('dispositivo', 'Memoria del dispositivo piena o bloccata (navigazione privata?): libera spazio o esci dalla navigazione privata.')
  }
  if (has(/chrome-extension:|moz-extension:|safari-extension:/i) || /^Script error\.?$/i.test(String(message).trim())) {
    return out('dispositivo', 'Un\'estensione o il browser disturba l\'app: prova con un altro browser o senza estensioni.', true)
  }

  // Utente: PIN, permessi, sessione, troppi tentativi, dati già esistenti.
  if (kind === 'accesso' && /PIN non validi|PIN errato/i.test(text)) return out('utente', 'PIN o nome non corretti: riprova. Dopo 5 errori l\'utente si blocca per 10 minuti.')
  if (status === 429 || has(/Troppi tentativi|Troppe richieste/i)) return out('utente', 'Troppi tentativi ravvicinati: aspetta qualche minuto e riprova.')
  if (has(/Utente disattivato|Accesso alla struttura non consentito|non autorizzato/i) || has(/"code":"42501"|row-level security|permission denied/i) || status === 403) {
    return out('utente', 'Non hai il permesso per questa azione: chiedi a un amministratore di abilitare il tuo ruolo.')
  }
  if (status === 401 || has(/JWT expired|PGRST301|Invalid Refresh Token|sessione scaduta/i)) {
    return out('utente', 'Sessione scaduta: esci e rientra con il PIN.')
  }
  if (has(/"code":"23505"|duplicate key|già usato/i)) return out('utente', 'Esiste già un elemento uguale: controlla i dati inseriti.')
  if (has(/"code":"23514"|"code":"22023"|"code":"23502"|violates check|not-null/i)) {
    return out('utente', 'Un dato inserito non è valido (troppo lungo, vuoto o fuori valore): controlla il modulo.', true)
  }

  // Rete che fallisce mentre il dispositivo risulta online: può essere il telefono o il servizio.
  if (kind === 'rete' && !status && has(/Failed to fetch|NetworkError|Load failed|connessione|timed? ?out/i)) {
    return out('dispositivo', 'Il server non è stato raggiunto: probabile segnale debole o rete bloccata. Se succede a tutti, è il servizio.', true)
  }
  if (kind === 'accesso' && has(/connessione assente o bloccata/i)) {
    return out('dispositivo', 'Il server di accesso non è stato raggiunto: probabile segnale debole o rete bloccata. Se succede a tutti, è l\'indirizzo del servizio.', true)
  }

  // App: configurazione, servizio che risponde male, errori di codice o di schema.
  if (kind === 'config') return out('app', 'Mancano le impostazioni del sito (variabili VITE_*): va rifatto il build con quelle impostate.')
  if (status >= 500) return out('app', 'Il servizio ha risposto con un errore: non dipende da te. Copia il registro e mandalo a chi gestisce l\'app.')
  if (has(/"code":"(42P01|42703|42883|PGRST2\d\d|PGRST1\d\d)"|does not exist|schema cache/i)) {
    return out('app', 'L\'app e il database non sono allineati (tabella o colonna mancante): serve un aggiornamento. Copia il registro e mandalo a chi gestisce l\'app.')
  }
  if (status === 404) return out('app', 'Indirizzo non trovato: l\'app punta a un servizio sbagliato o non pubblicato. Copia il registro e mandalo a chi gestisce l\'app.')
  if (kind === 'accesso') return out('app', 'La funzione di accesso ha risposto in modo inatteso: non dipende da te. Copia il registro e mandalo a chi gestisce l\'app.', true)
  return out('app', 'Errore dell\'app: copia il registro e mandalo a chi gestisce l\'app.', true)
}

// Toglie dai testi tutto ciò che somiglia a un segreto, e accorcia.
export function clean(value, max = 500) {
  let s = typeof value === 'string' ? value : value?.message ?? String(value ?? '')
  s = s
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer ***')
    .replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*/g, '***jwt***')
    .replace(/("?(?:pin|password|token|access_token|refresh_token|apikey|authorization)"?\s*[:=]\s*)"?[^"&,\s}]+"?/gi, '$1***')
    .replace(/([?&](?:apikey|access_token|token|pin)=)[^&\s]+/gi, '$1***')
  return s.length > max ? `${s.slice(0, max)}…` : s
}

const read = () => {
  try {
    const rows = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(rows) ? rows : []
  } catch {
    return []
  }
}
const write = (rows) => {
  try { localStorage.setItem(KEY, JSON.stringify(rows.slice(-MAX))) } catch { /* memoria piena o bloccata: si va avanti */ }
}

export const readLog = () => read().slice().reverse() // dal più recente
export const clearLog = () => { try { localStorage.removeItem(KEY) } catch { /* ignora */ } }

const where = () => {
  try { return (window.location.hash || '#/').slice(1, 121) } catch { return '' }
}
const device = () => {
  try { return clean(navigator.userAgent, 200) } catch { return '' }
}

export function logError(kind, error, detail = '', extra = {}) {
  try {
    const message = clean(error, 500)
    if (!message) return
    const now = Date.now()
    const key = `${kind}|${message}`
    if (now - (recent.get(key) || 0) < DEDUPE_MS) return
    recent.set(key, now)
    if (recent.size > 200) recent = new Map([...recent].slice(-100))

    const cleanDetail = clean(detail, 2000)
    const verdict = classify({ kind, message, detail: cleanDetail, status: extra.status || 0 })
    const row = {
      at: new Date(now).toISOString(), kind: clean(kind, 30), message, detail: cleanDetail, route: where(),
      cause: extra.cause || verdict.cause, hint: extra.hint || verdict.hint, probable: Boolean(verdict.probable),
    }
    write([...read(), row])
    if (sink) {
      Promise.resolve(sink({ ...row, version: APP_VERSION, device: device() })).catch(() => {})
    }
  } catch {
    /* il registro non deve mai far cadere l'app */
  }
}

export function formatLog(rows = readLog()) {
  return rows
    .map((r) => `${r.at} [${r.kind}] ${r.cause ? `CAUSA: ${CAUSES[r.cause]?.label || r.cause}${r.probable ? ' (probabile)' : ''} — ` : ''}${r.message}${r.route ? ` (${r.route})` : ''}${r.detail ? `\n    ${r.detail}` : ''}${r.hint ? `\n    Cosa fare: ${r.hint}` : ''}`)
    .join('\n')
}

// Errori che nessuno ha intercettato: script che si rompe, promesse rifiutate.
export function installGlobalHandlers() {
  if (typeof window === 'undefined' || window.__randappErrLog) return
  window.__randappErrLog = true
  window.addEventListener('error', (e) => {
    logError('script', e.message || 'Errore', `${e.filename || ''}:${e.lineno || 0}`)
  })
  window.addEventListener('unhandledrejection', (e) => {
    logError('promessa', e.reason || 'Promessa rifiutata')
  })
}

export const resetForTests = () => { recent = new Map(); sink = null }
