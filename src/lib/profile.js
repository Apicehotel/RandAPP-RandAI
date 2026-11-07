// Dati personali del Profilo: controlli prima di salvare (gli stessi del server).
export const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,29}$/

export const normalizeUsername = (v) => String(v || '').trim().toLowerCase()
export const normalizeName = (v) => String(v || '').trim().replace(/\s+/g, ' ')

// Vuoto è valido (toglie lo username).
export const isValidUsername = (v) => {
  const u = normalizeUsername(v)
  return u === '' || USERNAME_RE.test(u)
}

// Primo errore da mostrare, o '' se si può salvare.
export function profileError({ username, firstName, lastName, email }, isValidEmail) {
  if (!isValidUsername(username)) return 'Username non valido: 3-30 caratteri tra lettere, numeri, punto, trattino'
  if (normalizeName(firstName).length > 60 || normalizeName(lastName).length > 60) return 'Nome o cognome troppo lungo'
  if (String(email || '').trim() && !isValidEmail(email)) return 'Email non valida'
  return ''
}
