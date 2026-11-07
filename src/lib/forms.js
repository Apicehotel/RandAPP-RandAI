// Logica pura (testabile) dei moduli di inserimento: luoghi, assegnatari, sale, bozze.

const norm = (s) => String(s || '').trim().toLowerCase()

// Icona per categoria (stesso elenco di segnalazioni, interventi e lavori).
const CAT_ICON = {
  Idraulica: 'drop', Elettrico: 'bolt', Climatizzazione: 'thermo', Arredi: 'bed', Edilizio: 'building',
  Serramenti: 'door', Filtri: 'refresh', Idromassaggio: 'drop', Extrapiani: 'list', Altro: 'wrench',
}
export const categoryOptions = (categories) => categories.map((c) => ({ id: c, label: c, icon: CAT_ICON[c] || 'wrench' }))

// ---- Luoghi (camere e zone) di una struttura
export const roomsOf = (locations) => (locations || []).filter((l) => l.kind === 'room' && l.active !== false)
export const zonesOf = (locations) => (locations || []).filter((l) => l.kind === 'zone' && l.active !== false)

// Camere raggruppate per piano/gruppo, nell'ordine del catalogo.
export function roomGroups(locations) {
  const groups = []
  for (const r of [...roomsOf(locations)].sort((a, b) => a.sort_order - b.sort_order)) {
    const name = r.group_name || 'Camere'
    let g = groups.find((x) => x.name === name)
    if (!g) groups.push((g = { name, rooms: [] }))
    g.rooms.push(r.name)
  }
  return groups
}

// Suggerimenti mentre si scrive: le camere per inizio numero, le zone per nome o sinonimo.
export function suggestLocations(locations, query, { limit = 8 } = {}) {
  const q = norm(query)
  if (!q) return []
  const all = (locations || []).filter((l) => l.active !== false)
  const hit = (l) =>
    l.kind === 'room'
      ? norm(l.name).startsWith(q)
      : [l.name, ...(l.aliases || [])].some((x) => norm(x).includes(q))
  return all.filter(hit).sort((a, b) => a.sort_order - b.sort_order).slice(0, limit).map((l) => l.name)
}

// Il luogo scritto esiste nel catalogo? Senza catalogo si accetta testo libero.
export function locationOk(locations, text) {
  const t = norm(text)
  if (!t) return false
  const all = (locations || []).filter((l) => l.active !== false)
  if (all.length === 0) return true
  return all.some((l) => norm(l.name) === t)
}

export const toggleIn = (list, value) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value]

// Selezione di un intero piano: aggiunge tutte le camere, o le toglie se c'erano già tutte.
export function togglePlan(selected, planRooms) {
  const all = planRooms.every((r) => selected.includes(r))
  return all ? selected.filter((r) => !planRooms.includes(r)) : [...new Set([...selected, ...planRooms])]
}

// Testo del luogo salvato: più camere diventano "101, 102, 103" (max 40 caratteri nel DB).
export function locationLabel(rooms, extra = '') {
  const parts = [...(rooms || []), extra].map((s) => String(s || '').trim()).filter(Boolean)
  const text = parts.join(', ')
  return text.length <= 40 ? text : `${parts[0]} +${parts.length - 1}`
}

// ---- Date e periodi
export function rangeOk(startLocal, endLocal) {
  if (!startLocal || !endLocal) return true
  return new Date(endLocal).getTime() >= new Date(startLocal).getTime()
}

// Giorno di preparazione di una sala: lo stesso giorno o il giorno prima dell'evento, mai dopo.
export function prepDefaults(dateFrom, addDays) {
  return { same: dateFrom, before: addDays(dateFrom, -1) }
}
export const prepOk = (prep, dateFrom) => Boolean(prep) && prep <= dateFrom

// ---- Persone assegnabili
export const ASSIGNABLE_ROLES = ['manutentore', 'responsabile', 'direzione', 'admin']
export const assignable = (staff) => (staff || []).filter((p) => ASSIGNABLE_ROLES.includes(p.role))
export function staffNames(staff, ids) {
  const byId = new Map((staff || []).map((p) => [p.user_id, p.display_name]))
  return (ids || []).map((id) => byId.get(id)).filter(Boolean)
}

// ---- Sale: richiamo cliente e controllo sala
export const findClient = (clients, name) => (clients || []).find((c) => norm(c.name) === norm(name)) || null

export function applyRecall(form, client) {
  return {
    ...form,
    client: client.name,
    room: client.preferred_room || form.room,
    layout: client.preferred_layout || form.layout,
    pax: client.preferred_pax ? String(client.preferred_pax) : form.pax,
    notes: client.notes || form.notes,
  }
}

export const clampPax = (value, delta = 0) => {
  const n = Math.round(Number(value) || 0) + delta
  return Math.min(5000, Math.max(1, n))
}

// ---- Bozze: si salvano sul dispositivo mentre si scrive (storage iniettabile per i test).
const KEY = (kind, hotelId, userId) => `randapp.draft.${kind}.${hotelId}.${userId}`
export function loadDraft(kind, hotelId, userId, storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(KEY(kind, hotelId, userId))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
export function saveDraft(kind, hotelId, userId, value, storage = globalThis.localStorage) {
  try {
    storage?.setItem(KEY(kind, hotelId, userId), JSON.stringify(value))
  } catch {
    /* storage pieno o bloccato: la bozza è solo un comfort */
  }
}
export function clearDraft(kind, hotelId, userId, storage = globalThis.localStorage) {
  try {
    storage?.removeItem(KEY(kind, hotelId, userId))
  } catch {
    /* niente da fare */
  }
}
