import { useCallback, useEffect, useRef, useState } from 'react'
import { listRooms } from '../data/housekeeping.js'
import { can, PERM } from '../lib/permissions.js'
import { newlyReady, wantsReadyAlerts } from '../lib/housekeeping.js'
import { POLL_MS } from '../lib/urgent.js'

// «Camera 204 pronta»: avviso su qualsiasi schermata per reception e portiere notturno quando il governante finisce una camera.
// Controllo ogni 20 secondi a schermata visibile (come gli avvisi urgenti); si carica a richiesta.
export default function RoomReadyAlert({ ctx }) {
  const enabled = wantsReadyAlerts(ctx.role) && can(ctx.permissions, PERM.HOUSEKEEPING_VIEW)
  const [ready, setReady] = useState([])
  const prev = useRef(null)

  const load = useCallback(async () => {
    if (document.visibilityState === 'hidden') return
    try {
      const rooms = await listRooms(ctx.hotelId)
      const fresh = newlyReady(prev.current, rooms)
      prev.current = rooms
      if (fresh.length) {
        setReady((list) => [...list, ...fresh.filter((r) => !list.some((x) => x.id === r.id))])
        try { navigator.vibrate?.(80) } catch { /* non supportata */ }
      }
    } catch { /* senza rete e senza copia: si riprova al prossimo giro */ }
  }, [ctx.hotelId])

  useEffect(() => {
    prev.current = null // cambio struttura: si riparte da zero, nessun avviso per le camere già pronte
    setReady([])
    if (!enabled) return undefined
    load()
    const timer = setInterval(load, POLL_MS)
    const onVisible = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [enabled, load])

  if (!enabled || ready.length === 0) return null
  return (
    <div className="ready-bar" role="status">
      {ready.slice(0, 3).map((r) => (
        <div key={r.id} className="ready-item">
          <span><strong>Camera {r.room}</strong> pronta</span>
          <button type="button" className="ready-btn" onClick={() => setReady((list) => list.filter((x) => x.id !== r.id))}>Ok</button>
        </div>
      ))}
      {ready.length > 3 && (
        <div className="ready-item">
          <span>+ altre {ready.length - 3} camere pronte</span>
          <button type="button" className="ready-btn" onClick={() => setReady([])}>Ok tutte</button>
        </div>
      )}
    </div>
  )
}
