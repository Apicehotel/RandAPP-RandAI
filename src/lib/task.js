// Logica pura (testabile) per la sezione Task: Avvisi Urgenti e Promemoria.

// ---- Avvisi urgenti
export const ALERT_STATUSES = [
  { id: 'aperto', label: 'Aperto' },
  { id: 'in_carico', label: 'In carico' },
  { id: 'risolto', label: 'Risolto' },
]
export const alertStatusLabel = (id) => ALERT_STATUSES.find((s) => s.id === id)?.label || id
export const isAlertOpen = (a) => a.status !== 'risolto'

export function filterAlerts(items, filter) {
  if (filter === 'risolti') return items.filter((a) => a.status === 'risolto')
  if (filter === 'tutti') return [...items]
  return items.filter(isAlertOpen)
}

// Prima quelli ancora da prendere in carico, poi gli altri; a parità, il più vecchio (aspetta da più tempo).
export function sortAlerts(items) {
  const rank = (a) => (a.status === 'aperto' ? 0 : a.status === 'in_carico' ? 1 : 2)
  return [...items].sort(
    (a, b) => rank(a) - rank(b) || new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )
}

export const summarizeAlerts = (items) => ({
  waiting: items.filter((a) => a.status === 'aperto').length,
  taken: items.filter((a) => a.status === 'in_carico').length,
})

// Cosa cambia in base al nuovo stato (chi/quando) — la UI manda solo lo stato.
export function alertPatch(status, userId, now = new Date().toISOString()) {
  if (status === 'in_carico') return { status, taken_by: userId, taken_at: now, resolved_at: null }
  if (status === 'risolto') return { status, resolved_at: now }
  return { status: 'aperto', taken_by: null, taken_at: null, resolved_at: null }
}

// ---- Promemoria
export const REPEATS = [
  { id: 'once', label: 'Una volta' },
  { id: 'daily', label: 'Ogni giorno' },
  { id: 'weekly', label: 'Giorni scelti' },
  { id: 'monthly', label: 'Ogni mese' },
]
export const repeatLabel = (id) => REPEATS.find((r) => r.id === id)?.label || id

export const WEEKDAYS = [
  { id: 'mon', label: 'Lun' },
  { id: 'tue', label: 'Mar' },
  { id: 'wed', label: 'Mer' },
  { id: 'thu', label: 'Gio' },
  { id: 'fri', label: 'Ven' },
  { id: 'sat', label: 'Sab' },
  { id: 'sun', label: 'Dom' },
]

// Un promemoria vale per me se è attivo e o non ha ruoli (tutti) o include il mio ruolo.
export const isForRole = (reminder, role) =>
  reminder.active && (reminder.target_roles.length === 0 || reminder.target_roles.includes(role))

export const isReminderCurrent = (reminder, todayIso) =>
  reminder.active && reminder.start_date <= todayIso && (!reminder.end_date || reminder.end_date >= todayIso)

export const normalizeTimes = (times) =>
  [...new Set(times.filter((t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)))].sort()

export function describeSchedule(r) {
  const base = repeatLabel(r.repeat_kind)
  const days = r.repeat_kind === 'weekly'
    ? ` (${WEEKDAYS.filter((d) => r.weekdays.includes(d.id)).map((d) => d.label).join(' ')})`
    : ''
  const times = r.times.length ? ` · ${r.times.join(', ')}` : ''
  return `${base}${days}${times}`
}

// Validazione del modulo: restituisce il messaggio d'errore o null.
export function validateReminder(f) {
  if (!f.message.trim()) return 'Scrivi il messaggio'
  if (f.repeat_kind === 'weekly' && f.weekdays.length === 0) return 'Scegli almeno un giorno'
  if (normalizeTimes(f.times).length === 0) return 'Metti almeno un orario valido'
  if (!f.start_date) return 'Scegli la data di inizio'
  if (f.end_date && f.end_date < f.start_date) return 'La data di fine è prima di quella di inizio'
  return null
}

// "ora", "12 min fa", "3 h fa", "2 g fa"
export function agoLabel(iso, now = Date.now()) {
  const min = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000))
  if (min < 1) return 'ora'
  if (min < 60) return `${min} min fa`
  const h = Math.round(min / 60)
  if (h < 48) return `${h} h fa`
  return `${Math.round(h / 24)} g fa`
}
