// Logica pura di Sensori e relay.

export const SENSOR_KINDS = [
  { id: 'temperatura', label: 'Temperatura' },
  { id: 'relay', label: 'Relay / interruttore' },
]
export const sensorKindLabel = (id) => SENSOR_KINDS.find((k) => k.id === id)?.label || id

export const SWITCH_LABELS = { on: 'Acceso', off: 'Spento', mixed: 'Misto' }
export const switchLabel = (s) => SWITCH_LABELS[s] || 'Sconosciuto'

// Dato "vecchio": nessun aggiornamento da più di 30 minuti (o mai).
export const STALE_MINUTES = 30
export const isStale = (sensor, now = Date.now()) =>
  !sensor.last_seen || now - new Date(sensor.last_seen).getTime() > STALE_MINUTES * 60 * 1000

export const SENSOR_ROLES = [
  { id: 'ambiente', label: 'Ambiente', hint: 'Solo le soglie scritte a mano' },
  { id: 'motore', label: 'Motore / impianto', hint: 'Inverno: allerta se scende sotto la soglia. Estate: se sale sopra.' },
  { id: 'frigo', label: 'Frigo / cella', hint: 'Allerta se sale sopra la soglia frigo' },
]
export const SEASONS = [
  { id: 'inverno', label: 'Inverno' },
  { id: 'estate', label: 'Estate' },
]
export const DEFAULT_SETTINGS = { season: 'inverno', winter_min: 20, summer_max: 18, fridge_max: 0 }
export const seasonLabel = (id) => SEASONS.find((s) => s.id === id)?.label || id

const has = (v) => v !== null && v !== undefined && v !== ''

// Soglie che valgono ORA per un sensore: { min, max } (null = nessun limite).
export function thresholdsFor(sensor, settings = DEFAULT_SETTINGS) {
  const cfg = { ...DEFAULT_SETTINGS, ...(settings || {}) }
  if (sensor.role === 'motore') {
    return cfg.season === 'estate' ? { min: null, max: Number(cfg.summer_max) } : { min: Number(cfg.winter_min), max: null }
  }
  if (sensor.role === 'frigo') return { min: null, max: Number(cfg.fridge_max) }
  return { min: has(sensor.alert_min) ? Number(sensor.alert_min) : null, max: has(sensor.alert_max) ? Number(sensor.alert_max) : null }
}

// Stato per colore/etichetta: 'allerta' | 'offline' | 'ok'
export function sensorState(sensor, now = Date.now(), settings = DEFAULT_SETTINGS) {
  if (!sensor.online || isStale(sensor, now)) return 'offline'
  if (sensor.kind === 'temperatura' && has(sensor.temperature)) {
    const t = Number(sensor.temperature)
    const { min, max } = thresholdsFor(sensor, settings)
    if (max !== null && t > max) return 'allerta'
    if (min !== null && t < min) return 'allerta'
  }
  return 'ok'
}
export const STATE_LABELS = { ok: 'Regolare', allerta: 'In allerta', offline: 'Non aggiornato' }

export const formatTemp = (t) => (t === null || t === undefined ? '—' : `${String(Number(t).toFixed(1)).replace('.', ',')}°C`)
export const formatHumidity = (h) => (h === null || h === undefined ? '—' : `${Math.round(Number(h))}%`)

export const summarizeSensors = (sensors, now = Date.now(), settings = DEFAULT_SETTINGS) => {
  const active = sensors.filter((s) => s.active !== false)
  const count = (st) => active.filter((s) => sensorState(s, now, settings) === st).length
  return { total: active.length, alert: count('allerta'), offline: count('offline'), ok: count('ok') }
}

// Prima quelli in allerta, poi non aggiornati, poi in ordine.
const RANK = { allerta: 0, offline: 1, ok: 2 }
export const sortSensors = (sensors, now = Date.now(), settings = DEFAULT_SETTINGS) =>
  sensors
    .filter((s) => s.active !== false)
    .sort((a, b) =>
      RANK[sensorState(a, now, settings)] - RANK[sensorState(b, now, settings)] ||
      a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'it'))

// Le due sezioni: temperature e interruttori.
export const temperatureSensors = (sensors) => sensors.filter((s) => s.kind === 'temperatura')
export const switchSensors = (sensors) => sensors.filter((s) => s.kind === 'relay')

// Interruttori raggruppati: Accesi, Spenti, Misti, Non raggiungibili (offline o dato vecchio).
export const SWITCH_GROUPS = [
  { id: 'on', label: 'Accesi' },
  { id: 'off', label: 'Spenti' },
  { id: 'mixed', label: 'Misti' },
  { id: 'unreachable', label: 'Non raggiungibili' },
]
export function switchGroupOf(sensor, now = Date.now()) {
  if (!sensor.online || isStale(sensor, now)) return 'unreachable'
  return ['on', 'off', 'mixed'].includes(sensor.switch_state) ? sensor.switch_state : 'unreachable'
}
export function groupSwitches(sensors, now = Date.now()) {
  const active = switchSensors(sensors).filter((s) => s.active !== false)
  return SWITCH_GROUPS.map((g) => ({
    ...g,
    items: active.filter((s) => switchGroupOf(s, now) === g.id).sort((a, b) => a.name.localeCompare(b.name, 'it', { numeric: true })),
  })).filter((g) => g.items.length)
}

// Numero opzionale da un campo di testo ("" -> null, "4,5" -> 4.5, non valido -> undefined).
export function optionalNumber(value) {
  const text = String(value ?? '').trim()
  if (text === '') return null
  const n = Number(text.replace(',', '.'))
  return Number.isFinite(n) ? n : undefined
}

// Sensori nascosti (si possono rimostrare).
export const hiddenSensors = (sensors) =>
  sensors.filter((s) => s.active === false).sort((a, b) => a.name.localeCompare(b.name, 'it'))
