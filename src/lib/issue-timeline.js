// Cronologia di una segnalazione, ricavata dai campi che già ci sono (non c'è una tabella eventi):
// solo apertura e chiusura hanno data e ora; gli altri passaggi compaiono senza orario.
export const formatArrival = (iso) => new Date(iso).toLocaleString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const SOURCE = { whatsapp: 'WhatsApp', app: 'App', import: 'vecchia app' }

const TECH = { arrival_set: 'Il tecnico comunica l\'arrivo', started: 'Intervento iniziato', note: 'Nota del tecnico', completion_requested: 'Il tecnico ha finito: richiede la chiusura' }

export function issueTimeline(issue, techEvents = []) {
  if (!issue) return []
  const ev = []
  const by = issue.created_by_name ? ` da ${issue.created_by_name}` : ''
  ev.push({ id: 'created', at: issue.created_at, text: `Aperta${by}${SOURCE[issue.source] ? ` via ${SOURCE[issue.source]}` : ''}` })
  if (issue.technician_name) ev.push({ id: 'tech', at: null, text: `Tecnico: ${issue.technician_name}` })
  if (issue.part_needed) ev.push({ id: 'need', at: null, text: `Pezzo richiesto: ${issue.part_needed}` })
  if (issue.part_replaced) ev.push({ id: 'repl', at: null, text: `Pezzo sostituito: ${issue.part_replaced}` })
  for (const e of techEvents) {
    if (TECH[e.kind]) ev.push({ id: `te${e.id}`, at: e.created_at, text: e.kind === 'note' && e.note ? `${TECH[e.kind]}: ${e.note}` : TECH[e.kind] + (e.kind === 'arrival_set' && e.arrival_at ? ` per il ${formatArrival(e.arrival_at)}` : '') })
  }
  if (issue.completed_at) ev.push({ id: 'done', at: issue.completed_at, text: `Completata${issue.completed_by_name ? ` da ${issue.completed_by_name}` : ''}` })
  return ev
}
