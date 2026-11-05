import { useState } from 'react'
import { listBookings, getBooking, setBookingCheck, setBookingOp, updateBookingStatus } from '../data/planning.js'
import { getSaleConfig } from '../data/forms.js'
import { useAsync, go } from '../lib/hooks.js'
import { can, PERM } from '../lib/permissions.js'
import {
  CHECK_STATES, addDaysIso, bookingStatusLabel, bookingsToPrepare, checkLabel, checksReady, dayLabel, prepDay, prepStats,
  shiftLabel, shortDate, todayIso, weekDaysIso, weekStartIso, eventOnDay, monthGrid, monthLabel, monthStartIso, addMonthsIso,
} from '../lib/planning.js'
import { Badge, Button, ErrorText, Spinner } from '../ui/kit.jsx'
import { Stats } from './PlanningWork.jsx'

const time = (iso) => new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
const range = (b) => (b.date_from === b.date_to ? shortDate(b.date_from) : `${shortDate(b.date_from)} – ${shortDate(b.date_to)}`)

// Pastiglia di un controllo (Audio/Video): tocca per cambiare stato.
function CheckPill({ label, state, by, at, canOperate, busy, onSet }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="stack">
      <button type="button" className="checkpill" data-state={state} disabled={!canOperate} onClick={() => setOpen(!open)}>
        <span>{label}</span><strong>{checkLabel(state)}</strong>
      </button>
      {state !== 'non_richiesto' && by && <small className="muted">{by}{at ? ` · ${time(at)}` : ''}</small>}
      {open && (
        <div className="chips wrap" role="group" aria-label={`Stato ${label}`}>
          {CHECK_STATES.map((s) => (
            <button type="button" key={s.id} className="chip" aria-pressed={state === s.id} disabled={busy}
              onClick={() => { setOpen(false); onSet(s.id) }}>{s.label}</button>
          ))}
        </div>
      )}
    </div>
  )
}

