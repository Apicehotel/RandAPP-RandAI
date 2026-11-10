import { useEffect, useState } from 'react'
import { flushOutbox } from '../data/outbox.js'
import { removeEntry } from '../lib/outbox.js'
import { useOnline, usePending } from '../lib/hooks.js'

const KIND = { 'issue.create': 'Segnalazione', 'alert.status': 'Avviso urgente', 'hk.status': 'Stato camera', 'hk.note': 'Nota camera' }
const label = (e) => `${KIND[e.kind] || 'Modifica'}${e.payload?.row?.title ? `: ${e.payload.row.title}` : ''}`

// Invia da solo le modifiche fatte senza rete (all'apertura, quando torna la rete, ogni 30 secondi) e dice cosa è in attesa.
export default function OutboxBanner({ ctx }) {
  const items = usePending(ctx)
  const online = useOnline()
  const [sending, setSending] = useState(false)
  const pending = items.filter((e) => e.status === 'pending')
  const failed = items.filter((e) => e.status === 'failed')

  const send = async () => {
    setSending(true)
    try { await flushOutbox(ctx.userId) } finally { setSending(false) }
  }

  useEffect(() => {
    flushOutbox(ctx.userId)
    const timer = setInterval(() => flushOutbox(ctx.userId), 30000)
    const onVisible = () => document.visibilityState === 'visible' && flushOutbox(ctx.userId)
    window.addEventListener('online', onVisible)
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(timer); window.removeEventListener('online', onVisible); document.removeEventListener('visibilitychange', onVisible) }
  }, [ctx.userId])

  if (online && !pending.length && !failed.length) return null
  return (
    <div className="outbox" role="status">
      {!online && <p className="banner">Sei offline: vedi gli ultimi dati caricati. Le modifiche partono da sole appena torna la rete.</p>}
      {pending.length > 0 && (
        <p className="banner">
          {pending.length === 1 ? '1 modifica in attesa di invio' : `${pending.length} modifiche in attesa di invio`}
          {online && <> <button type="button" className="linkbtn" disabled={sending} onClick={send}>{sending ? 'Invio…' : 'Invia ora'}</button></>}
        </p>
      )}
      {failed.map((e) => (
        <p key={e.id} className="banner">
          Non inviata ({label(e)}): {e.error}. <button type="button" className="linkbtn" onClick={() => removeEntry(e.id)}>Scarta</button>
        </p>
      ))}
    </div>
  )
}
