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

// Da <input type="datetime-local"> (ora locale) a ISO, oppure null se vuoto/non valido.
export function localInputToIso(value) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}
