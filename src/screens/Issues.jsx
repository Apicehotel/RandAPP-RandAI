import { useState } from 'react'
import { listIssues, getIssue, updateIssueStatus } from '../data/issues.js'
import { useAsync, go } from '../lib/hooks.js'
import { can, PERM } from '../lib/permissions.js'
import { STATUSES, filterByStatus, sortByPriority } from '../lib/queue.js'
import { Button, ErrorText, Spinner, UrgencyBadge, StatusBadge, formatDate } from '../ui/kit.jsx'

export function IssueList({ ctx }) {
  const [status, setStatus] = useState('da_fare')
  const { data, error, loading, reload } = useAsync(() => listIssues(ctx.hotelId), [ctx.hotelId])

  const visible = sortByPriority(filterByStatus(data || [], status))

  return (
    <div className="page">
      <div className="row">
        <h1>Segnalazioni</h1>
        {can(ctx.permissions, PERM.ISSUES_CREATE) && (
          <Button variant="primary" onClick={() => go('/issues/new')}>+ Segnalazione</Button>
        )}
      </div>

      <div className="chips" role="group" aria-label="Filtro stato">
        {[...STATUSES, { id: 'tutte', label: 'Tutte' }].map((s) => (
          <button key={s.id} className="chip" aria-pressed={status === s.id} onClick={() => setStatus(s.id)}>
            {s.label}
          </button>
        ))}
      </div>

      {loading && !data && <Spinner />}
      <ErrorText>{error}</ErrorText>
      {error && <Button onClick={reload}>Riprova</Button>}

      <div className="list">
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
        {data && visible.length === 0 && <div className="card muted">Nessuna segnalazione in questo stato.</div>}
      </div>
    </div>
  )
}

export function IssueDetail({ ctx, id }) {
  const { data: issue, error, loading, reload } = useAsync(() => getIssue(ctx.hotelId, id), [ctx.hotelId, id])
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const canUpdate = can(ctx.permissions, PERM.ISSUES_UPDATE)

  const change = async (status) => {
    setBusy(true)
    setActionError('')
    try {
      await updateIssueStatus(ctx.hotelId, id, status)
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
        </div>
        {issue.description && <p>{issue.description}</p>}
        <div><StatusBadge status={issue.status} /></div>
      </div>

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
