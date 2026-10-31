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

// Stato per colore/etichetta: 'allerta' | 'offline' | 'ok'
export function sensorState(sensor, now = Date.now()) {
  if (!sensor.online || isStale(sensor, now)) return 'offline'
  if (sensor.kind === 'temperatura' && sensor.temperature !== null && sensor.temperature !== undefined) {
    const t = Number(sensor.temperature)
    if (sensor.alert_max !== null && sensor.alert_max !== undefined && t > Number(sensor.alert_max)) return 'allerta'
    if (sensor.alert_min !== null && sensor.alert_min !== undefined && t < Number(sensor.alert_min)) return 'allerta'
  }
  return 'ok'
}
export const STATE_LABELS = { ok: 'Regolare', allerta: 'In allerta', offline: 'Non aggiornato' }

export const formatTemp = (t) => (t === null || t === undefined ? '—' : `${String(Number(t).toFixed(1)).replace('.', ',')}°C`)
export const formatHumidity = (h) => (h === null || h === undefined ? '—' : `${Math.round(Number(h))}%`)

export const summarizeSensors = (sensors, now = Date.now()) => {
  const active = sensors.filter((s) => s.active !== false)
  const count = (st) => active.filter((s) => sensorState(s, now) === st).length
  return { total: active.length, alert: count('allerta'), offline: count('offline'), ok: count('ok') }
}

// Prima quelli in allerta, poi non aggiornati, poi in ordine.
const RANK = { allerta: 0, offline: 1, ok: 2 }
export const sortSensors = (sensors, now = Date.now()) =>
  sensors
    .filter((s) => s.active !== false)
    .sort((a, b) =>
      RANK[sensorState(a, now)] - RANK[sensorState(b, now)] ||
      a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'it'))

// Numero opzionale da un campo di testo ("" -> null, "4,5" -> 4.5, non valido -> undefined).
export function optionalNumber(value) {
  const text = String(value ?? '').trim()
  if (text === '') return null
  const n = Number(text.replace(',', '.'))
  return Number.isFinite(n) ? n : undefined
}
