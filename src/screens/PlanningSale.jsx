import { useState } from 'react'
import { listBookings, getBooking, updateBookingStatus } from '../data/planning.js'
import { useAsync, go } from '../lib/hooks.js'
import { can, PERM } from '../lib/permissions.js'
import {
  BOOKING_STATUSES, addDaysIso, bookingStatusLabel, bookingsOnDay, dayLabel, shiftLabel, shortDate, todayIso,
} from '../lib/planning.js'
import { Badge, Button, ErrorText, Spinner } from '../ui/kit.jsx'

export function BookingCard({ item }) {
  const range = item.date_from === item.date_to ? shortDate(item.date_from) : `${shortDate(item.date_from)} – ${shortDate(item.date_to)}`
  return (
    <a className="card issue" href={`#/planning/sale/${item.id}`}>
      <div className="row">
        <span className="title">{item.client}</span>
        <Badge kind={item.status}>{shiftLabel(item.shift)}</Badge>
      </div>
      <div className="row muted">
        <span>{item.room}{item.pax ? ` · ${item.pax} pax` : ''}</span>
        <span>{range}</span>
      </div>
    </a>
  )
}

export function SaleList({ ctx }) {
  const [day, setDay] = useState(todayIso)
  const { data, error, loading, reload } = useAsync(() => listBookings(ctx.hotelId, todayIso()), [ctx.hotelId])
  const visible = bookingsOnDay(data || [], day)

  return (
    <div className="page">
      <a href="#/planning">← Planning</a>
      <div className="row">
        <h1>Planning Sale</h1>
        {can(ctx.permissions, PERM.PLANNING_SALE_CREATE) && (
          <Button variant="primary" onClick={() => go('/planning/sale/new')}>+ Prenotazione</Button>
        )}
      </div>

      <div className="row weeknav">
        <button className="chip" onClick={() => setDay(addDaysIso(day, -1))} aria-label="Giorno precedente">←</button>
        <button className="chip" onClick={() => setDay(todayIso())}>{dayLabel(day)}{day === todayIso() ? ' · oggi' : ''}</button>
        <button className="chip" onClick={() => setDay(addDaysIso(day, 1))} aria-label="Giorno successivo">→</button>
      </div>

      {loading && !data && <Spinner />}
      <ErrorText>{error}</ErrorText>
      {error && <Button onClick={reload}>Riprova</Button>}

      <div className="list">
        {visible.map((b) => <BookingCard key={b.id} item={b} />)}
        {data && visible.length === 0 && <div className="card muted">Nessuna sala occupata in questo giorno.</div>}
      </div>
    </div>
  )
}

export function SaleDetail({ ctx, id }) {
  const { data: item, error, loading, reload } = useAsync(() => getBooking(ctx.hotelId, id), [ctx.hotelId, id])
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const canUpdate = can(ctx.permissions, PERM.PLANNING_SALE_UPDATE)

  const change = async (status) => {
    setBusy(true)
    setActionError('')
    try {
      await updateBookingStatus(ctx.hotelId, id, status)
      await reload()
    } catch (e) {
      setActionError(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading && !item) return <Spinner />
  if (error) return <div className="page"><ErrorText>{error}</ErrorText></div>
  if (!item) return <div className="page"><p className="muted">Prenotazione non trovata.</p></div>

  return (
    <div className="page">
      <a href="#/planning/sale">← Planning Sale</a>
      <div className="card stack">
        <div className="row">
          <h1>{item.client}</h1>
          <Badge kind={item.status === 'annullata' ? 'bassa' : 'fatto'}>{bookingStatusLabel(item.status)}</Badge>
        </div>
        <div className="muted">
          {item.room} · {shiftLabel(item.shift)}{item.pax ? ` · ${item.pax} persone` : ''}
        </div>
        <div className="muted">
          {item.date_from === item.date_to ? dayLabel(item.date_from) : `${dayLabel(item.date_from)} → ${dayLabel(item.date_to)}`}
        </div>
        {item.notes && <p>{item.notes}</p>}
      </div>
      {canUpdate && (
        <div className="card stack">
          <h2>Stato prenotazione</h2>
          <div className="chips">
            {BOOKING_STATUSES.map((s) => (
              <button key={s.id} className="chip" aria-pressed={item.status === s.id}
                disabled={busy || item.status === s.id} onClick={() => change(s.id)}>
                {s.label}
              </button>
            ))}
          </div>
          <ErrorText>{actionError}</ErrorText>
        </div>
      )}
    </div>
  )
}
