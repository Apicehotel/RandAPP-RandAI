import { listWorkDays, listBookings } from '../data/planning.js'
import { useAsync } from '../lib/hooks.js'
import { can, PERM } from '../lib/permissions.js'
import {
  addDaysIso, dayLabel, dayStats, eventOnDay, prepStats, shiftLabel, shortDate, todayIso, weekDaysIso, weekStartIso,
  workDaysOn,
} from '../lib/planning.js'
import { Icon, Spinner, ErrorText } from '../ui/kit.jsx'

function Choice({ href, icon, title, stats, newHref, newLabel }) {
  return (
    <div className="card hub-choice">
      <a className="hub-link" href={href}>
      <span className="icon"><Icon name={icon} /></span>
      <strong>{title}</strong>
      <span className="stats3 mini">
        <span><b>{stats.today}</b><small>Oggi</small></span>
        <span><b className="warn-text">{stats.finish}</b><small>Da finire</small></span>
        <span><b className="ok-text">{stats.done}</b><small>Fatti</small></span>
      </span>
      </a>
      {newHref && <a className="btn primary block" href={newHref}>{newLabel}</a>}
    </div>
  )
}

// Hub "Planning": riepilogo con statistiche, cosa c'è oggi e calendario sale.
export default function Planning({ ctx }) {
  const showWork = can(ctx.permissions, PERM.PLANNING_WORK_VIEW)
  const showSale = can(ctx.permissions, PERM.PLANNING_SALE_VIEW)
  const today = todayIso()
  const from = today
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
        {showWork && <Choice href="#/planning/work" icon="wrench" title="Planning Lavori" stats={dayStats(days, today)}
          newHref={can(ctx.permissions, PERM.PLANNING_WORK_CREATE) ? '#/planning/work/new' : null} newLabel="+ Nuovo lavoro" />}
        {showSale && <Choice href="#/planning/sale" icon="building" title="Planning Sale" stats={prepStats(bookings, today)}
          newHref={can(ctx.permissions, PERM.PLANNING_SALE_CREATE) ? '#/planning/sale/new' : null} newLabel="+ Nuova prenotazione" />}
      </div>

      {(workToday.length > 0 || saleToday.length > 0) && (
        <div className="card stack">
          <strong>Oggi · panoramica operativa</strong>
          {showWork && <div className="row"><span>{workToday.length ? `${workToday.length} lavori nel planning` : 'Nessun lavoro previsto'}</span><b>{workToday.length}</b></div>}
          {showSale && <div className="row"><span>{saleToday.length ? `${saleToday.length} sale/attività in corso` : 'Nessuna sala occupata'}</span><b>{saleToday.length}</b></div>}
        </div>
      )}

    </div>
  )
}
