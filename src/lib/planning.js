// Logica pura (testabile) per il Planning. Le date sono stringhe "AAAA-MM-GG" (ora locale):
// si confrontano come testo, senza passare da UTC.

const pad = (n) => String(n).padStart(2, '0')
export const toIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const parseIso = (s) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const todayIso = () => toIso(new Date())
export const addDaysIso = (iso, n) => {
  const d = parseIso(iso)
  return toIso(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n))
}
// Lunedì della settimana che contiene la data.
export const weekStartIso = (iso) => addDaysIso(iso, -((parseIso(iso).getDay() + 6) % 7))
export const weekDaysIso = (startIso) => Array.from({ length: 7 }, (_, i) => addDaysIso(startIso, i))

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']
export const dayLabel = (iso) => {
  const d = parseIso(iso)
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`
}
export const shortDate = (iso) => {
  const d = parseIso(iso)
  return `${d.getDate()}/${d.getMonth() + 1}`
}

// ---- Planning Lavori
export const WORK_STATUSES = [
  { id: 'da_fare', label: 'Da fare' },
  { id: 'fatto', label: 'Fatto' },
]
export const workStatusLabel = (id) => WORK_STATUSES.find((s) => s.id === id)?.label || id
export const worksOnDay = (works, iso) => works.filter((w) => w.days.includes(iso))
export const worksInWeek = (works, startIso) => {
  const days = weekDaysIso(startIso)
  return works.filter((w) => w.days.some((d) => days.includes(d)))
}

// ---- Planning Sale
export const SHIFTS = [
  { id: 'mattina', label: 'Mattina' },
  { id: 'pomeriggio', label: 'Pomeriggio' },
  { id: 'sera', label: 'Sera' },
  { id: 'giornata', label: 'Tutto il giorno' },
]
export const shiftLabel = (id) => SHIFTS.find((s) => s.id === id)?.label || id
const shiftOrder = (id) => SHIFTS.findIndex((s) => s.id === id)

export const BOOKING_STATUSES = [
  { id: 'attiva', label: 'Attiva' },
  { id: 'annullata', label: 'Annullata' },
]
export const bookingStatusLabel = (id) => BOOKING_STATUSES.find((s) => s.id === id)?.label || id

// "Tutto il giorno" occupa tutti i turni.
export const shiftsOverlap = (a, b) => a === b || a === 'giornata' || b === 'giornata'
export const datesOverlap = (aFrom, aTo, bFrom, bTo) => aFrom <= bTo && bFrom <= aTo

const norm = (s) => String(s || '').trim().toLowerCase()

// Prenotazioni attive che occupano già la stessa sala nello stesso periodo e turno.
export function bookingConflicts(candidate, existing) {
  return existing.filter(
    (b) =>
      b.status === 'attiva' &&
      b.id !== candidate.id &&
      norm(b.room) === norm(candidate.room) &&
      datesOverlap(candidate.date_from, candidate.date_to, b.date_from, b.date_to) &&
      shiftsOverlap(candidate.shift, b.shift),
  )
}

export function bookingsOnDay(bookings, iso) {
  return bookings
    .filter((b) => b.status === 'attiva' && b.date_from <= iso && iso <= b.date_to)
    .sort((a, b) => shiftOrder(a.shift) - shiftOrder(b.shift) || norm(a.room).localeCompare(norm(b.room)))
}

export const roomNames = (bookings) =>
  [...new Set(bookings.map((b) => b.room.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b))
