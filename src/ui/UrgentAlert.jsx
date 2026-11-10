import { useCallback, useEffect, useRef, useState } from 'react'
import { listAlerts, updateAlertStatus } from '../data/task.js'
import { listPresence } from '../data/presence.js'
import { go, usePending } from '../lib/hooks.js'
import { can, PERM } from '../lib/permissions.js'
import { agoLabel } from '../lib/task.js'
import { POLL_MS, applyPendingAlerts, canRing, hasNewAlert, isPresent, openAlerts, shouldRing } from '../lib/urgent.js'
import { playSiren, unlockAudio } from '../lib/siren.js'

// Avviso urgente su QUALSIASI schermata: nota, da quanto è aperto, «Prendo in carico», «Apri», «Silenzia».
// Suona (e vibra) ogni 30 secondi finché c'è un avviso da prendere, solo per chi può prenderlo in carico ed è in struttura.
// Si carica a richiesta (lazy) per non pesare sull'avvio.
export default function UrgentAlert({ ctx }) {
  const canView = can(ctx.permissions, PERM.URGENT_VIEW)
  const canTake = can(ctx.permissions, PERM.URGENT_UPDATE)
  const pending = usePending(ctx)
  const [alerts, setAlerts] = useState([])
  const [present, setPresent] = useState(true)
  const [silenced, setSilenced] = useState(() => new Set())
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')
  const known = useRef(new Set())
  const lastRing = useRef(0)

  const load = useCallback(async () => {
    if (document.visibilityState === 'hidden') return
    try {
      const [list, rows] = await Promise.all([listAlerts(ctx.hotelId), listPresence(ctx.hotelId).catch(() => null)])
      setAlerts(list)
      setPresent(isPresent(rows, ctx.userId))
    } catch { /* senza rete e senza copia: si riprova al prossimo giro */ }
  }, [ctx.hotelId, ctx.userId])

  useEffect(() => {
    if (!canView) return undefined
    load()
    const timer = setInterval(load, POLL_MS)
    const onVisible = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('outbox:flushed', load)
    window.addEventListener('pointerdown', unlockAudio, { passive: true })
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('outbox:flushed', load)
      window.removeEventListener('pointerdown', unlockAudio)
    }
  }, [canView, load])

  const open = openAlerts(applyPendingAlerts(alerts, pending))
  const ringAllowed = canRing({ canUpdate: canTake, present })

  // Controllo ogni 5 secondi: suona subito per un avviso nuovo, poi ogni 30 secondi.
  useEffect(() => {
    if (!canView) return undefined
    const tick = () => {
      const isNew = hasNewAlert(known.current, open)
      known.current = new Set(open.map((a) => a.id))
      const now = Date.now()
      if (shouldRing({ open, silenced, ringAllowed, lastRingAt: lastRing.current, now, hasNew: isNew })) {
        // Se l'audio non è ancora sbloccato (nessun tocco dopo l'apertura) si riprova al prossimo controllo, senza aspettare altri 30 secondi.
        if (playSiren()) lastRing.current = now
      }
    }
    tick()
    const timer = setInterval(tick, 5000)
    return () => clearInterval(timer)
  })

  const take = async (alert) => {
    setBusy(alert.id); setError('')
    try {
      const r = await updateAlertStatus(ctx.hotelId, ctx.userId, alert.id, 'in_carico')
      if (!r?.pending) await load()
    } catch (e) { setError(e.message) } finally { setBusy(null) }
  }

  if (!canView || open.length === 0) return null
  return (
    <div className="urgent-bar" role="alert">
      {open.slice(0, 2).map((a) => (
        <div key={a.id} className="urgent-item">
          <div className="urgent-note"><strong>URGENTE</strong> · {a.note} <span className="urgent-ago">{agoLabel(a.created_at)}</span></div>
          <div className="urgent-actions">
            {canTake && <button type="button" className="urgent-btn primary" disabled={busy === a.id} onClick={() => take(a)}>{busy === a.id ? '…' : 'Prendo in carico'}</button>}
            <button type="button" className="urgent-btn" onClick={() => go(`/task/urgent/${a.id}`)}>Apri</button>
            {ringAllowed && !silenced.has(a.id) && <button type="button" className="urgent-btn" onClick={() => setSilenced((s) => new Set(s).add(a.id))}>Silenzia</button>}
          </div>
        </div>
      ))}
      {open.length > 2 && <div className="urgent-more">+ altri {open.length - 2} avvisi da prendere</div>}
      {error && <div className="urgent-more">{error}</div>}
    </div>
  )
}
