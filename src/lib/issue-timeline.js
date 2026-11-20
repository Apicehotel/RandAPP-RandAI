// Cronologia di una segnalazione, ricavata dai campi che già ci sono (non c'è una tabella eventi):
// solo apertura e chiusura hanno data e ora; gli altri passaggi compaiono senza orario.
const SOURCE = { whatsapp: 'WhatsApp', app: 'App', import: 'vecchia app' }

export function issueTimeline(issue) {
  if (!issue) return []
  const ev = []
  const by = issue.created_by_name ? ` da ${issue.created_by_name}` : ''
  ev.push({ id: 'created', at: issue.created_at, text: `Aperta${by}${SOURCE[issue.source] ? ` via ${SOURCE[issue.source]}` : ''}` })
  if (issue.technician_name) ev.push({ id: 'tech', at: null, text: `Tecnico: ${issue.technician_name}` })
  if (issue.part_needed) ev.push({ id: 'need', at: null, text: `Pezzo richiesto: ${issue.part_needed}` })
  if (issue.part_replaced) ev.push({ id: 'repl', at: null, text: `Pezzo sostituito: ${issue.part_replaced}` })
  if (issue.completed_at) ev.push({ id: 'done', at: issue.completed_at, text: `Completata${issue.completed_by_name ? ` da ${issue.completed_by_name}` : ''}` })
  return ev
}
