import { useState } from 'react'
import { listWorks, getWork, updateWorkStatus } from '../data/planning.js'
import { useAsync, go } from '../lib/hooks.js'
import { can, PERM } from '../lib/permissions.js'
import {
  WORK_STATUSES, addDaysIso, dayLabel, shortDate, todayIso, weekDaysIso, weekStartIso, workStatusLabel, worksOnDay,
} from '../lib/planning.js'
import { Badge, Button, ErrorText, Spinner } from '../ui/kit.jsx'

export function WorkCard({ item }) {
  return (
    <a className="card issue" href={`#/planning/work/${item.id}`}>
      <div className="row">
        <span className="title">{item.description}</span>
        <Badge kind={item.status}>{workStatusLabel(item.status)}</Badge>
      </div>
      <div className="row muted">
        <span>{item.days.map(shortDate).join(', ')}</span>
      </div>
    </a>
  )
}

export function WeekNav({ start, onChange }) {
  const end = addDaysIso(start, 6)
  return (
    <div className="row weeknav">
      <button className="chip" onClick={() => onChange(addDaysIso(start, -7))} aria-label="Settimana precedente">←</button>
      <button className="chip" onClick={() => onChange(weekStartIso(todayIso()))}>
        {shortDate(start)} – {shortDate(end)}
      </button>
      <button className="chip" onClick={() => onChange(addDaysIso(start, 7))} aria-label="Settimana successiva">→</button>
    </div>
  )
}

export function WorkList({ ctx }) {
  const [start, setStart] = useState(() => weekStartIso(todayIso()))
  const { data, error, loading, reload } = useAsync(() => listWorks(ctx.hotelId), [ctx.hotelId])
  const days = weekDaysIso(start)
  const today = todayIso()
  const groups = days.map((d) => ({ day: d, items: worksOnDay(data || [], d) })).filter((g) => g.items.length)

  return (
    <div className="page">
      <a href="#/planning">← Planning</a>
      <div className="row">
        <h1>Planning Lavori</h1>
        {can(ctx.permissions, PERM.PLANNING_WORK_CREATE) && (
          <Button variant="primary" onClick={() => go('/planning/work/new')}>+ Lavoro</Button>
        )}
      </div>

      <WeekNav start={start} onChange={setStart} />

      {loading && !data && <Spinner />}
      <ErrorText>{error}</ErrorText>
      {error && <Button onClick={reload}>Riprova</Button>}

      {groups.map((g) => (
        <section key={g.day} className="stack">
          <h2>{dayLabel(g.day)}{g.day === today ? ' · oggi' : ''}</h2>
          <div className="list">
            {g.items.map((w) => <WorkCard key={`${g.day}-${w.id}`} item={w} />)}
          </div>
        </section>
      ))}
      {data && groups.length === 0 && <div className="card muted">Nessun lavoro in questa settimana.</div>}
    </div>
  )
}

export function WorkDetail({ ctx, id }) {
  const { data: item, error, loading, reload } = useAsync(() => getWork(ctx.hotelId, id), [ctx.hotelId, id])
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const canUpdate = can(ctx.permissions, PERM.PLANNING_WORK_UPDATE)

  const change = async (status) => {
    setBusy(true)
    setActionError('')
    try {
      await updateWorkStatus(ctx.hotelId, id, status)
      await reload()
    } catch (e) {
      setActionError(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading && !item) return <Spinner />
  if (error) return <div className="page"><ErrorText>{error}</ErrorText></div>
  if (!item) return <div className="page"><p className="muted">Lavoro non trovato.</p></div>

  return (
    <div className="page">
      <a href="#/planning/work">← Planning Lavori</a>
      <div className="card stack">
        <div className="row">
          <h1>{item.description}</h1>
          <Badge kind={item.status}>{workStatusLabel(item.status)}</Badge>
        </div>
        <div className="muted">Giorni: {item.days.map(dayLabel).join(' · ')}</div>
      </div>
      {canUpdate && (
        <div className="card stack">
          <h2>Cambia stato</h2>
          <div className="chips">
            {WORK_STATUSES.map((s) => (
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
