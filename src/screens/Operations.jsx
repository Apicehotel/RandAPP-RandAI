import IssueThumb from '../ui/IssueThumb.jsx'
import ItemCard from '../ui/ItemCard.jsx'
import { listIssues } from '../data/issues.js'
import { listInterventions } from '../data/interventions.js'
import { listTechnicians } from '../data/technicians.js'
import { useAsync } from '../lib/hooks.js'
import { can, PERM } from '../lib/permissions.js'
import { issueStats, workQueue } from '../lib/queue.js'
import { todayIso } from '../lib/planning.js'
import { interventionStats, filterInterventions, sortInterventions } from '../lib/interventions.js'
import { Spinner, ErrorText, UrgencyBadge, StatusBadge, formatDate } from '../ui/kit.jsx'
import { HubChoice } from '../ui/hub.jsx'
import { InterventionCard } from './Interventions.jsx'

// Hub "Operatività": Segnalazioni, Interventi e Tecnici, con le 3 più importanti di ciascuna (e i tecnici attivi).
export default function Operations({ ctx }) {
  const showIssues = can(ctx.permissions, PERM.ISSUES_VIEW)
  const showInterventions = can(ctx.permissions, PERM.INTERVENTIONS_VIEW)
  const showTechnicians = can(ctx.permissions, PERM.TECHNICIANS_VIEW)
  const { data, error, loading } = useAsync(async () => {
    const [issues, interventions, technicians] = await Promise.all([
      showIssues ? listIssues(ctx.hotelId) : Promise.resolve([]),
      showInterventions ? listInterventions(ctx.hotelId) : Promise.resolve([]),
      // I tecnici sono un di più: se non si caricano, il resto dell'hub resta utilizzabile.
      showTechnicians ? listTechnicians(ctx.hotelId).catch(() => []) : Promise.resolve([]),
    ])
    return { issues, interventions, technicians }
  }, [ctx.hotelId, showIssues, showInterventions, showTechnicians])

  if (loading && !data) return <Spinner />
  if (error) return <div className="page"><ErrorText>{error}</ErrorText></div>

  const { issues, interventions, technicians } = data
  const activeTechs = technicians.filter((t) => t.active)
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

        {showTechnicians && (
          <HubChoice href="#/technicians" icon="user" title="Tecnici"
            stats={[{ value: activeTechs.length, label: 'Attivi' }, { value: technicians.length, label: 'In elenco' }]}
            newHref={can(ctx.permissions, PERM.TECHNICIANS_MANAGE) ? '#/technicians' : null} newLabel="Gestisci tecnici" />
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
                <ItemCard key={issue.id} href={`#/issues/${issue.id}`} title={issue.title}
                  badge={<UrgencyBadge urgency={issue.urgency} />}
                  where={issue.room ? `Camera/zona ${issue.room}` : issue.category}
                  meta={<><StatusBadge status={issue.status} /> {formatDate(issue.created_at)}</>}
                  thumb={issue.photo_count > 0 ? <IssueThumb hotelId={ctx.hotelId} issueId={issue.id} /> : null} />
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

      {showTechnicians && activeTechs.length > 0 && (
        <>
          <h2>Tecnici</h2>
          <div className="list">
            {activeTechs.slice(0, 5).map((t) => (
              <div key={t.id} className="card row">
                <span><strong>{t.name}</strong>{t.company && t.company !== t.name ? <span className="muted"> · {t.company}</span> : null}</span>
                <a className="btn" href={`https://wa.me/${t.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
