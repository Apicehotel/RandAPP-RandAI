import { listAlerts, listReminders } from '../data/task.js'
import { useAsync } from '../lib/hooks.js'
import { can, PERM } from '../lib/permissions.js'
import { alertStats, filterAlerts, isForRole, reminderStats, sortAlerts } from '../lib/task.js'
import { todayIso } from '../lib/planning.js'
import { Spinner, ErrorText } from '../ui/kit.jsx'
import { HubChoice } from '../ui/hub.jsx'
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
  const today = todayIso()
  const aStats = alertStats(alerts, today)
  const rStats = reminderStats(reminders, ctx.role, today)
  const openAlerts = sortAlerts(filterAlerts(alerts, 'aperti'))
  const mine = reminders.filter((r) => isForRole(r, ctx.role))

  return (
    <div className="page">
      <div className="stack">
        <h1>Task</h1>
        <p className="muted">Avvisi urgenti e promemoria.</p>
      </div>

      <div className="hub-grid">
        {showUrgent && (
          <HubChoice href="#/task/urgent" icon="alert" title="Avvisi Urgenti"
            stats={[{ value: aStats.waiting, label: 'Da prendere', tone: 'warn' }, { value: aStats.taken, label: 'In carico' }, { value: aStats.done, label: 'Risolti oggi', tone: 'ok' }]}
            newHref={can(ctx.permissions, PERM.URGENT_CREATE) ? '#/task/urgent/new' : null} newLabel="+ Nuovo avviso" />
        )}
        {showReminders && (
          <HubChoice href="#/task/reminders" icon="clock" title="Promemoria"
            stats={[{ value: rStats.mine, label: 'Per me' }, { value: rStats.active, label: 'Attivi' }, { value: rStats.today, label: 'Vigenti oggi', tone: 'ok' }]}
            newHref={can(ctx.permissions, PERM.REMINDERS_CREATE) ? '#/task/reminders/new' : null} newLabel="+ Nuovo promemoria" />
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