// Controlli e stato operativo di una prenotazione. "Fatto" resta bloccato finché i check richiesti non sono OK.
export function BookingOps({ booking, canOperate, onChanged }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const done = booking.op_status === 'fatto'
  const finish = booking.op_status === 'da_finire'
  const run = async (fn) => {
    setBusy(true)
    setError('')
    try { await fn(); await onChanged?.() } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return (
    <div className="stack">
      <span className="field-label">Check sala</span>
      <div className="two">
        <CheckPill label="Audio" state={booking.audio_status} by={booking.audio_by_name} at={booking.audio_at}
          canOperate={canOperate} busy={busy} onSet={(s) => run(() => setBookingCheck(booking.id, 'audio', s))} />
        <CheckPill label="Video" state={booking.video_status} by={booking.video_by_name} at={booking.video_at}
          canOperate={canOperate} busy={busy} onSet={(s) => run(() => setBookingCheck(booking.id, 'video', s))} />
      </div>
      {done && <small className="ok-text">✓ Fatto da {booking.op_by_name}{booking.op_at ? ` · ${time(booking.op_at)}` : ''}</small>}
      {finish && <small className="warn-text">Da finire · {booking.op_by_name}</small>}
      {canOperate && (
        <div className="row dayrow-actions">
          {done
            ? <Button disabled={busy} onClick={() => run(() => setBookingOp(booking.id, 'da_fare'))}>Riapri</Button>
            : <>
                <Button disabled={busy} onClick={() => run(() => setBookingOp(booking.id, finish ? 'da_fare' : 'da_finire'))}>{finish ? 'Da fare' : 'Da finire'}</Button>
                <Button variant="primary" disabled={busy || !checksReady(booking)} onClick={() => run(() => setBookingOp(booking.id, 'fatto'))}>✓ Fatto</Button>
              </>}
        </div>
      )}
      {canOperate && !done && !checksReady(booking) && <small className="muted">Per segnare Fatto: Audio e Video devono essere OK oppure N.R.</small>}
      <ErrorText>{error}</ErrorText>
    </div>
  )
}

// Scheda della lista operativa (giorno di preparazione).
export function BookingCard({ item, ctx, onChanged }) {
  const canOperate = can(ctx.permissions, PERM.PLANNING_SALE_OPERATE)
  const canEdit = can(ctx.permissions, PERM.PLANNING_SALE_UPDATE)
  return (
    <article className="card stack" data-status={item.op_status}>
      <div className="row">
        <a className="title" href={`#/planning/sale/${item.id}`}>{item.room}</a>
        {canEdit && <a href={`#/planning/sale/edit/${item.id}`}>Modifica</a>}
      </div>
      <span>{item.client}</span>
      <small className="muted">{shiftLabel(item.shift)} · {item.layout || '—'} · {item.pax || '—'} PAX</small>
      <small className="accent-text">Evento: {range(item)}</small>
      {item.notes && <small>{item.notes}</small>}
      <BookingOps booking={item} canOperate={canOperate} onChanged={onChanged} />
    </article>
  )
}

export function PrepList({ ctx }) {
  const [anchor, setAnchor] = useState(todayIso)
  const [view, setView] = useState('giorno')
  const today = todayIso()
  const from = view === 'giorno' ? anchor : weekStartIso(anchor)
  const days = view === 'giorno' ? [anchor] : weekDaysIso(from)
  const { data, error, loading, reload } = useAsync(() => listBookings(ctx.hotelId, from), [ctx.hotelId, from])
  const step = view === 'giorno' ? 1 : 7
  const label = view === 'giorno' ? dayLabel(anchor) : `${dayLabel(days[0])} – ${dayLabel(days[6])}`

  return (
    <div className="stack">
      <p className="banner">Le sale compaiono nel giorno di <strong>preparazione</strong>. Le date dell'evento sono nel calendario in Planning Sale.</p>

      <Stats stats={prepStats(data || [], today)} />

      <div className="two">
        <button type="button" className="chip" aria-pressed={view === 'giorno'} onClick={() => setView('giorno')}>Giorno</button>
        <button type="button" className="chip" aria-pressed={view === 'settimana'} onClick={() => setView('settimana')}>Settimana</button>
      </div>
      <div className="row weeknav">
        <button type="button" className="chip" onClick={() => setAnchor(addDaysIso(anchor, -step))} aria-label="Precedente">←</button>
        <button type="button" className="chip" onClick={() => setAnchor(today)}>{label}</button>
        <button type="button" className="chip" onClick={() => setAnchor(addDaysIso(anchor, step))} aria-label="Successivo">→</button>
      </div>

      {loading && !data && <Spinner />}
      <ErrorText>{error}</ErrorText>
      {error && <Button onClick={reload}>Riprova</Button>}

      {days.map((d) => {
        const rows = bookingsToPrepare(data || [], d)
        return (
          <section key={d} className="stack" data-today={d === today || undefined}>
            <h2>{dayLabel(d)}{d === today ? ' · oggi' : ''}</h2>
            {rows.length
              ? <div className="list">{rows.map((b) => <BookingCard key={b.id} item={b} ctx={ctx} onChanged={reload} />)}</div>
              : <p className="muted">Nessuna sala da preparare.</p>}
          </section>
        )
      })}
    </div>
  )
}


// Planning Sale = calendario delle sale: mese, ogni giorno mostra quante sale sono occupate (conta la data dell'EVENTO).
export function SaleList({ ctx }) {
  const today = todayIso()
  const [month, setMonth] = useState(() => monthStartIso(today))
  const [day, setDay] = useState(today)
  const grid = monthGrid(month)
  const from = grid[0][0]
  const { data, error, loading, reload } = useAsync(() => listBookings(ctx.hotelId, from), [ctx.hotelId, from])
  const live = (data || []).filter((b) => b.status !== 'annullata')
  const on = (d) => live.filter((b) => eventOnDay(b, d)).sort((a, b) => a.room.localeCompare(b.room))
  const dayRows = on(day)
  const move = (n) => { const m = addMonthsIso(month, n); setMonth(m); setDay(m.slice(0, 7) === today.slice(0, 7) ? today : m) }

  return (
    <div className="page">
      <a href="#/planning">← Planning</a>
      <div className="row">
        <h1>Planning Sale</h1>
        {can(ctx.permissions, PERM.PLANNING_SALE_CREATE) && (
          <Button variant="primary" onClick={() => go('/planning/sale/new')}>+ Nuovo</Button>
        )}
      </div>
      <p className="muted">Calendario delle sale: tocca un giorno per vedere cosa c'è. La preparazione è in Planning Lavori → Sale da preparare.</p>

      <div className="row weeknav">
        <button type="button" className="chip" onClick={() => move(-1)} aria-label="Mese precedente">←</button>
        <button type="button" className="chip" onClick={() => { setMonth(monthStartIso(today)); setDay(today) }}>{monthLabel(month)}</button>
        <button type="button" className="chip" onClick={() => move(1)} aria-label="Mese successivo">→</button>
      </div>

      {loading && !data && <Spinner />}
      <ErrorText>{error}</ErrorText>
      {error && <Button onClick={reload}>Riprova</Button>}

      <div className="card monthcal" role="grid" aria-label={monthLabel(month)}>
        {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((h, i) => <span key={i} className="mc-head">{h}</span>)}
        {grid.flat().map((d) => {
          const n = on(d).length
          return (
            <button key={d} type="button" className="mc-day" aria-pressed={d === day}
              data-out={d.slice(0, 7) !== month.slice(0, 7) || undefined} data-today={d === today || undefined}
              onClick={() => setDay(d)} aria-label={`${dayLabel(d)}${n ? `, ${n} sale occupate` : ''}`}>
              <span>{Number(d.slice(8))}</span>
              {n > 0 && <b className="mc-count">{n}</b>}
            </button>
          )
        })}
      </div>

      <section className="stack">
        <h2>{dayLabel(day)}{day === today ? ' · oggi' : ''}</h2>
        {dayRows.length ? dayRows.map((b) => (
          <a key={b.id} className="card cal-event" href={`#/planning/sale/${b.id}`}>
            <span><b>{b.room}</b> · {shiftLabel(b.shift)}</span>
            <span>{b.client}{b.layout ? ` · ${b.layout}` : ''}{b.pax ? ` · ${b.pax} PAX` : ''}</span>
            {b.date_from !== b.date_to && <small className="muted">{range(b)}</small>}
          </a>
        )) : <p className="muted">Nessuna sala occupata.</p>}
      </section>
    </div>
  )
}

export function SaleDetail({ ctx, id }) {
  const { data: item, error, loading, reload } = useAsync(() => getBooking(ctx.hotelId, id), [ctx.hotelId, id])
  const { data: config } = useAsync(() => getSaleConfig(ctx.hotelId), [ctx.hotelId])
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const canUpdate = can(ctx.permissions, PERM.PLANNING_SALE_UPDATE)

  const change = async (status) => {
    setBusy(true)
    setActionError('')
    try {
      await updateBookingStatus(ctx.hotelId, id, status, config?.rooms || [])
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
        <div className="muted">{item.room} · {shiftLabel(item.shift)}{item.pax ? ` · ${item.pax} persone` : ''}</div>
        <div className="muted">
          Evento: {item.date_from === item.date_to ? dayLabel(item.date_from) : `${dayLabel(item.date_from)} → ${dayLabel(item.date_to)}`}
        </div>
        <div className="muted">Da preparare il {dayLabel(prepDay(item))}</div>
        {item.layout && <div className="muted">Allestimento: {item.layout}</div>}
        {item.notes && <p>{item.notes}</p>}
        {canUpdate && <a href={`#/planning/sale/edit/${item.id}`}>Modifica prenotazione</a>}
      </div>
      {item.status === 'attiva' && (
        <div className="card">
          <BookingOps booking={item} canOperate={can(ctx.permissions, PERM.PLANNING_SALE_OPERATE)} onChanged={reload} />
        </div>
      )}
      {canUpdate && (
        <div className="card stack">
          <h2>Prenotazione</h2>
          <div className="chips">
            {['attiva', 'annullata'].map((s) => (
              <button key={s} type="button" className="chip" aria-pressed={item.status === s}
                disabled={busy || item.status === s} onClick={() => change(s)}>{bookingStatusLabel(s)}</button>
            ))}
          </div>
          <ErrorText>{actionError}</ErrorText>
        </div>
      )}
    </div>
  )
}
