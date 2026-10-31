import { listIssues } from '../data/issues.js'
import { useAsync } from '../lib/hooks.js'
import { summarize, workQueue } from '../lib/queue.js'
import { Spinner, ErrorText, Icon, UrgencyBadge, StatusBadge, formatDate } from '../ui/kit.jsx'

// Home = coda di lavoro ordinata per priorità. Nessun pulsante "Nuova": si crea dalle Segnalazioni.
export default function Home({ ctx }) {
  const { data, error, loading } = useAsync(() => listIssues(ctx.hotelId), [ctx.hotelId])

  if (loading && !data) return <Spinner />
  if (error) return <div className="page"><ErrorText>{error}</ErrorText></div>

  const issues = data || []
  const stats = summarize(issues)
  const queue = workQueue(issues, 10)

  return (
    <div className="page">
      <h1>Home</h1>
      <div className="kpis">
        <div className="card kpi"><span className="icon"><Icon name="list" /></span>
          <div><div className="num">{stats.open}</div><div className="muted">Aperte</div></div></div>
        <div className="card kpi"><span className="icon danger"><Icon name="alert" /></span>
          <div><div className="num">{stats.urgent}</div><div className="muted">Urgenti</div></div></div>
        <div className="card kpi"><span className="icon warn"><Icon name="box" /></span>
          <div><div className="num">{stats.waitingPart}</div><div className="muted">Attesa pezzo</div></div></div>
        <div className="card kpi"><span className="icon ok"><Icon name="wrench" /></span>
          <div><div className="num">{stats.withTechnician}</div><div className="muted">Con tecnico</div></div></div>
      </div>

      <h2>Da fare adesso</h2>
      {queue.length === 0 ? (
        <div className="card muted">Nessuna segnalazione aperta.</div>
      ) : (
        <div className="list">
          {queue.map((issue) => (
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
