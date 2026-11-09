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


// Sul pannello principale mostriamo prima le letture utilizzabili.
// I dispositivi mai aggiornati o scaduti restano consultabili in una sezione separata,
// senza cancellarli, disattivarli o alterare il monitoraggio.
export function splitTemperatureSensors(sensors, now = Date.now(), settings = DEFAULT_SETTINGS) {
  const active = sortSensors(temperatureSensors(sensors), now, settings)
  return {
    current: active.filter((s) => sensorState(s, now, settings) !== 'offline'),
    outdated: active.filter((s) => sensorState(s, now, settings) === 'offline'),
  }
}

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

// ---- Guardie: cosa non arriva più dall'impianto
export const MISSING_HOURS = 24
export const SYNC_STOP_MINUTES = 60

// Sensori attivi che non si aggiornano da più di 24 ore: con ogni probabilità eWeLink non li restituisce più
// (tolti dall'account, condivisione revocata, dispositivo spento da tempo). Il più vecchio per primo.
export function missingSensors(sensors, now = Date.now(), hours = MISSING_HOURS) {
  const limit = hours * 60 * 60 * 1000
  return sensors
    .filter((s) => s.active !== false)
    .filter((s) => !s.last_seen || now - new Date(s.last_seen).getTime() > limit)
    .sort((a, b) => new Date(a.last_seen || 0).getTime() - new Date(b.last_seen || 0).getTime())
}

// La sincronizzazione è ferma? Se NESSUN sensore si è aggiornato da più di un'ora, sì.
// Se non ci sono sensori non si può dire: nessun allarme.
export function syncHealth(sensors, now = Date.now(), minutes = SYNC_STOP_MINUTES) {
  const times = sensors.filter((s) => s.active !== false && s.last_seen).map((s) => new Date(s.last_seen).getTime())
  if (times.length === 0) return { stopped: false, minutes: null }
  const ago = Math.round((now - Math.max(...times)) / 60000)
  return { stopped: ago > minutes, minutes: ago }
}

// "2 ore", "3 giorni"… per dire da quanto tempo manca un dato.
export function agoText(iso, now = Date.now()) {
  if (!iso) return 'mai aggiornato'
  const min = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000))
  if (min < 90) return `${min} min fa`
  const h = Math.round(min / 60)
  if (h < 48) return `${h} ore fa`
  return `${Math.round(h / 24)} giorni fa`
}
