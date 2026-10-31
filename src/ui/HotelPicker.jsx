import { useEffect, useRef, useState } from 'react'
import { listMyHotels } from '../lib/auth.js'
import { HOTELS } from '../lib/hotels.js'
import { hotelsForMemberships } from '../lib/memberships.js'
import { roleLabel } from '../lib/permissions.js'
import { useAsync } from '../lib/hooks.js'
import { ErrorText, Icon, Spinner } from './kit.jsx'

// Scelta struttura: si apre dal chip in alto a sinistra. Se l'utente ha più strutture
// si cambia al volo (senza rifare il PIN); altrimenti si può entrare con un altro utente.
export default function HotelPicker({ open, onClose, currentId, onChange, onOtherUser }) {
  const closeRef = useRef(null)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')
  const { data, error: loadError, loading } = useAsync(() => (open ? listMyHotels() : Promise.resolve([])), [open])

  useEffect(() => {
    if (!open) return undefined
    setError('')
    closeRef.current?.focus()
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  const options = hotelsForMemberships(data, HOTELS)

  const pick = async (id) => {
    if (id === currentId) return onClose()
    setBusyId(id)
    setError('')
    try {
      await onChange(id)
      onClose()
    } catch (e) {
      setError(e.message || 'Non riesco a cambiare struttura')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="picker-wrap">
      <button type="button" className="drawer-scrim" aria-label="Chiudi" onClick={onClose} tabIndex={-1} />
      <div className="picker" role="dialog" aria-modal="true" aria-label="Scegli la struttura">
        <div className="row">
          <h2>Struttura</h2>
          <button ref={closeRef} type="button" className="icon-btn" aria-label="Chiudi" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        {loading && !data && <Spinner />}
        <ErrorText>{loadError || error}</ErrorText>
        <div className="picker-list">
          {options.map((h) => (
            <button key={h.id} type="button" className="hotel-pick" aria-current={h.id === currentId ? 'true' : undefined}
              disabled={busyId !== null} onClick={() => pick(h.id)}>
              <img src={h.logo} alt="" width="44" height="44" />
              <span className="grow">
                <span>{h.name}</span>
                <small className="muted">{roleLabel(h.role)}</small>
              </span>
              {h.id === currentId && <Icon name="check" size={20} />}
            </button>
          ))}
        </div>
        {data && options.length <= 1 && <p className="muted">Il tuo utente ha accesso solo a questa struttura.</p>}
        <button type="button" className="link-btn" onClick={onOtherUser}>Entra con un altro utente</button>
      </div>
    </div>
  )
}
