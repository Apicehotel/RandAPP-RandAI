import { listWorks, listBookings } from '../data/planning.js'
import { useAsync } from '../lib/hooks.js'
import { can, PERM } from '../lib/permissions.js'
import { bookingsOnDay, dayLabel, todayIso, weekStartIso, worksInWeek, worksOnDay } from '../lib/planning.js'
import { Icon, Spinner, ErrorText } from '../ui/kit.jsx'
import { WorkCard } from './PlanningWork.jsx'
import { BookingCard } from './PlanningSale.jsx'

// Hub "Planning": due riquadri, Planning Sale e Planning Lavori, e sotto cosa c'è oggi.
export default function Planning({ ctx }) {
  const showWork = can(ctx.permissions, PERM.PLANNING_WORK_VIEW)
  const showSale = can(ctx.permissions, PERM.PLANNING_SALE_VIEW)
  const today = todayIso()
  const { data, error, loading } = useAsync(async () => {
    const [works, bookings] = await Promise.all([
      showWork ? listWorks(ctx.hotelId) : Promise.resolve([]),
      showSale ? listBookings(ctx.hotelId, today) : Promise.resolve([]),
    ])
    return { works, bookings }
  }, [ctx.hotelId, showWork, showSale, today])

  if (loading && !data) return <Spinner />
  if (error) return <div className="page"><ErrorText>{error}</ErrorText></div>

  const { works, bookings } = data
  const openWorks = works.filter((w) => w.status !== 'fatto')
  const todayWorks = worksOnDay(works, today)
  const todayBookings = bookingsOnDay(bookings, today)
  const weekWorks = worksInWeek(openWorks, weekStartIso(today)).length
  const upcoming = bookings.filter((b) => b.status === 'attiva' && b.date_from > today).length

  return (
    <div className="page">
      <div className="stack">
        <h1>Planning</h1>
        <p className="muted">Sale e lavori. Oggi è {dayLabel(today)}.</p>
      </div>

      <div className="hub-grid">
        {showSale && (
          <a className="card hub-choice" href="#/planning/sale">
            <span className="icon"><Icon name="building" /></span>
            <strong>Planning Sale</strong>
            <span className="metrics">
              <span>{todayBookings.length} oggi</span>
              <span>{upcoming} in arrivo</span>
            </span>
          </a>
        )}
        {showWork && (
          <a className="card hub-choice" href="#/planning/work">
            <span className="icon"><Icon name="wrench" /></span>
            <strong>Planning Lavori</strong>
            <span className="metrics">
              <span>{todayWorks.length} oggi</span>
              <span>{weekWorks} in settimana</span>
            </span>
          </a>
        )}
      </div>

      {showSale && (
        <>
          <h2>Sale oggi</h2>
          {todayBookings.length === 0 ? (
            <div className="card muted">Nessuna sala occupata oggi.</div>
          ) : (
            <div className="list">
              {todayBookings.slice(0, 3).map((b) => <BookingCard key={b.id} item={b} />)}
            </div>
          )}
        </>
      )}

      {showWork && (
        <>
          <h2>Lavori oggi</h2>
          {todayWorks.length === 0 ? (
            <div className="card muted">Nessun lavoro previsto oggi.</div>
          ) : (
            <div className="list">
              {todayWorks.slice(0, 3).map((w) => <WorkCard key={w.id} item={w} />)}
            </div>
          )}
        </>
      )}
    </div>
  )
}

