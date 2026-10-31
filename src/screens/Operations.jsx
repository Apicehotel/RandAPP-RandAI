import { listIssues } from '../data/issues.js'
import { listInterventions } from '../data/interventions.js'
import { useAsync } from '../lib/hooks.js'
import { can, PERM } from '../lib/permissions.js'
import { summarize, workQueue } from '../lib/queue.js'
import { summarizeInterventions, filterInterventions, sortInterventions } from '../lib/interventions.js'
import { Icon, Spinner, ErrorText, UrgencyBadge, StatusBadge, formatDate } from '../ui/kit.jsx'
import { InterventionCard } from './Interventions.jsx'

// Hub "Operatività": due sezioni interne, Segnalazioni e Interventi, con le 3 più importanti di ciascuna.
export default function Operations({ ctx }) {
  const showInterventions = can(ctx.permissions, PERM.INTERVENTIONS_VIEW)
  const { data, error, loading } = useAsync(async () => {
    const [issues, interventions] = await Promise.all([
      listIssues(ctx.hotelId),
      showInterventions ? listInterventions(ctx.hotelId) : Promise.resolve([]),
    ])
    return { issues, interventions }
  }, [ctx.hotelId, showInterventions])

  if (loading && !data) return <Spinner />
  if (error) return <div className="page"><ErrorText>{error}</ErrorText></div>

  const { issues, interventions } = data
  const stats = summarize(issues)
  const topIssues = workQueue(issues, 3)
  const iStats = summarizeInterventions(interventions)
  const topInterventions = sortInterventions(filterInterventions(interventions, 'aperti')).slice(0, 3)

  return (
    <div className="page">
      <div className="stack">
        <h1>Operatività</h1>
        <p className="muted">Segnalazioni e interventi.</p>
      </div>

      <a className="card hub-choice" href="#/issues">
        <span className="icon"><Icon name="alert" /></span>
        <span className="body">
          <strong>Segnalazioni</strong>
          <span className="metrics">
            <span>{stats.open} aperte</span>
            <span>{stats.urgent} urgenti</span>
          </span>
        </span>
      </a>

      {showInterventions && (
        <a className="card hub-choice" href="#/interventions">
          <span className="icon"><Icon name="wrench" /></span>
          <span className="body">
            <strong>Interventi</strong>
            <span className="metrics">
              <span>{iStats.open} aperti</span>
              <span>{iStats.running} in corso</span>
            </span>
          </span>
        </a>
      )}

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
