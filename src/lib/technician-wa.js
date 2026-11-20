// Messaggio WhatsApp per il tecnico (come l'app HotelGio): si apre WhatsApp con il testo già scritto.
const URGENCY = { urgente: 'Urgente', alta: 'Alta', normale: 'Normale', bassa: 'Bassa' }

export function technicianWaLink(issue, technician, note = '') {
  const phone = String(technician?.phone || '').replace(/[^\d]/g, '')
  if (!phone) return null
  const where = issue.room ? `in ${issue.room}` : 'in struttura'
  const lines = [`Ciao ${technician.name}, c'è un intervento da fare ${where}${issue.category ? ` (${issue.category})` : ''}.`]
  if (issue.title) lines.push(`Descrizione: ${issue.title}`)
  if (String(note || '').trim()) lines.push(String(note).trim())
  lines.push(`Urgenza: ${URGENCY[issue.urgency] || issue.urgency}`)
  return `https://wa.me/${phone}?text=${encodeURIComponent(lines.join('\n\n'))}`
}
