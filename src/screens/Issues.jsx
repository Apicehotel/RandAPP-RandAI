import { useState } from 'react'
import { listIssues, getIssue, updateIssueStatus, listIssuePhotos } from '../data/issues.js'
import { listInterventionsForIssue } from '../data/interventions.js'
import SimilarCases from '../ui/SimilarCases.jsx'
import { queryFrom } from '../lib/ai.js'
import { useAsync, go, usePending } from '../lib/hooks.js'
import { can, PERM } from '../lib/permissions.js'
import { STATUSES, filterByStatus, sortByPriority } from '../lib/queue.js'
import { StatRow } from '../ui/hub.jsx'
import { issueStats } from '../lib/queue.js'
import { todayIso } from '../lib/planning.js'
import { Badge, Button, ErrorText, Spinner, UrgencyBadge, StatusBadge, formatDate } from '../ui/kit.jsx'

export function IssueList({ ctx }) {
  const [status, setStatus] = useState('da_fare')
  const { data, error, loading, reload } = useAsync(() => listIssues(ctx.hotelId), [ctx.hotelId])

  const visible = sortByPriority(filterByStatus(data || [], status))
  // Segnalazioni scritte senza rete e non ancora arrivate al server (nuove, quindi «da fare»).
  const waiting = usePending(ctx).filter((e) => e.kind === 'issue.create' && e.hotelId === ctx.hotelId && e.status === 'pending')
    .map((e) => e.payload.row).filter(() => status === 'da_fare' || status === 'tutte')

  return (
    <div className="page">
      <div className="row">
        <h1>Segnalazioni</h1>
        {can(ctx.permissions, PERM.ISSUES_CREATE) && (
          <Button variant="primary" onClick={() => go('/issues/new')}>+ Nuova</Button>
        )}
      </div>

      {data && (() => { const st = issueStats(data, todayIso()); return <StatRow stats={[{ value: st.open, label: 'Aperte' }, { value: st.urgent, label: 'Urgenti', tone: 'warn' }, { value: st.done, label: 'Fatte oggi', tone: 'ok' }]} /> })()}

      <div className="chips" role="group" aria-label="Filtro stato">
        {[...STATUSES, { id: 'tutte', label: 'Tutte' }].map((s) => (
          <button key={s.id} className="chip" aria-pressed={status === s.id} onClick={() => setStatus(s.id)}>
            {s.label}{data ? ` ${filterByStatus(data, s.id).length}` : ''}
          </button>
        ))}
      </div>

      {loading && !data && <Spinner />}
      <ErrorText>{error}</ErrorText>
      {error && <Button onClick={reload}>Riprova</Button>}

      <div className="list">
        {waiting.map((row) => (
          <div key={row.id} className="card issue">
            <div className="row">
              <span className="title">{row.title}</span>
              <UrgencyBadge urgency={row.urgency} />
            </div>
            <div className="row muted">
              <span>{row.room ? `Camera/zona ${row.room} · ` : ''}{row.category}</span>
              <Badge kind="in_corso">In attesa di invio</Badge>
            </div>
          </div>
        ))}
        {visible.map((issue) => (
          <a key={issue.id} className="card issue" href={`#/issues/${issue.id}`}>
            <div className="row">
              <span className="title">{issue.title}</span>
              <UrgencyBadge urgency={issue.urgency} />
            </div>
            <div className="row muted">
              <span>{issue.room ? `Camera/zona ${issue.room} · ` : ''}{issue.category}</span>
              <span><StatusBadge status={issue.status} /> {formatDate(issue.created_at)}</span>
            </div>
          </a>
        ))}
        {data && visible.length === 0 && waiting.length === 0 && <div className="card muted">Nessuna segnalazione in questo stato.</div>}
      </div>
    </div>
  )
}

