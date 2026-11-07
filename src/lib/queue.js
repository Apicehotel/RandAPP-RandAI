// Logica pura (testabile) per ordinare e riassumere le segnalazioni.

export const STATUSES = [
  { id: 'da_fare', label: 'Da fare' },
  { id: 'tecnico', label: 'Tecnico' },
  { id: 'attesa_pezzo', label: 'Attesa pezzo' },
  { id: 'completata', label: 'Completata' },
]

export const URGENCIES = [
  { id: 'urgente', label: 'Urgente', rank: 4 },
  { id: 'alta', label: 'Alta', rank: 3 },
  { id: 'normale', label: 'Normale', rank: 2 },
  { id: 'bassa', label: 'Bassa', rank: 1 },
]

// Unione delle categorie della vecchia app (segnalazioni: arredo, varie, idraulico, elettrico, edilizio, clima;
// interventi: filtri, varie, idromassaggio, edilizio, extrapiani, arredo) più Serramenti. "Altro" resta ultima.
export const CATEGORIES = [
  'Idraulica',
  'Elettrico',
  'Climatizzazione',
  'Arredi',
  'Edilizio',
  'Serramenti',
  'Filtri',
  'Idromassaggio',
  'Extrapiani',
  'Altro',
]

export const statusLabel = (id) => STATUSES.find((s) => s.id === id)?.label || id
export const urgencyLabel = (id) => URGENCIES.find((u) => u.id === id)?.label || id
const urgencyRank = (id) => URGENCIES.find((u) => u.id === id)?.rank || 0

export const isOpen = (issue) => issue.status !== 'completata'

// Prima le più urgenti, a parità la più vecchia (aspetta da più tempo).
export function sortByPriority(issues) {
  return [...issues].sort((a, b) => {
    const byUrgency = urgencyRank(b.urgency) - urgencyRank(a.urgency)
    if (byUrgency !== 0) return byUrgency
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })
}

export function workQueue(issues, limit = 10) {
  return sortByPriority(issues.filter(isOpen)).slice(0, limit)
}

export function summarize(issues) {
  const open = issues.filter(isOpen)
  return {
    open: open.length,
    urgent: open.filter((i) => i.urgency === 'urgente').length,
    waitingPart: open.filter((i) => i.status === 'attesa_pezzo').length,
    withTechnician: open.filter((i) => i.status === 'tecnico').length,
  }
}

export function filterByStatus(issues, status) {
  if (!status || status === 'tutte') return issues
  return issues.filter((i) => i.status === status)
}

// Statistiche come nel Planning: aperte · urgenti · completate oggi (data locale).
const isoLocal = (value) => {
  const d = new Date(value)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export const completedOn = (item, iso) => Boolean(item.completed_at) && isoLocal(item.completed_at) === iso
export function issueStats(issues, iso) {
  const open = issues.filter(isOpen)
  return {
    open: open.length,
    urgent: open.filter((i) => i.urgency === 'urgente').length,
    done: issues.filter((i) => completedOn(i, iso)).length,
  }
}
