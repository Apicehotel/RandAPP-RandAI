import { useState } from 'react'
import { listWorkDays, listBookings } from '../data/planning.js'
import { useAsync } from '../lib/hooks.js'
import { can, PERM } from '../lib/permissions.js'
import {
  addDaysIso, dayLabel, dayStats, eventOnDay, prepStats, shiftLabel, shortDate, todayIso, weekDaysIso, weekStartIso,
  workDaysOn,
} from '../lib/planning.js'
import { Icon, Spinner, ErrorText } from '../ui/kit.jsx'

function Choice({ href, icon, title, stats }) {
  return (
    <a className="card hub-choice" href={href}>
      <span className="icon"><Icon name={icon} /></span>
      <strong>{title}</strong>
      <span className="stats3 mini">
        <span><b>{stats.today}</b><small>Oggi</small></span>
        <span><b className="warn-text">{stats.finish}</b><small>Da finire</small></span>
        <span><b className="ok-text">{stats.done}</b><small>Fatti</small></span>
      </span>
    </a>
  )
}

// Calendario sale: quando sono occupate (conta la data dell'EVENTO).
function SaleCalendar({ bookings, anchor, onAnchor }) {
  const start = weekStartIso(anchor)
  const days = weekDaysIso(start)
  const today = todayIso()
  return (
    <div className="card stack">
      <div className="row">
        <strong>Calendario sale</strong>
        <button type="button" className="chip" onClick={() => onAnchor(today)}>Oggi</button>
      </div>
      <p className="muted">Quando le sale sono occupate: qui conta la data dell'evento.</p>
      <div className="row weeknav">
        <button type="button" className="chip" onClick={() => onAnchor(addDaysIso(start, -7))} aria-label="Settimana precedente">←</button>
        <span>{shortDate(days[0])} – {shortDate(days[6])}</span>
        <button type="button" className="chip" onClick={() => onAnchor(addDaysIso(start, 7))} aria-label="Settimana successiva">→</button>
      </div>
      {days.map((d) => {
        const rows = (bookings || []).filter((b) => eventOnDay(b, d))
        return (
          <div key={d} className="cal-day" data-today={d === today || undefined}>
            <strong>{dayLabel(d)}</strong>
            {rows.length ? rows.map((b) => (
              <a key={`${b.id}-${d}`} className="cal-event" href={`#/planning/sale/${b.id}`}>
                <span><b>{b.room}</b> · {shiftLabel(b.shift)}</span>
                <span>{b.client}{b.layout ? ` · ${b.layout}` : ''}{b.pax ? ` · ${b.pax} PAX` : ''}</span>
              </a>
            )) : <span className="muted">Nessuna sala occupata.</span>}
          </div>
        )
      })}
    </div>
  )
}

// Hub "Planning": riepilogo con statistiche, cosa c'è oggi e calendario sale.
export default function Planning({ ctx }) {
  const showWork = can(ctx.permissions, PERM.PLANNING_WORK_VIEW)
  const showSale = can(ctx.permissions, PERM.PLANNING_SALE_VIEW)
  const today = todayIso()
  const [anchor, setAnchor] = useState(today)
  const from = weekStartIso(anchor) < today ? weekStartIso(anchor) : today
  const { data, error, loading } = useAsync(async () => {
    const [days, bookings] = await Promise.all([
      showWork ? listWorkDays(ctx.hotelId, { from: today, to: today }) : Promise.resolve([]),
      showSale ? listBookings(ctx.hotelId, from) : Promise.resolve([]),
    ])
    return { days, bookings }
  }, [ctx.hotelId, showWork, showSale, today, from])

  if (loading && !data) return <Spinner />
  if (error) return <div className="page"><ErrorText>{error}</ErrorText></div>

  const { days, bookings } = data
  const workToday = workDaysOn(days, today)
  const saleToday = bookings.filter((b) => eventOnDay(b, today))

  return (
    <div className="page">
      <div className="stack">
        <h1>Planning</h1>
        <p className="muted">Lavori, sale e attività di oggi · {dayLabel(today)}.</p>
      </div>

      <div className="hub-grid">
        {showWork && <Choice href="#/planning/work" icon="wrench" title="Planning Lavori" stats={dayStats(days, today)} />}
        {showSale && <Choice href="#/planning/sale" icon="building" title="Planning Sale" stats={prepStats(bookings, today)} />}
      </div>

      {(workToday.length > 0 || saleToday.length > 0) && (
        <div className="card stack">
          <strong>Oggi · panoramica operativa</strong>
          {showWork && <div className="row"><span>{workToday.length ? `${workToday.length} lavori nel planning` : 'Nessun lavoro previsto'}</span><b>{workToday.length}</b></div>}
          {showSale && <div className="row"><span>{saleToday.length ? `${saleToday.length} sale/attività in corso` : 'Nessuna sala occupata'}</span><b>{saleToday.length}</b></div>}
        </div>
      )}

      {showSale && <SaleCalendar bookings={bookings} anchor={anchor} onAnchor={setAnchor} />}
    </div>
  )
}