export function IssueDetail({ ctx, id }) {
  const { data: issue, error, loading, reload } = useAsync(() => getIssue(ctx.hotelId, id), [ctx.hotelId, id])
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const canUpdate = can(ctx.permissions, PERM.ISSUES_UPDATE)
  const canMakeIntervention = can(ctx.permissions, PERM.INTERVENTIONS_CREATE)
  const { data: linked } = useAsync(() => listInterventionsForIssue(ctx.hotelId, id), [ctx.hotelId, id])
  const { data: photos } = useAsync(() => listIssuePhotos(ctx.hotelId, id), [ctx.hotelId, id])

  const change = async (status) => {
    setBusy(true)
    setActionError('')
    try {
      await updateIssueStatus(ctx.hotelId, id, status, ctx.name)
      await reload()
    } catch (e) {
      setActionError(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading && !issue) return <Spinner />
  if (error) return <div className="page"><ErrorText>{error}</ErrorText></div>
  if (!issue) return <div className="page"><p className="muted">Segnalazione non trovata.</p></div>

  return (
    <div className="page">
      <a href="#/issues">← Segnalazioni</a>
      <div className="card stack">
        <div className="row">
          <h1>{issue.title}</h1>
          <UrgencyBadge urgency={issue.urgency} />
        </div>
        <div className="muted">
          {issue.room ? `Camera/zona ${issue.room} · ` : ''}{issue.category} · aperta il {formatDate(issue.created_at)}
          {issue.created_by_name ? ` da ${issue.created_by_name}` : ''}
        </div>
        {issue.description && <p>{issue.description}</p>}
        <div><StatusBadge status={issue.status} /></div>
      </div>

      {issue.status !== 'completata' && <SimilarCases ctx={ctx} query={queryFrom(issue)} exclude={issue.id} />}

      {(issue.completion_note || issue.technician_name || issue.part_replaced || (issue.completed_at && issue.completed_by_name)) && (
        <div className="card stack">
          <h2>Intervento</h2>
          {issue.completed_at && (
            <div className="muted">Chiusa il {formatDate(issue.completed_at)}{issue.completed_by_name ? ` da ${issue.completed_by_name}` : ''}</div>
          )}
          {issue.technician_name && <div>Tecnico: {issue.technician_name}</div>}
          {issue.part_replaced && <div>Pezzo sostituito: {issue.part_replaced}</div>}
          {issue.completion_note && <p>{issue.completion_note}</p>}
        </div>
      )}

      {photos && photos.length > 0 && (
        <div className="card stack">
          <h2>Foto</h2>
          {['prima', 'dopo'].map((kind) => photos.filter((f) => f.kind === kind).map((f) => (
            <figure key={f.id} className="stack">
              <img src={f.data_url} alt={kind === 'prima' ? 'Foto del problema' : 'Foto dopo l\'intervento'} loading="lazy" style={{ maxWidth: '100%', borderRadius: 8 }} />
              <figcaption className="muted">{kind === 'prima' ? 'Prima' : 'Dopo'}</figcaption>
            </figure>
          )))}
        </div>
      )}

      {((linked && linked.length > 0) || (canMakeIntervention && issue.status !== 'completata')) && (
        <div className="card stack">
          <h2>Interventi collegati</h2>
          {(linked || []).map((i) => (
            <a key={i.id} href={`#/interventions/${i.id}`}>{i.title} · {i.status.replace('_', ' ')}</a>
          ))}
          {canMakeIntervention && issue.status !== 'completata' && (
            <Button onClick={() => go(`/interventions/new/${issue.id}`)}>+ Crea intervento da questa segnalazione</Button>
          )}
        </div>
      )}

      {canUpdate && (
        <div className="card stack">
          <h2>Cambia stato</h2>
          <div className="chips">
            {STATUSES.map((s) => (
              <button key={s.id} className="chip" aria-pressed={issue.status === s.id}
                disabled={busy || issue.status === s.id} onClick={() => change(s.id)}>
                {s.label}
              </button>
            ))}
          </div>
          <ErrorText>{actionError}</ErrorText>
        </div>
      )}
    </div>
  )
}
