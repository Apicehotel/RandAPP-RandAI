// Logica pura del Rifornimento (richieste interne governante -> manutenzione).

export const SUPPLY_CATEGORIES = [
  { id: 'minibar', label: 'Minibar' },
  { id: 'consumo', label: 'Consumo' },
]
export const supplyCategoryLabel = (id) => SUPPLY_CATEGORIES.find((c) => c.id === id)?.label || id

export const ITEM_STATUSES = [
  { id: 'pending', label: 'Da portare' },
  { id: 'delivered', label: 'Consegnato' },
  { id: 'missing', label: 'Mancante' },
]
export const itemStatusLabel = (id) => ITEM_STATUSES.find((s) => s.id === id)?.label || id

// Una richiesta è aperta finché ha righe da portare.
export const isRequestOpen = (items) => items.some((i) => i.status === 'pending')

export function summarizeRequest(items) {
  const count = (s) => items.filter((i) => i.status === s).length
  return { total: items.length, pending: count('pending'), delivered: count('delivered'), missing: count('missing') }
}

// Unisce richieste e righe: [{...richiesta, items, summary, open}] dalla più recente.
export function joinRequests(requests, items) {
  const byRequest = new Map()
  for (const it of items) {
    if (!byRequest.has(it.request_id)) byRequest.set(it.request_id, [])
    byRequest.get(it.request_id).push(it)
  }
  return requests
    .map((r) => {
      const list = byRequest.get(r.id) || []
      return { ...r, items: list, summary: summarizeRequest(list), open: isRequestOpen(list) }
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
}

export const filterRequests = (list, filter) =>
  filter === 'chiuse' ? list.filter((r) => !r.open) : filter === 'tutte' ? list : list.filter((r) => r.open)

// Prodotti attivi raggruppati per categoria, in ordine.
export function groupProducts(products) {
  return SUPPLY_CATEGORIES.map((c) => ({
    ...c,
    products: products
      .filter((p) => p.active !== false && p.category === c.id)
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'it')),
  })).filter((g) => g.products.length)
}
