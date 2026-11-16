import { staffNames } from './forms.js'

// Logica pura (testabile) per gli interventi.

export const INTERVENTION_STATUSES = [
  { id: 'da_fare', label: 'Da fare' },
  { id: 'in_corso', label: 'In corso' },
  { id: 'fatto', label: 'Fatto' },
]

export const interventionStatusLabel = (id) =>
  INTERVENTION_STATUSES.find((s) => s.id === id)?.label || id

export const isInterventionOpen = (item) => item.status !== 'fatto'

// Filtri della lista: Aperti (default), Fatti, Tutti.
export function filterInterventions(items, filter) {
  if (filter === 'fatti') return items.filter((i) => i.status === 'fatto')
  if (filter === 'tutti') return [...items]
  return items.filter(isInterventionOpen)
}

const time = (iso) => (iso ? new Date(iso).getTime() : Number.POSITIVE_INFINITY)

// Prima quelli in corso, poi per data programmata (i più vicini); senza data in fondo, dal più vecchio.
export function sortInterventions(items) {
  return [...items].sort((a, b) => {
    const running = Number(b.status === 'in_corso') - Number(a.status === 'in_corso')
    if (running !== 0) return running
    const bySchedule = time(a.scheduled_at) - time(b.scheduled_at)
    if (bySchedule !== 0 && Number.isFinite(bySchedule)) return bySchedule
    if (a.scheduled_at && !b.scheduled_at) return -1
    if (!a.scheduled_at && b.scheduled_at) return 1
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })
}

export const summarizeInterventions = (items) => ({
  open: items.filter(isInterventionOpen).length,
  running: items.filter((i) => i.status === 'in_corso').length,
})

// Aperti · in corso · fatti oggi (data locale), come le statistiche del Planning.
export function interventionStats(items, iso) {
  const day = (v) => { const d = new Date(v); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
  return {
    open: items.filter(isInterventionOpen).length,
    running: items.filter((i) => i.status === 'in_corso').length,
    done: items.filter((i) => i.status === 'fatto' && i.completed_at && day(i.completed_at) === iso).length,
  }
}

// Da <input type="datetime-local"> (ora locale) a ISO, oppure null se vuoto/non valido.
export function localInputToIso(value) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

// Camere dell'intervento con lo stato "fatta" letto da rooms_done ({ "<camera>": { at, by } }).
// L'elenco e l'ordine sono quelli di rooms: una camera presente solo in rooms_done si ignora.
export function roomsProgress(item) {
  const rooms = Array.isArray(item?.rooms) ? item.rooms : []
  const raw = item?.rooms_done
  const doneMap = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const list = rooms.map((room) => {
    const v = Object.prototype.hasOwnProperty.call(doneMap, room) ? doneMap[room] : null
    const done = typeof v === 'object' && v !== null
    return {
      room,
      done,
      at: done && typeof v.at === 'string' ? v.at : null,
      by: done && typeof v.by === 'string' ? v.by : null,
    }
  })
  return { total: list.length, done: list.filter((r) => r.done).length, rooms: list }
}

// Chi ha creato e chi ha chiuso l'intervento. created_by_name arriva dalla vecchia app;
// per quelli creati dall'app il nome si ricava da created_by e dalla lista colleghi.
export function interventionPeople(item, staff) {
  const own = typeof item?.created_by_name === 'string' ? item.created_by_name.trim() : ''
  const createdBy = own || staffNames(staff, item?.created_by ? [item.created_by] : [])[0] || null
  const closer = typeof item?.completed_by_name === 'string' ? item.completed_by_name.trim() : ''
  return { createdBy, completedBy: item?.status === 'fatto' && closer ? closer : null }
}

// ---------------------------------------------------------------- dettaglio intervento
// Camere raggruppate per piano: 201 → "Piano 2", 1204 → "Piano 12", 7 → "Piano 0", testo libero → "Altre".
export const floorOfRoom = (room) => {
  const r = String(room ?? '').trim()
  if (/^\d{1,2}$/.test(r)) return 'Piano 0'
  if (/^\d{3,4}$/.test(r)) return `Piano ${Number(r.slice(0, -2))}`
  return 'Altre'
}

const floorNumber = (name) => (name === 'Altre' ? Number.POSITIVE_INFINITY : Number(name.replace('Piano ', '')))

// progress = risultato di roomsProgress. Ritorna [{ name, rooms:[{room,done,at,by}], done, total }] dal piano più basso.
export function groupRoomsByFloor(progress) {
  const map = new Map()
  for (const r of progress?.rooms || []) {
    const name = floorOfRoom(r.room)
    if (!map.has(name)) map.set(name, [])
    map.get(name).push(r)
  }
  return [...map.entries()]
    .map(([name, rooms]) => ({
      name,
      rooms: [...rooms].sort((a, b) => String(a.room).localeCompare(String(b.room), 'it', { numeric: true })),
      done: rooms.filter((r) => r.done).length,
      total: rooms.length,
    }))
    .sort((a, b) => floorNumber(a.name) - floorNumber(b.name))
}

export const roomsPercent = (progress) =>
  progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0

// Ultima camera segnata (per data), oppure null.
export function lastRoomDone(progress) {
  const done = (progress?.rooms || []).filter((r) => r.done && r.at)
  if (done.length === 0) return null
  return done.reduce((a, b) => (new Date(b.at).getTime() > new Date(a.at).getTime() ? b : a))
}

// Cronologia ricavata dai dati che ci sono: creato → programmato → camere → completato.
export function interventionTimeline(item, progress, people) {
  const out = []
  if (item?.created_at) out.push({ key: 'created', label: 'Creato', by: people?.createdBy || null, at: item.created_at })
  if (item?.scheduled_at) out.push({ key: 'scheduled', label: 'Programmato', by: null, at: item.scheduled_at, until: item.scheduled_until || null })
  const last = lastRoomDone(progress)
  if (progress?.done > 0) {
    out.push({ key: 'rooms', label: `Camere fatte: ${progress.done} su ${progress.total}`, by: last?.by || null, at: last?.at || null, detail: last ? `ultima ${last.room}` : null })
  }
  if (item?.status === 'fatto' && item?.completed_at) out.push({ key: 'done', label: 'Completato', by: people?.completedBy || null, at: item.completed_at })
  return out
}

// Dove si svolge l'intervento, in poche parole. Più camere: "94 camere · piani 2-4" (il campo luogo
// contiene solo "201 +93" perché è lungo al massimo 40 caratteri). Una camera o nessuna: il luogo scritto.
export function interventionWhere(item) {
  const rooms = Array.isArray(item?.rooms) ? item.rooms : []
  if (rooms.length <= 1) return item?.location || (rooms[0] ? String(rooms[0]) : '')
  const nums = [...new Set(rooms.map(floorOfRoom).filter((f) => f !== 'Altre').map((f) => Number(f.replace('Piano ', ''))))].sort((a, b) => a - b)
  let floors = ''
  if (nums.length === 1) floors = `piano ${nums[0]}`
  else if (nums.length > 1) {
    const consecutive = nums.every((n, i) => i === 0 || n === nums[i - 1] + 1)
    floors = `piani ${consecutive ? `${nums[0]}-${nums[nums.length - 1]}` : nums.join(', ')}`
  }
  return [`${rooms.length} camere`, floors].filter(Boolean).join(' · ')
}
