import { listIssues } from '../data/issues.js'
import { listInterventions } from '../data/interventions.js'
import { useAsync } from '../lib/hooks.js'
import { can, PERM } from '../lib/permissions.js'
import { issueStats, workQueue } from '../lib/queue.js'
import { todayIso } from '../lib/planning.js'
import { interventionStats, filterInterventions, sortInterventions } from '../lib/interventions.js'
import { Spinner, ErrorText, UrgencyBadge, StatusBadge, formatDate } from '../ui/kit.jsx'
import { HubChoice } from '../ui/hub.jsx'
import { InterventionCard } from './Interventions.jsx'

// Hub "Operatività": due sezioni interne, Segnalazioni e Interventi, con le 3 più importanti di ciascuna.
export default function Operations({ ctx }) {
  const showIssues = can(ctx.permissions, PERM.ISSUES_VIEW)
  const showInterventions = can(ctx.permissions, PERM.INTERVENTIONS_VIEW)
  const { data, error, loading } = useAsync(async () => {
    const [issues, interventions] = await Promise.all([
      showIssues ? listIssues(ctx.hotelId) : Promise.resolve([]),
      showInterventions ? listInterventions(ctx.hotelId) : Promise.resolve([]),
    ])
    return { issues, interventions }
  }, [ctx.hotelId, showIssues, showInterventions])

  if (loading && !data) return <Spinner />
  if (error) return <div className="page"><ErrorText>{error}</ErrorText></div>

  const { issues, interventions } = data
  const today = todayIso()
  const stats = issueStats(issues, today)
  const topIssues = workQueue(issues, 3)
  const iStats = interventionStats(interventions, today)
  const topInterventions = sortInterventions(filterInterventions(interventions, 'aperti')).slice(0, 3)

  return (
    <div className="page">
      <div className="stack">
        <h1>Operatività</h1>
        <p className="muted">Segnalazioni e interventi.</p>
      </div>

      <div className="hub-grid">
        {showIssues && (
          <HubChoice href="#/issues" icon="alert" title="Segnalazioni"
            stats={[{ value: stats.open, label: 'Aperte' }, { value: stats.urgent, label: 'Urgenti', tone: 'warn' }, { value: stats.done, label: 'Fatte oggi', tone: 'ok' }]}
            newHref={can(ctx.permissions, PERM.ISSUES_CREATE) ? '#/issues/new' : null} newLabel="+ Nuova segnalazione" />
        )}

        {showInterventions && (
          <HubChoice href="#/interventions" icon="wrench" title="Interventi"
            stats={[{ value: iStats.open, label: 'Aperti' }, { value: iStats.running, label: 'In corso', tone: 'warn' }, { value: iStats.done, label: 'Fatti oggi', tone: 'ok' }]}
            newHref={can(ctx.permissions, PERM.INTERVENTIONS_CREATE) ? '#/interventions/new' : null} newLabel="+ Nuovo intervento" />
        )}
      </div>

      {showIssues && (
        <>
          <h2>Top 3 segnalazioni</h2>
          {topIssues.length === 0 ? (
            <div className="card muted">Nessuna segnalazione aperta.</div>
          ) : (
            <div className="list">
              {topIssues.map((issue) => (
                <a key={issue.id} className="card issue" href={`#/issues/${issue.id}`}>
                  <div className="row">
                    <span className="title">{issue.title}</span>
                    <UrgencyBadge urgency={issue.urgency} />
                  </div>
                  <div className="row muted">
                    <span>{issue.room ? `Camera/zona ${issue.room}` : issue.category}</span>
                    <span><StatusBadge status={issue.status} /> {formatDate(issue.created_at)}</span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </>
      )}

      {showInterventions && (
        <>
          <h2>Top 3 interventi</h2>
          {topInterventions.length === 0 ? (
            <div className="card muted">Nessun intervento aperto.</div>
          ) : (
            <div className="list">
              {topInterventions.map((item) => <InterventionCard key={item.id} item={item} />)}
            </div>
          )}
        </>
      )}
    </div>
  )
}
