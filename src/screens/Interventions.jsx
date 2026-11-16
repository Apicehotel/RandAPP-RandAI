import { useEffect, useState } from 'react'
import { listStaff } from '../data/forms.js'
import { staffNames } from '../lib/forms.js'
import { listInterventions, getIntervention, updateInterventionStatus, setInterventionRooms } from '../data/interventions.js'
import RoomsProgress from '../ui/RoomsProgress.jsx'
import { useAsync, go } from '../lib/hooks.js'
import { can, PERM } from '../lib/permissions.js'
import {
  INTERVENTION_STATUSES, filterInterventions, sortInterventions, interventionStatusLabel,
} from '../lib/interventions.js'
import { StatRow } from '../ui/hub.jsx'
import { interventionStats, roomsProgress, interventionPeople, interventionTimeline, interventionWhere } from '../lib/interventions.js'
import { todayIso } from '../lib/planning.js'
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
        <span>{interventionWhere(item) || 'Intervento'}</span>
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
          <Button variant="primary" onClick={() => go('/interventions/new')}>+ Nuovo</Button>
        )}
      </div>

      {data && (() => { const st = interventionStats(data, todayIso()); return <StatRow stats={[{ value: st.open, label: 'Aperti' }, { value: st.running, label: 'In corso', tone: 'warn' }, { value: st.done, label: 'Fatti oggi', tone: 'ok' }]} /> })()}

      <div className="chips" role="group" aria-label="Filtro interventi">
        {FILTERS.map((f) => (
          <button key={f.id} className="chip" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label}{data ? ` ${filterInterventions(data, f.id).length}` : ''}
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
  const [roomsDone, setRoomsDone] = useState(null) // mappa aggiornata dal server dopo ogni tocco
  const [confirming, setConfirming] = useState(false)
  const canUpdate = can(ctx.permissions, PERM.INTERVENTIONS_UPDATE)
  const { data: staff } = useAsync(() => listStaff(ctx.hotelId), [ctx.hotelId])

  useEffect(() => {
    if (!confirming) return undefined
    const t = setTimeout(() => setConfirming(false), 5000)
    return () => clearTimeout(t)
  }, [confirming])

  const run = async (fn) => {
    setBusy(true)
    setActionError('')
    try {
      await fn()
      await reload()
    } catch (e) {
      setActionError(e.message)
    } finally {
      setBusy(false)
    }
  }
  const change = (status) => run(() => updateInterventionStatus(ctx.hotelId, id, status, ctx.name))
  const toggleRooms = (rooms, done) => run(async () => { setRoomsDone(await setInterventionRooms(ctx.hotelId, id, rooms, done)) })

  if (loading && !item) return <Spinner />
  if (error) return <div className="page"><ErrorText>{error}</ErrorText></div>
  if (!item) return <div className="page"><p className="muted">Intervento non trovato.</p></div>

  const live = roomsDone ? { ...item, rooms_done: roomsDone } : item
  const progress = roomsProgress(live)
  const people = interventionPeople(item, staff)
  const timeline = interventionTimeline(live, progress, people)
  const assignees = staffNames(staff, item.assignee_ids)
  const isDone = item.status === 'fatto'
  const pending = progress.total - progress.done
  const where = interventionWhere(item)

  const primary = () => {
    if (isDone) return change('in_corso')
    if (pending > 0 && !confirming) return setConfirming(true)
    setConfirming(false)
    return change('fatto')
  }

  return (
    <div className="page detail">
      <div className="detail-head">
        <a href="#/interventions" className="detail-back">← Interventi</a>
        <div className="row">
          <h1>{item.title}</h1>
          <InterventionBadge status={item.status} />
        </div>
        <div className="muted">{[item.category, where].filter(Boolean).join(' · ')}</div>
      </div>

      <div className="card stack">
        {item.notes && <p>{item.notes}</p>}
        <dl className="facts">
          {item.scheduled_at && <><dt>Quando</dt><dd>{formatDate(item.scheduled_at)}{item.scheduled_until ? ` → ${formatDate(item.scheduled_until)}` : ''}</dd></>}
          {assignees.length > 0 && <><dt>Assegnato a</dt><dd>{assignees.join(', ')}</dd></>}
          {!assignees.length && item.assignee_ids?.length > 0 && <><dt>Assegnato a</dt><dd>{item.assignee_ids.length} persone</dd></>}
          {people.createdBy && <><dt>Creato da</dt><dd>{people.createdBy}</dd></>}
        </dl>
        {item.issue_id && <a href={`#/issues/${item.issue_id}`}>Vai alla segnalazione</a>}
      </div>

      {progress.total > 0 && <RoomsProgress progress={progress} busy={busy} onChange={canUpdate && !isDone ? toggleRooms : undefined} />}

      {timeline.length > 0 && (
        <div className="card stack" data-testid="intervention-timeline">
          <h2>Cronologia</h2>
          <ol className="timeline">
            {timeline.map((e) => (
              <li key={e.key}>
                <b>{e.label}</b>
                <span className="muted">
                  {[e.by, e.detail, e.at ? formatDate(e.at) : null].filter(Boolean).join(' · ')}{e.until ? ` → ${formatDate(e.until)}` : ''}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {canUpdate && (
        <div className="card stack">
          <h2>Stato</h2>
          <div className="chips">
            {INTERVENTION_STATUSES.map((s) => (
              <button key={s.id} className="chip" aria-pressed={item.status === s.id}
                disabled={busy || item.status === s.id} onClick={() => change(s.id)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <ErrorText>{actionError}</ErrorText>

      {canUpdate && (
        <div className="dock" data-testid="intervention-dock">
          <a className="btn" href="#/interventions">‹ Indietro</a>
          <Button variant="primary" disabled={busy} onClick={primary} data-testid="intervention-primary">
            {isDone ? 'Riapri' : confirming ? `Confermi? Mancano ${pending}` : 'Segna completato'}
          </Button>
        </div>
      )}
    </div>
  )
}
