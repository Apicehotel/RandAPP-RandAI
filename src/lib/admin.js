// Logica pura (testabile) delle Impostazioni admin: nomi leggibili dei permessi, raggruppamento, formati.
export const ROLES = ['admin', 'direzione', 'responsabile', 'manutentore', 'governante', 'reception']

export const PERM_GROUPS = {
  issues: 'Segnalazioni', interventions: 'Interventi', planning_work: 'Planning lavori', planning_sale: 'Planning sale',
  urgent: 'Urgenti', reminders: 'Promemoria', presence: 'Presenze', warehouse: 'Magazzino', supplies: 'Forniture',
  housekeeping: 'Housekeeping', sensors: 'Sensori', notifications: 'Notifiche', admin: 'Amministrazione',
}
const ACTIONS = {
  view: 'vedere', create: 'creare', update: 'modificare', assign: 'assegnare', move: 'spostare', manage: 'gestire',
  operate: 'operare', complete: 'completare', access: 'accedere',
}

export const permGroup = (perm) => String(perm).split('.')[0]
export const permGroupLabel = (perm) => PERM_GROUPS[permGroup(perm)] || permGroup(perm)
export const permActionLabel = (perm) => {
  const action = String(perm).split('.')[1] || ''
  return ACTIONS[action] || action
}

// [{ group, label, perms: [...] }] in ordine di gruppo, permessi in ordine alfabetico.
export function groupPermissions(perms) {
  const map = new Map()
  for (const p of [...new Set(perms)].sort()) {
    const g = permGroup(p)
    if (!map.has(g)) map.set(g, { group: g, label: permGroupLabel(p), perms: [] })
    map.get(g).perms.push(p)
  }
  return [...map.values()]
}

// { admin: Set(...), ... } da righe { role, permission }.
export function rolesMatrix(rows) {
  const m = Object.fromEntries(ROLES.map((r) => [r, new Set()]))
  for (const { role, permission } of rows || []) (m[role] ||= new Set()).add(permission)
  return m
}

export function formatBytes(n) {
  const v = Number(n) || 0
  if (v < 1024) return `${v} B`
  if (v < 1024 ** 2) return `${(v / 1024).toFixed(0)} KB`
  if (v < 1024 ** 3) return `${(v / 1024 ** 2).toFixed(1)} MB`
  return `${(v / 1024 ** 3).toFixed(2)} GB`
}

export const isValidPin = (pin) => /^\d{4}$/.test(String(pin || ''))

// Riepilogo invii per canale: { whatsapp: { sent: 3, failed: 1 }, ... }
export function deliverySummary(rows) {
  const out = {}
  for (const { channel, status, n } of rows || []) {
    out[channel] ||= {}
    out[channel][status] = (out[channel][status] || 0) + Number(n || 0)
  }
  return out
}

export const CHANNEL_LABELS = { whatsapp: 'WhatsApp', ntfy: 'ntfy', push: 'Notifiche push' }

// Consumi: percentuale (0-100, intera) per le barre; senza massimo o con massimo 0 non c'è barra.
export function usagePercent(used, max) {
  const u = Number(used), m = Number(max)
  if (!Number.isFinite(u) || !Number.isFinite(m) || m <= 0) return null
  return Math.max(0, Math.min(100, Math.round((u / m) * 100)))
}

// Attività degli ultimi 30 giorni: altezze delle barre (0-100) sul giorno più alto, e totali.
export function activityBars(days) {
  const list = Array.isArray(days) ? days : []
  const rows = list.map((d) => ({ date: String(d?.date || ''), issues: Number(d?.issues) || 0, interventions: Number(d?.interventions) || 0 }))
  const peak = Math.max(1, ...rows.map((r) => r.issues + r.interventions))
  return {
    bars: rows.map((r) => ({ ...r, height: Math.round(((r.issues + r.interventions) / peak) * 100) })),
    issues: rows.reduce((a, r) => a + r.issues, 0),
    interventions: rows.reduce((a, r) => a + r.interventions, 0),
  }
}
