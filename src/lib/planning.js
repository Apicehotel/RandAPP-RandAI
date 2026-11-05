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
// Con l'elenco sale (`rooms`) vale anche la regola delle combinazioni: se due sale condividono
// una parte (es. "Sax 1+2" e "Sax 1") si considerano la stessa sala.
export function bookingConflicts(candidate, existing, rooms = []) {
  const byName = new Map(rooms.map((r) => [norm(r.name), r]))
  const cand = byName.get(norm(candidate.room))
  const sameRoom = (b) => {
    if (norm(b.room) === norm(candidate.room)) return true
    const other = byName.get(norm(b.room))
    return Boolean(cand && other && sharesParts(cand, other))
  }
  return existing.filter(
    (b) =>
      b.status === 'attiva' &&
      b.id !== candidate.id &&
      sameRoom(b) &&
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

// ================================================================ Planning Lavori: stato per giorno
export const WORK_DAY_STATUSES = [
  { id: 'da_fare', label: 'Da fare' },
  { id: 'da_finire', label: 'Da finire' },
  { id: 'fatto', label: 'Fatto' },
]
export const workDayLabel = (id) => (id === 'annullato' ? 'Annullato' : WORK_DAY_STATUSES.find((s) => s.id === id)?.label || id)
// I giorni annullati non si mostrano né si contano.
export const liveDays = (rows) => (rows || []).filter((r) => r.status !== 'annullato')
export const workDaysOn = (rows, iso) => liveDays(rows).filter((r) => r.day === iso)
// Oggi: ancora da fare (compresi i da finire) · da finire · fatti.
export function dayStats(rows, iso) {
  const today = workDaysOn(rows, iso)
  return {
    today: today.filter((r) => r.status !== 'fatto').length,
    finish: today.filter((r) => r.status === 'da_finire').length,
    done: today.filter((r) => r.status === 'fatto').length,
  }
}

// ================================================================ Planning Sale: preparazione, stato e check
// La lista operativa segue il giorno di PREPARAZIONE; il calendario segue le date dell'EVENTO.
export const prepDay = (b) => b.prep_date || b.date_from
export const livePrep = (bookings) => (bookings || []).filter((b) => b.status !== 'annullata')
export const bookingsToPrepare = (bookings, iso) => livePrep(bookings).filter((b) => prepDay(b) === iso)
export const eventOnDay = (b, iso) => b.status !== 'annullata' && b.date_from <= iso && iso <= b.date_to
export function prepStats(bookings, iso) {
  const rows = bookingsToPrepare(bookings, iso)
  return {
    today: rows.filter((b) => b.op_status !== 'fatto').length,
    finish: rows.filter((b) => b.op_status === 'da_finire').length,
    done: rows.filter((b) => b.op_status === 'fatto').length,
  }
}

export const CHECK_STATES = [
  { id: 'ok', label: 'OK' },
  { id: 'problema', label: 'Problema' },
  { id: 'da_verificare', label: 'Da verificare' },
  { id: 'non_richiesto', label: 'N.R.' },
]
export const checkLabel = (id) => CHECK_STATES.find((s) => s.id === id)?.label || id
export const checksReady = (b) =>
  ['non_richiesto', 'ok'].includes(b.audio_status || 'non_richiesto') &&
  ['non_richiesto', 'ok'].includes(b.video_status || 'non_richiesto')

// Turni offerti nel modulo (come nella vecchia app).
export const FORM_SHIFTS = SHIFTS.filter((s) => s.id !== 'sera')

// ---- Sale con famiglie e combinazioni (es. "Sax 1+2" occupa anche Sax 1 e Sax 2)
export const roomParts = (room) => (room.parts && room.parts.length ? room.parts : [room.id])
const sharesParts = (a, b) => roomParts(a).some((p) => roomParts(b).includes(p))
const SLOTS = { mattina: ['m'], pomeriggio: ['p'], sera: ['s'], giornata: ['m', 'p', 's'] }

// Libera · Parziale (solo "giornata", se è occupata una parte) · Occupata.
export function roomAvailability(room, period, bookings, rooms, excludeId = null) {
  const byName = new Map((rooms || []).map((r) => [norm(r.name), r]))
  const taken = new Set()
  for (const b of bookings || []) {
    if (b.status === 'annullata' || b.id === excludeId) continue
    if (!datesOverlap(period.date_from, period.date_to, b.date_from, b.date_to)) continue
    const booked = byName.get(norm(b.room))
    if (booked ? !sharesParts(booked, room) : norm(b.room) !== norm(room.name)) continue
    for (const s of SLOTS[b.shift] || []) taken.add(s)
  }
  const wanted = SLOTS[period.shift] || []
  const busy = wanted.filter((s) => taken.has(s)).length
  if (busy === 0) return 'free'
  return busy === wanted.length ? 'busy' : 'partial'
}

// Raggruppa le sale per famiglia (le singole senza famiglia vanno in "Sale").
export function roomsByFamily(rooms) {
  const groups = []
  for (const r of [...(rooms || [])].sort((a, b) => a.sort_order - b.sort_order)) {
    const name = r.family || 'Sale'
    let g = groups.find((x) => x.name === name)
    if (!g) groups.push((g = { name, rooms: [] }))
    g.rooms.push(r)
  }
  return groups
}

// Unisce le parti di più sale base per creare una combinazione.
export const comboParts = (baseRooms) => [...new Set(baseRooms.flatMap(roomParts))]

// Calendario mensile: settimane (lun-dom) che coprono il mese di `iso`, con i giorni fuori mese per riempire la griglia.
export const monthStartIso = (iso) => `${iso.slice(0, 7)}-01`
export const addMonthsIso = (iso, n) => {
  const d = parseIso(monthStartIso(iso))
  d.setMonth(d.getMonth() + n, 1)
  return toIso(d)
}
export function monthGrid(iso) {
  const first = monthStartIso(iso)
  const next = addMonthsIso(first, 1)
  const last = addDaysIso(next, -1)
  const weeks = []
  for (let w = weekStartIso(first); w <= last; w = addDaysIso(w, 7)) weeks.push(weekDaysIso(w))
  return weeks
}
export const monthLabel = (iso) => {
  const t = parseIso(monthStartIso(iso)).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}
