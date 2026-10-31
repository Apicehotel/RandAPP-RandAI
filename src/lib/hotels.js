// Strutture canoniche. Gli id sono gli stessi della tabella public.hotels.
export const HOTELS = [
  { id: 'hotelgio', name: 'Hotel Giò' },
  { id: 'chocohotel', name: 'Choco Hotel' },
  { id: 'brigantino', name: 'Hotel Il Brigantino' },
]

export const hotelById = (id) => HOTELS.find((h) => h.id === id) || null
