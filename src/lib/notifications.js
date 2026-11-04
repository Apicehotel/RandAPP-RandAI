// Logica pura (testabile) del sistema notifiche: tipi, canali, preferenze, raggruppamento per giorno.
// Le notifiche le crea solo il server; qui si leggono, si segnano come lette e si scelgono i canali.

export const KINDS = [
  { id: 'urgent_alert', presentOnly: true, label: 'Avviso urgente', icon: 'alert', group: 'Task' },
  { id: 'urgent_reminder', presentOnly: true, label: 'Avviso ancora da prendere in carico', icon: 'alert', group: 'Task' },
  { id: 'reminder', presentOnly: true, label: 'Promemoria', icon: 'clock', group: 'Task' },
  { id: 'issue_urgent', label: 'Segnalazione urgente', icon: 'alert', group: 'Operatività' },
  { id: 'issue_assigned', label: 'Segnalazione assegnata a me', icon: 'user', group: 'Operatività' },
  { id: 'intervention_assigned', label: 'Intervento assegnato a me', icon: 'wrench', group: 'Operatività' },
  { id: 'work_assigned', label: 'Lavoro assegnato a me', icon: 'wrench', group: 'Planning' },
  { id: 'sensor_alert', label: 'Sensore in allerta', icon: 'thermo', group: 'Sensori' },
  { id: 'sensor_stale', label: 'Sensori che non arrivano più', icon: 'thermo', group: 'Sensori' },
  { id: 'sync_stopped', label: 'Sincronizzazione sensori ferma', icon: 'thermo', group: 'Sensori' },
]
export const kindOf = (id) => KINDS.find((k) => k.id === id) || { id, label: 'Notifica', icon: 'alert', group: '' }
export const kindGroups = () => [...new Set(KINDS.map((k) => k.group))].map((name) => ({ name, kinds: KINDS.filter((k) => k.group === name) }))

// Canali: "push" copre il telefono (web oggi; app Android/iOS in futuro), "ntfy" l'app ntfy, "whatsapp" il numero.
export const CHANNELS = [
  { id: 'push', label: 'Notifiche del telefono' },
  { id: 'ntfy', label: 'ntfy' },
  { id: 'whatsapp', label: 'WhatsApp' },
]
export const DEFAULT_PREFS = { push: true, ntfy: true, whatsapp: false }
export function prefFor(prefs, kind) {
  const row = (prefs || []).find((p) => p.kind === kind) || {}
  return { push: row.push ?? DEFAULT_PREFS.push, ntfy: row.ntfy ?? DEFAULT_PREFS.ntfy, whatsapp: row.whatsapp ?? DEFAULT_PREFS.whatsapp }
}

// ---- Elenco
export const unreadCount = (list) => (list || []).filter((n) => !n.read_at).length
export const badgeText = (count) => (count > 99 ? '99+' : String(count))

const dayKey = (v) => { const d = new Date(v); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
// Raggruppa per giorno (Oggi, Ieri, poi la data), dal più recente.
export function groupByDay(list, now = new Date()) {
  const today = dayKey(now)
  const yest = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))
  const groups = []
  for (const n of [...(list || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))) {
    const key = dayKey(n.created_at)
    let g = groups.find((x) => x.key === key)
    if (!g) {
      const d = new Date(n.created_at)
      groups.push((g = { key, label: key === today ? 'Oggi' : key === yest ? 'Ieri' : d.toLocaleDateString('it-IT', { day: '2-digit', month: 'long' }), items: [] }))
    }
    g.items.push(n)
  }
  return groups
}
export const timeOf = (iso) => new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })

// Il link salvato è un percorso dell'app ("/issues/abc"): diventa un indirizzo con #.
export const hashFor = (link) => (link && /^\/[a-z0-9/_-]*$/i.test(link) ? `#${link}` : '#/notifications')

// ---- Destinazioni dell'utente
// Topic ntfy personale: lungo e casuale, perché su ntfy chi conosce il nome può leggere. `bytes` è iniettabile per i test.
export function newNtfyTopic(hotelId, bytes = crypto.getRandomValues(new Uint8Array(16))) {
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `rand-${String(hotelId).replace(/[^a-z0-9]/gi, '').toLowerCase()}-${hex}`
}
export const NTFY_BASE = 'https://ntfy.sh'
export const ntfyLink = (topic, base = NTFY_BASE) => `${base}/${topic}`

export const normalizePhone = (v) => {
  const s = String(v || '').replace(/[\s().-]/g, '')
  return /^\+\d{8,15}$/.test(s) ? s : /^\d{8,15}$/.test(s) ? `+39${s}` : null
}

// ---- Web push
export const webPushSupported = (w = globalThis) => Boolean(w?.navigator?.serviceWorker && w?.PushManager && w?.Notification)
export function urlBase64ToBytes(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

// Il dispositivo web di questo browser, tra quelli dell'utente (per sapere se il push è già attivo qui).
export const deviceFor = (devices, platform, token) => (devices || []).find((d) => d.platform === platform && d.token === token) || null
