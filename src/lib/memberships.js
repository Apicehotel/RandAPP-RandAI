// Dalle iscrizioni dell'utente (hotel_id + ruolo) alle strutture tra cui può scegliere.
// Segue l'ordine canonico delle strutture e ignora id sconosciuti.
export function hotelsForMemberships(memberships, allHotels) {
  const roleByHotel = new Map((memberships || []).map((m) => [m.hotel_id, m.role]))
  return allHotels.filter((h) => roleByHotel.has(h.id)).map((h) => ({ ...h, role: roleByHotel.get(h.id) }))
}
