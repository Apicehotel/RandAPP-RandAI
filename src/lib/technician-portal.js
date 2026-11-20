// Il codice del link del tecnico: 64 caratteri esadecimali dopo «#/t/».
export const tokenFromPortalRoute = (route) => (String(route || '').match(/^\/t\/([0-9a-f]{64})/) || [])[1] || ''

// Valore per <input type="datetime-local"> (ora locale), vuoto se manca la data.
export function toLocalInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
