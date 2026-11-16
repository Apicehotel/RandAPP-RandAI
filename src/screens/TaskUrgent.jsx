import { useState } from 'react'
import { listAlerts, getAlert, updateAlertStatus } from '../data/task.js'
import { createIssue } from '../data/issues.js'
import { applyPendingAlerts, issueFromAlert } from '../lib/urgent.js'
import { useAsync, go, usePending } from '../lib/hooks.js'
import { can, PERM } from '../lib/permissions.js'
import { ALERT_STATUSES, agoLabel, alertStatusLabel, filterAlerts, sortAlerts } from '../lib/task.js'
import { StatRow } from '../ui/hub.jsx'
import { alertStats } from '../lib/task.js'
import { todayIso } from '../lib/planning.js'
import { Badge, Button, ErrorText, Spinner, formatDate } from '../ui/kit.jsx'

const FILTERS = [
  { id: 'aperti', label: 'Aperti' },
  { id: 'risolti', label: 'Risolti' },
  { id: 'tutti', label: 'Tutti' },
]

export function AlertCard({ item }) {
  return (
    <a className="card issue" href={`#/task/urgent/${item.id}`}>
      <div className="row">
        <span className="title">{item.note}</span>
        <Badge kind={item.status}>{alertStatusLabel(item.status)}</Badge>
      </div>
      <div className="row muted">
        <span>{agoLabel(item.created_at)}</span>
        <span>{formatDate(item.created_at)}</span>
      </div>
    </a>
  )
}

export function AlertList({ ctx }) {
  const [filter, setFilter] = useState('aperti')
  const { data, error, loading, reload } = useAsync(() => listAlerts(ctx.hotelId), [ctx.hotelId])
  const pend = usePending(ctx)
  const visible = sortAlerts(filterAlerts(applyPendingAlerts(data || [], pend), filter))

  return (
    <div className="page">
      <a href="#/task">← Task</a>
      <div className="row">
        <h1>Avvisi Urgenti</h1>
        {can(ctx.permissions, PERM.URGENT_CREATE) && (
          <Button variant="primary" onClick={() => go('/task/urgent/new')}>+ Nuovo</Button>
        )}
      </div>

      {data && (() => { const st = alertStats(applyPendingAlerts(data, pend), todayIso()); return <StatRow stats={[{ value: st.waiting, label: 'Da prendere', tone: 'warn' }, { value: st.taken, label: 'In carico' }, { value: st.done, label: 'Risolti oggi', tone: 'ok' }]} /> })()}

      <div className="chips" role="group" aria-label="Filtro avvisi">
        {FILTERS.map((f) => (
          <button key={f.id} className="chip" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>

      {loading && !data && <Spinner />}
      <ErrorText>{error}</ErrorText>
      {error && <Button onClick={reload}>Riprova</Button>}

      <div className="list">
        {visible.map((a) => <AlertCard key={a.id} item={a} />)}
        {data && visible.length === 0 && <div className="card muted">Nessun avviso in questo filtro.</div>}
      </div>
    </div>
  )
}

export function AlertDetail({ ctx, id }) {
  const { data: loaded, error, loading, reload } = useAsync(() => getAlert(ctx.hotelId, id), [ctx.hotelId, id])
  const pend = usePending(ctx)
  const item = loaded ? applyPendingAlerts([loaded], pend)[0] : loaded
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const canUpdate = can(ctx.permissions, PERM.URGENT_UPDATE)

  const change = async (status) => {
    setBusy(true)
    setActionError('')
    try {
      const r = await updateAlertStatus(ctx.hotelId, ctx.userId, id, status)
      if (!r?.pending) await reload()
    } catch (e) {
      setActionError(e.message)
    } finally {
      setBusy(false)
    }
  }

  // Dall'avviso nasce una segnalazione normale (alta urgenza, categoria Altro): l'avviso resta com'è.
  const toIssue = async () => {
    setBusy(true); setActionError(''); setInfo('')
    try {
      const issue = await createIssue(ctx.hotelId, ctx.userId, issueFromAlert(item))
      if (issue.pending) setInfo('Segnalazione salvata sul telefono: verrà inviata da sola appena torna la rete.')
      else go(`/issues/${issue.id}`)
    } catch (e) { setActionError(e.message) } finally { setBusy(false) }
  }

  if (loading && !item) return <Spinner />
  if (error) return <div className="page"><ErrorText>{error}</ErrorText></div>
  if (!item) return <div className="page"><p className="muted">Avviso non trovato.</p></div>

  return (
    <div className="page">
      <a href="#/task/urgent">← Avvisi Urgenti</a>
      <div className="card stack">
        <div className="row">
          <h1>{item.note}</h1>
          <Badge kind={item.status}>{alertStatusLabel(item.status)}</Badge>
        </div>
        <div className="muted">Inviato {formatDate(item.created_at)} ({agoLabel(item.created_at)})</div>
        {item.taken_at && <div className="muted">Preso in carico {formatDate(item.taken_at)}</div>}
        {item.resolved_at && <div className="muted">Risolto {formatDate(item.resolved_at)}</div>}
      </div>

      {canUpdate && (
        <div className="card stack">
          <h2>Cambia stato</h2>
          <div className="chips">
            {ALERT_STATUSES.map((s) => (
              <button key={s.id} className="chip" aria-pressed={item.status === s.id}
                disabled={busy || item.status === s.id} onClick={() => change(s.id)}>
                {s.label}
              </button>
            ))}
          </div>
          <ErrorText>{actionError}</ErrorText>
        </div>
      )}

      {can(ctx.permissions, PERM.ISSUES_CREATE) && (
        <div className="card stack">
          <h2>Segnalazione</h2>
          <p className="muted">Crea una segnalazione con il testo di questo avviso, per seguirla come un guasto.</p>
          <Button disabled={busy} onClick={toIssue}>Trasforma in segnalazione</Button>
          {info && <p className="muted">{info}</p>}
        </div>
      )}
    </div>
  )
}
