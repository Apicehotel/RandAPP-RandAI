import { listIssues } from '../data/issues.js'
import { useAsync } from '../lib/hooks.js'
import { summarize, workQueue } from '../lib/queue.js'
import { Icon, Spinner, ErrorText, UrgencyBadge, StatusBadge, formatDate } from '../ui/kit.jsx'

// Hub "Operatività": porta alle segnalazioni e mostra le 3 più importanti.
// (Gli Interventi si aggiungeranno qui quando esisteranno.)
export default function Operations({ ctx }) {
  const { data, error, loading } = useAsync(() => listIssues(ctx.hotelId), [ctx.hotelId])

  if (loading && !data) return <Spinner />
  if (error) return <div className="page"><ErrorText>{error}</ErrorText></div>

  const issues = data || []
  const stats = summarize(issues)
  const top = workQueue(issues, 3)

  return (
    <div className="page">
      <div className="stack">
        <h1>Operatività</h1>
        <p className="muted">Segnalazioni adesso.</p>
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

      <h2>Top 3 segnalazioni</h2>
      {top.length === 0 ? (
        <div className="card muted">Nessuna segnalazione aperta.</div>
      ) : (
        <div className="list">
          {top.map((issue) => (
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
    </div>
  )
}
