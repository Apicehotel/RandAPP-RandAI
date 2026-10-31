// Logica pura dell'Housekeeping (camere per piano).

export const ROOM_STATUSES = [
  { id: 'dafare', label: 'Da fare' },
  { id: 'in_corso', label: 'In corso' },
  { id: 'fatto', label: 'Fatta' },
]
export const roomStatusLabel = (id) => ROOM_STATUSES.find((s) => s.id === id)?.label || id

// Un tocco: da fare -> in corso -> fatta -> da fare.
export const nextStatus = (id) => {
  const i = ROOM_STATUSES.findIndex((s) => s.id === id)
  return ROOM_STATUSES[(i + 1) % ROOM_STATUSES.length].id
}

export const summarizeRooms = (rooms) => {
  const active = rooms.filter((r) => r.active !== false)
  const count = (s) => active.filter((r) => r.status === s).length
  return { total: active.length, todo: count('dafare'), running: count('in_corso'), done: count('fatto') }
}

export const floorLabel = (floor) => (floor === 0 ? 'Piano terra' : floor < 0 ? `Interrato ${Math.abs(floor)}` : `Piano ${floor}`)

// Numeri di camera ordinati come numeri quando possibile ("9" prima di "10").
const byRoom = (a, b) => a.room.localeCompare(b.room, 'it', { numeric: true })

export function groupByFloor(rooms, { onlyOpen = false } = {}) {
  const map = new Map()
  for (const r of rooms) {
    if (r.active === false) continue
    if (onlyOpen && r.status === 'fatto') continue
    if (!map.has(r.floor)) map.set(r.floor, [])
    map.get(r.floor).push(r)
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([floor, list]) => ({ floor, label: floorLabel(floor), rooms: list.sort(byRoom), summary: summarizeRooms(list) }))
}

// "204, 205, 301" -> ['204','205','301'] senza doppioni né vuoti.
export const parseRoomList = (text) =>
  [...new Set(String(text || '').split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean))]
