// Logica pura del Magazzino.

export const MOVE_KINDS = [
  { id: 'carico', label: 'Carico', hint: 'Entra merce' },
  { id: 'scarico', label: 'Scarico', hint: 'Esce merce' },
  { id: 'rettifica', label: 'Rettifica', hint: 'Imposta la giacenza reale' },
]
export const moveKindLabel = (id) => MOVE_KINDS.find((k) => k.id === id)?.label || id

export const isLow = (item) => Number(item.min_quantity) > 0 && Number(item.quantity) <= Number(item.min_quantity)
export const isOut = (item) => Number(item.quantity) <= 0

// Numero con virgola o punto ("1,5" -> 1.5). null se vuoto o non valido.
export function parseAmount(value) {
  const n = Number(String(value ?? '').trim().replace(',', '.'))
  return String(value ?? '').trim() !== '' && Number.isFinite(n) && n >= 0 ? n : null
}

export const formatQty = (n, unit = '') => {
  const v = Number(n)
  const text = Number.isInteger(v) ? String(v) : String(Math.round(v * 1000) / 1000).replace('.', ',')
  return unit ? `${text} ${unit}` : text
}

// Filtri: Tutti, Sotto scorta, Esauriti. Ricerca su nome, categoria e ubicazione.
export function filterItems(items, { filter = 'tutti', query = '' } = {}) {
  const q = query.trim().toLowerCase()
  return items
    .filter((i) => i.active !== false)
    .filter((i) => (filter === 'sotto' ? isLow(i) : filter === 'esauriti' ? isOut(i) : true))
    .filter((i) => !q || [i.name, i.category, i.location].some((v) => (v || '').toLowerCase().includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name, 'it'))
}

export const summarizeWarehouse = (items) => {
  const active = items.filter((i) => i.active !== false)
  return { total: active.length, low: active.filter(isLow).length, out: active.filter(isOut).length }
}

// Controlla un movimento prima di inviarlo (il database lo ricontrolla comunque).
export function checkMove(item, kind, amount) {
  if (amount === null) return 'Scrivi una quantità valida'
  if (kind !== 'rettifica' && amount === 0) return 'La quantità deve essere maggiore di zero'
  if (kind === 'scarico' && amount > Number(item.quantity)) return 'Giacenza insufficiente'
  return ''
}
