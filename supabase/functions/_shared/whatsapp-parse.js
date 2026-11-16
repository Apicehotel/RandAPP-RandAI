// Logica pura della ricezione WhatsApp (testabile in Node): numeri, firma Twilio, camera, categoria, urgenza, titolo.
// Le categorie sono quelle di RandApp (src/lib/queue.js), le urgenze bassa/normale/alta/urgente.

export const normalizePhone = (value) => {
  const raw = String(value || '').trim().replace(/^whatsapp:/i, '')
  const digits = raw.replace(/\D/g, '')
  if (!digits) return null
  const out = raw.startsWith('+') ? `+${digits}` : digits.startsWith('39') ? `+${digits}` : `+39${digits}`
  return /^\+[0-9]{8,15}$/.test(out) ? out : null
}

// Twilio firma URL + parametri ordinati (chiave+valore) con HMAC-SHA1 e Auth Token.
export const twilioSignedString = (url, params) => {
  const entries = [...params.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return entries.reduce((acc, [k, v]) => acc + k + v, url)
}

export const normalizeText = (value) =>
  String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9\-\s]/g, ' ').replace(/\s+/g, ' ').trim()

// Numeri di camera plausibili per hotel (stessi schemi della vecchia app).
export const plausibleRoom = (hotelId, n) => {
  if (hotelId === 'hotelgio') return /^\d{3}$/.test(n) || /^(11|22|33|44)\d{2}$/.test(n)
  if (hotelId === 'chocohotel') return /^[234]\d{2}$/.test(n)
  if (hotelId === 'brigantino') return /^[12]\d{2}$/.test(n)
  return false
}

// Camera: prima un numero plausibile (o noto), poi il nome di una zona (hotel_locations: nome e alias).
// `locations` = [{ name, aliases: [] }]
export function findRoom(hotelId, body, locations = []) {
  const numbers = [...new Set(String(body || '').match(/\b\d{3,4}\b/g) || [])]
  for (const n of numbers) if (plausibleRoom(hotelId, n)) return n
  const text = ` ${normalizeText(body)} `
  for (const loc of locations) {
    for (const label of [loc.name, ...(loc.aliases || [])]) {
      const norm = normalizeText(label)
      if (norm.length >= 3 && text.includes(` ${norm} `)) return String(loc.name).slice(0, 40)
    }
  }
  return null
}

export function categoryFrom(body) {
  const t = normalizeText(body)
  if (/acqua|rubinett|wc|scaric|doccia|lavandin|perd|idraulic|sifone|bidet/.test(t)) return 'Idraulica'
  if (/luce|lamp|presa|corrente|elettric|interrutt|tv|televis|frigo/.test(t)) return 'Elettrico'
  if (/aria condizionata|condizionat|clima|cald|fredd|termostat|fan coil|riscald/.test(t)) return 'Climatizzazione'
  if (/finestr|serrament|tapparell|persian|zanzarier|serratur|maniglia/.test(t)) return 'Serramenti'
  if (/porta|mobile|letto|sedia|tavol|armadio|arredo|comodino|materasso|cassetto/.test(t)) return 'Arredi'
  if (/muro|intonaco|pittur|infiltraz|crepa|piastrell/.test(t)) return 'Edilizio'
  return 'Altro'
}

export function urgencyFrom(body) {
  const t = normalizeText(body)
  if (/emergenza|allag|fumo|incend|scintill|corto circuito|perdita forte/.test(t)) return 'urgente'
  if (/urgente|non si chiude|bloccat|impossibile/.test(t)) return 'alta'
  if (/bassa|quando possibile|non urgente|senza fretta/.test(t)) return 'bassa'
  return 'normale'
}

export function titleFrom(body, room) {
  const first = String(body || '').split(/\r?\n/)[0].replace(/\s+/g, ' ').trim()
  return (first || (room ? `Segnalazione ${room}` : 'Segnalazione')).slice(0, 140)
}

// Foto: formato riconosciuto dai primi byte (non ci si fida del tipo dichiarato). Limite 1,4 MB: il data URL base64 deve stare sotto 2.000.000 caratteri.
export const MAX_PHOTO_BYTES = 1_400_000
export function sniffImage(bytes) {
  if (!bytes || !bytes.length) return null
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png'
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'image/webp'
  return null
}

export const xmlEscape = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
