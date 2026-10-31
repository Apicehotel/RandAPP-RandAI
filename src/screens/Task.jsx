import { listAlerts, listReminders } from '../data/task.js'
import { useAsync } from '../lib/hooks.js'
import { can, PERM } from '../lib/permissions.js'
import { filterAlerts, isForRole, sortAlerts, summarizeAlerts } from '../lib/task.js'
import { Icon, Spinner, ErrorText } from '../ui/kit.jsx'
import { AlertCard } from './TaskUrgent.jsx'
import { ReminderCard } from './TaskReminders.jsx'

// Hub "Task": due riquadri, Avvisi Urgenti e Promemoria, e sotto le cose da fare per prime.
export default function Task({ ctx }) {
  const showUrgent = can(ctx.permissions, PERM.URGENT_VIEW)
  const showReminders = can(ctx.permissions, PERM.REMINDERS_VIEW)
  const { data, error, loading } = useAsync(async () => {
    const [alerts, reminders] = await Promise.all([
      showUrgent ? listAlerts(ctx.hotelId) : Promise.resolve([]),
      showReminders ? listReminders(ctx.hotelId) : Promise.resolve([]),
    ])
    return { alerts, reminders }
  }, [ctx.hotelId, showUrgent, showReminders])

  if (loading && !data) return <Spinner />
  if (error) return <div className="page"><ErrorText>{error}</ErrorText></div>

  const { alerts, reminders } = data
  const aStats = summarizeAlerts(alerts)
  const openAlerts = sortAlerts(filterAlerts(alerts, 'aperti'))
  const mine = reminders.filter((r) => isForRole(r, ctx.role))
  const activeCount = reminders.filter((r) => r.active).length

  return (
    <div className="page">
      <div className="stack">
        <h1>Task</h1>
        <p className="muted">Avvisi urgenti e promemoria.</p>
      </div>

      <div className="hub-grid">
        {showUrgent && (
          <a className="card hub-choice" href="#/task/urgent">
            <span className="icon"><Icon name="alert" /></span>
            <strong>Avvisi Urgenti</strong>
            <span className="metrics">
              <span>{aStats.waiting} da prendere</span>
              <span>{aStats.taken} in carico</span>
            </span>
          </a>
        )}
        {showReminders && (
          <a className="card hub-choice" href="#/task/reminders">
            <span className="icon"><Icon name="clock" /></span>
            <strong>Promemoria</strong>
            <span className="metrics">
              <span>{mine.length} per me</span>
              <span>{activeCount} attivi</span>
            </span>
          </a>
        )}
      </div>

      {showUrgent && (
        <>
          <h2>Avvisi aperti</h2>
          {openAlerts.length === 0 ? (
            <div className="card muted">Nessun avviso aperto.</div>
          ) : (
            <div className="list">{openAlerts.slice(0, 3).map((a) => <AlertCard key={a.id} item={a} />)}</div>
          )}
        </>
      )}

      {showReminders && (
        <>
          <h2>Promemoria per me</h2>
          {mine.length === 0 ? (
            <div className="card muted">Nessun promemoria per il tuo ruolo.</div>
          ) : (
            <div className="list">{mine.slice(0, 3).map((r) => <ReminderCard key={r.id} item={r} />)}</div>
          )}
        </>
      )}
    </div>
  )
}
