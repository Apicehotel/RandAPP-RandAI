// Recupero PIN via email: funzioni pure (controlli e lettura del link).
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
}

export function isValidEmail(value) {
  const e = normalizeEmail(value)
  return e.length <= 120 && EMAIL_RE.test(e)
}

// Il link dell'email è  #/recover?token=...  (route = parte dopo il #)
export function tokenFromRoute(route) {
  const q = String(route || '').split('?')[1] || ''
  const token = new URLSearchParams(q).get('token') || ''
  return token.length >= 40 ? token : ''
}
