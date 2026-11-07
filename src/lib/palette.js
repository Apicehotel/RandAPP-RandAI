// Palette per struttura: ogni hotel ha la sua tinta (sfondo sfumato + colore d'accento).
// Tema chiaro/scuro e dimensione restano scelte dell'utente, separate (vedi ui-prefs.js).
export const PALETTES = [
  { id: 'ghiaccio', label: 'Ghiaccio' },
  { id: 'salvia', label: 'Salvia' },
  { id: 'sera', label: 'Sera' },
  { id: 'cacao', label: 'Cacao' },
]
export const DEFAULT_PALETTE = 'ghiaccio'

// Gli id sono quelli di randapp.hotels. Salvia resta libera per una struttura futura.
export const HOTEL_PALETTE = {
  hotelgio: 'sera',
  chocohotel: 'cacao',
  brigantino: 'ghiaccio',
}

export const paletteFor = (hotelId) => HOTEL_PALETTE[hotelId] || DEFAULT_PALETTE

const KEY = 'randapp.palette'
const known = (id) => PALETTES.some((p) => p.id === id)

// Ultima palette usata: al riavvio l'app parte già con i colori dell'ultimo hotel, senza lampo di cambio.
export function applyStoredPalette() {
  let id = DEFAULT_PALETTE
  try {
    const saved = localStorage.getItem(KEY)
    if (known(saved)) id = saved
  } catch {
    /* storage non disponibile: si parte dalla palette di default */
  }
  document.documentElement.setAttribute('data-pal', id)
}

export function applyPalette(hotelId, root = globalThis.document?.documentElement) {
  const id = paletteFor(hotelId)
  root?.setAttribute('data-pal', id)
  try {
    localStorage.setItem(KEY, id)
  } catch {
    /* la palette vale solo per questa sessione */
  }
  return id
}
