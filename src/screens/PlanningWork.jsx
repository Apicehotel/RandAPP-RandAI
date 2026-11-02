import { useState } from 'react'
import { getWork, listWorkDays, listWorkDaysOf, setWorkDayStatus } from '../data/planning.js'
import { listStaff } from '../data/forms.js'
import { staffNames } from '../lib/forms.js'
import { useAsync, go } from '../lib/hooks.js'
import { can, PERM } from '../lib/permissions.js'
import {
  addDaysIso, dayLabel, dayStats, liveDays, shortDate, todayIso, weekDaysIso, weekStartIso, workDayLabel, workDaysOn,
} from '../lib/planning.js'
import { Badge, Button, ErrorText, Spinner } from '../ui/kit.jsx'

export function WeekNav({ start, onChange }) {
  const end = addDaysIso(start, 6)
  return (
    <div className="row weeknav">
      <button type="button" className="chip" onClick={() => onChange(addDaysIso(start, -7))} aria-label="Settimana precedente">←</button>
      <button type="button" className="chip" onClick={() => onChange(weekStartIso(todayIso()))}>
        {shortDate(start)} – {shortDate(end)}
      </button>
      <button type="button" className="chip" onClick={() => onChange(addDaysIso(start, 7))} aria-label="Settimana successiva">→</button>
    </div>
  )
}

export function Stats({ stats }) {
  return (
    <div className="stats3">
      <div className="card"><span className="stat-num">{stats.today}</span><span className="muted">Oggi</span></div>
      <div className="card"><span className="stat-num warn">{stats.finish}</span><span className="muted">Da finire</span></div>
      <div className="card"><span className="stat-num ok">{stats.done}</span><span className="muted">Fatti oggi</span></div>
    </div>
  )
}

const time = (iso) => new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })

// Una riga = un giorno di un lavoro, con le sue azioni (✓ Fatto · Da finire · Annulla giorno).
export function WorkDayRow({ row, canUpdate, onChanged, showDay = false }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const done = row.status === 'fatto'
  const finish = row.status === 'da_finire'

  const act = async (status) => {
    setBusy(true)
    setError('')
    try {
      await setWorkDayStatus(row.id, status)
      await onChanged?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="card dayrow" data-status={row.status}>
      <div className="dayrow-main">
        {canUpdate ? (
          <button type="button" className="tick" disabled={busy} aria-label={done ? 'Riapri' : 'Segna fatto'}
            data-on={done || undefined} onClick={() => act(done ? 'da_fare' : 'fatto')}>{done ? '✓' : '·'}</button>
        ) : <span className="tick" data-on={done || undefined}>{done ? '✓' : '·'}</span>}
        <div>
          <a className="title" href={`#/planning/work/${row.work_id}`} style={{ textDecoration: done ? 'line-through' : 'none' }}>{row.description}</a>
          {showDay && <small className="muted"> · {dayLabel(row.day)}</small>}
          {row.category && <small className="muted"> · {row.category}</small>}
          {done && row.status_by_name && <small className="ok-text">Fatto da {row.status_by_name}{row.status_at ? ` · ${time(row.status_at)}` : ''}</small>}
          {finish && <small className="warn-text">Da finire{row.status_by_name ? ` · ${row.status_by_name}` : ''}</small>}
        </div>
      </div>
      {canUpdate && !done && (
        <div className="row dayrow-actions">
          <Button disabled={busy} onClick={() => act('annullato')}>Annulla giorno</Button>
          <Button disabled={busy} onClick={() => act(finish ? 'da_fare' : 'da_finire')}>{finish ? 'Da fare' : 'Da finire'}</Button>
          <Button variant="primary" disabled={busy} onClick={() => act('fatto')}>✓ Fatto</Button>
        </div>
      )}
      <ErrorText>{error}</ErrorText>
    </article>
  )
}

export function WorkList({ ctx }) {
  const [start, setStart] = useState(() => weekStartIso(todayIso()))
  const days = weekDaysIso(start)
  const today = todayIso()
  const canUpdate = can(ctx.permissions, PERM.PLANNING_WORK_UPDATE)
  const { data, error, loading, reload } = useAsync(
    () => listWorkDays(ctx.hotelId, { from: start, to: days[6] }),
    [ctx.hotelId, start],
  )
  const rows = data || []

  return (
    <div className="page">
      <a href="#/planning">← Planning</a>
      <div className="row">
        <h1>Planning Lavori</h1>
        {can(ctx.permissions, PERM.PLANNING_WORK_CREATE) && (
          <Button variant="primary" onClick={() => go('/planning/work/new')}>+ Lavoro</Button>
        )}
      </div>

      <Stats stats={dayStats(rows, today)} />
      <WeekNav start={start} onChange={setStart} />

      {loading && !data && <Spinner />}
      <ErrorText>{error}</ErrorText>
      {error && <Button onClick={reload}>Riprova</Button>}

      {days.map((d) => (
        <section key={d} className="stack" data-today={d === today || undefined}>
          <h2>{dayLabel(d)}{d === today ? ' · oggi' : ''}</h2>
          {workDaysOn(rows, d).length ? (
            <div className="list">
              {workDaysOn(rows, d).map((r) => <WorkDayRow key={r.id} row={r} canUpdate={canUpdate} onChanged={reload} />)}
            </div>
          ) : <p className="muted">Nessun lavoro.</p>}
        </section>
      ))}
    </div>
  )
}

export function WorkDetail({ ctx, id }) {
  const { data: item, error, loading } = useAsync(() => getWork(ctx.hotelId, id), [ctx.hotelId, id])
  const { data: daysData, reload } = useAsync(() => listWorkDaysOf(ctx.hotelId, id), [ctx.hotelId, id])
  const { data: staff } = useAsync(() => listStaff(ctx.hotelId), [ctx.hotelId])
  const canUpdate = can(ctx.permissions, PERM.PLANNING_WORK_UPDATE)

  if (loading && !item) return <Spinner />
  if (error) return <div className="page"><ErrorText>{error}</ErrorText></div>
  if (!item) return <div className="page"><p className="muted">Lavoro non trovato.</p></div>
  const rows = liveDays(daysData)

  return (
    <div className="page">
      <a href="#/planning/work">← Planning Lavori</a>
      <div className="card stack">
        <h1>{item.description}</h1>
        {item.category && <div><Badge>{item.category}</Badge></div>}
        {item.assignee_ids?.length > 0 && <div className="muted">Assegnato a: {staffNames(staff, item.assignee_ids).join(', ') || `${item.assignee_ids.length} persone`}</div>}
        <div className="muted">{rows.length} giorn{rows.length === 1 ? 'o' : 'i'}: {rows.map((r) => `${shortDate(r.day)} (${workDayLabel(r.status).toLowerCase()})`).join(' · ')}</div>
      </div>
      <h2>Giorni</h2>
      <div className="list">
        {rows.map((r) => <WorkDayRow key={r.id} row={r} canUpdate={canUpdate} onChanged={reload} showDay />)}
      </div>
    </div>
  )
}
