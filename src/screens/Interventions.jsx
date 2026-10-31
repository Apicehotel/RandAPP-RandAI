import { useState } from 'react'
import { listInterventions, getIntervention, updateInterventionStatus } from '../data/interventions.js'
import { useAsync, go } from '../lib/hooks.js'
import { can, PERM } from '../lib/permissions.js'
import {
  INTERVENTION_STATUSES, filterInterventions, sortInterventions, interventionStatusLabel,
} from '../lib/interventions.js'
import { Badge, Button, ErrorText, Spinner, formatDate } from '../ui/kit.jsx'

const FILTERS = [
  { id: 'aperti', label: 'Aperti' },
  { id: 'fatti', label: 'Fatti' },
  { id: 'tutti', label: 'Tutti' },
]

export const InterventionBadge = ({ status }) => (
  <Badge kind={status}>{interventionStatusLabel(status)}</Badge>
)

export function InterventionCard({ item }) {
  return (
    <a className="card issue" href={`#/interventions/${item.id}`}>
      <div className="row">
        <span className="title">{item.title}</span>
        <InterventionBadge status={item.status} />
      </div>
      <div className="row muted">
        <span>{item.location || 'Intervento'}</span>
        <span>{item.scheduled_at ? `Programmato ${formatDate(item.scheduled_at)}` : `Creato ${formatDate(item.created_at)}`}</span>
      </div>
    </a>
  )
}

export function InterventionList({ ctx }) {
  const [filter, setFilter] = useState('aperti')
  const { data, error, loading, reload } = useAsync(() => listInterventions(ctx.hotelId), [ctx.hotelId])
  const visible = sortInterventions(filterInterventions(data || [], filter))

  return (
    <div className="page">
      <div className="row">
        <h1>Interventi</h1>
        {can(ctx.permissions, PERM.INTERVENTIONS_CREATE) && (
          <Button variant="primary" onClick={() => go('/interventions/new')}>+ Intervento</Button>
        )}
      </div>

      <div className="chips" role="group" aria-label="Filtro interventi">
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
        {visible.map((item) => <InterventionCard key={item.id} item={item} />)}
        {data && visible.length === 0 && <div className="card muted">Nessun intervento in questo filtro.</div>}
      </div>
    </div>
  )
}

export function InterventionDetail({ ctx, id }) {
  const { data: item, error, loading, reload } = useAsync(() => getIntervention(ctx.hotelId, id), [ctx.hotelId, id])
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const canUpdate = can(ctx.permissions, PERM.INTERVENTIONS_UPDATE)

  const change = async (status) => {
    setBusy(true)
    setActionError('')
    try {
      await updateInterventionStatus(ctx.hotelId, id, status)
      await reload()
    } catch (e) {
      setActionError(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading && !item) return <Spinner />
  if (error) return <div className="page"><ErrorText>{error}</ErrorText></div>
  if (!item) return <div className="page"><p className="muted">Intervento non trovato.</p></div>

  return (
    <div className="page">
      <a href="#/interventions">← Interventi</a>
      <div className="card stack">
        <div className="row">
          <h1>{item.title}</h1>
          <InterventionBadge status={item.status} />
        </div>
        <div className="muted">
          {item.location ? `${item.location} · ` : ''}
          {item.scheduled_at ? `programmato ${formatDate(item.scheduled_at)}` : `creato ${formatDate(item.created_at)}`}
        </div>
        {item.notes && <p>{item.notes}</p>}
        {item.completed_at && <div className="muted">Fatto il {formatDate(item.completed_at)}</div>}
      </div>

      {canUpdate && (
        <div className="card stack">
          <h2>Cambia stato</h2>
          <div className="chips">
            {INTERVENTION_STATUSES.map((s) => (
              <button key={s.id} className="chip" aria-pressed={item.status === s.id}
                disabled={busy || item.status === s.id} onClick={() => change(s.id)}>
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
