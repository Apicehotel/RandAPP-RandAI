// RandAI, parte pura (testabile). Oggi: regole + ricerca nello storico + scelte delle persone.
// Domani: modello locale. Il percorso è unico per tutte le richieste e va dal più economico al più costoso:
//   1. regole      (sempre disponibili, gratis)
//   2. storico     (casi simili già risolti, gratis)
//   3. locale      (modello aperto sul nostro server: SPENTO finché non c'è)
//   4. cloud       (modello esterno: solo se i precedenti non bastano e c'è budget)
// Ogni risposta registra da quale gradino è arrivata: la quota "locale" deve salire nel tempo.
export const PROVIDER_ORDER = ['rules', 'history', 'local', 'cloud']
export const MIN_QUERY_CHARS = 6

// Toglie numeri di telefono (8+ cifre) ed email prima di mandare qualsiasi testo al registro (il server lo rifà comunque).
export function scrubText(text) {
  return String(text || '')
    .replace(/\+?\d[\d ]{6,}\d/g, '[numero]')
    .replace(/[\w.%+-]+@[\w.-]+\.[a-z]{2,}/gi, '[email]')
}

// Testo di ricerca da una segnalazione in scrittura (titolo + dettagli + categoria).
export const queryFrom = ({ title = '', description = '', category = '' } = {}) =>
  [title, description, category].map((s) => String(s).trim()).filter(Boolean).join(' ').slice(0, 400)

export const shouldSearch = (query) => String(query || '').trim().length >= MIN_QUERY_CHARS

// Sceglie il gradino per una richiesta. `confidence` è quella già ottenuta dai gradini precedenti (0..1).
// Il modello locale e il cloud vanno usati solo se abilitati e solo se serve davvero.
export function chooseProvider({ confidence = 0, localReady = false, cloudAllowed = false, threshold = 0.7 } = {}) {
  if (confidence >= threshold) return 'history'
  if (localReady) return 'local'
  if (cloudAllowed) return 'cloud'
  return 'history'
}

// Quota di richieste risolte in locale su quelle che hanno richiesto un modello (locale + cloud).
export function localShare(bySource = {}) {
  const local = Number(bySource.local || 0)
  const cloud = Number(bySource.cloud || 0)
  return local + cloud === 0 ? null : local / (local + cloud)
}

// Una riga JSON per esempio: formato adatto ad allenare un modello (input → risposta attesa).
export function toJsonl(rows) {
  return (rows || []).map((r) => JSON.stringify({ kind: r.kind, feature: r.feature, input: r.input, output: r.output, verdict: r.verdict, correction: r.correction, at: r.at })).join('\n')
}
