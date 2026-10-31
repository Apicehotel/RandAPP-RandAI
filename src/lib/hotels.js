import gio from '../assets/logos/hotelgio.webp'
import choco from '../assets/logos/chocohotel.webp'
import brigantino from '../assets/logos/brigantino.webp'
export { default as apiceLogo } from '../assets/logos/apicehotel.webp'

// Strutture canoniche. Gli id sono gli stessi della tabella public.hotels.
export const HOTELS = [
  { id: 'hotelgio', name: 'Hotel Giò', logo: gio },
  { id: 'chocohotel', name: 'Choco Hotel', logo: choco },
  { id: 'brigantino', name: 'Hotel Il Brigantino', logo: brigantino },
]

export const hotelById = (id) => HOTELS.find((h) => h.id === id) || null
