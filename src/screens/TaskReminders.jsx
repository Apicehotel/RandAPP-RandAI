import { useState } from 'react'
import { listReminders, getReminder, setReminderActive } from '../data/task.js'
import { useAsync, go } from '../lib/hooks.js'
import { can, roleLabel, PERM } from '../lib/permissions.js'
import { describeSchedule, isForRole } from '../lib/task.js'
import { shortDate } from '../lib/planning.js'
import { Badge, Button, ErrorText, Spinner } from '../ui/kit.jsx'

export const rolesText = (r) => (r.target_roles.length ? r.target_roles.map(roleLabel).join(', ') : 'Tutti i ruoli')

export function ReminderCard({ item }) {
  return (
    <a className="card issue" href={`#/task/reminders/${item.id}`}>
      <div className="row">
        <span className="title">{item.message}</span>
        <Badge kind={item.active ? 'fatto' : 'bassa'}>{item.active ? 'Attivo' : 'Spento'}</Badge>
      </div>
      <div className="row muted">
        <span>{describeSchedule(item)}</span>
      </div>
      <div className="muted">{rolesText(item)}</div>
    </a>
  )
}

export function ReminderList({ ctx }) {
  const manager = can(ctx.permissions, PERM.REMINDERS_CREATE)
  const [filter, setFilter] = useState('per_me')
  const { data, error, loading, reload } = useAsync(() => listReminders(ctx.hotelId), [ctx.hotelId])
  const visible = (data || []).filter((r) => (filter === 'tutti' ? true : isForRole(r, ctx.role)))

  return (
    <div className="page">
      <a href="#/task">← Task</a>
      <div className="row">
        <h1>Promemoria</h1>
        {manager && <Button variant="primary" onClick={() => go('/task/reminders/new')}>+ Promemoria</Button>}
      </div>
      <p className="muted">L'invio automatico delle notifiche non è ancora attivo: per ora i promemoria si consultano qui.</p>

      {manager && (
        <div className="chips" role="group" aria-label="Filtro promemoria">
          <button className="chip" aria-pressed={filter === 'per_me'} onClick={() => setFilter('per_me')}>Per me</button>
          <button className="chip" aria-pressed={filter === 'tutti'} onClick={() => setFilter('tutti')}>Tutti</button>
        </div>
      )}

      {loading && !data && <Spinner />}
      <ErrorText>{error}</ErrorText>
      {error && <Button onClick={reload}>Riprova</Button>}

      <div className="list">
        {visible.map((r) => <ReminderCard key={r.id} item={r} />)}
        {data && visible.length === 0 && <div className="card muted">Nessun promemoria.</div>}
      </div>
    </div>
  )
}

export function ReminderDetail({ ctx, id }) {
  const { data: item, error, loading, reload } = useAsync(() => getReminder(ctx.hotelId, id), [ctx.hotelId, id])
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const canUpdate = can(ctx.permissions, PERM.REMINDERS_UPDATE)

  const change = async (active) => {
    setBusy(true)
    setActionError('')
    try {
      await setReminderActive(ctx.hotelId, id, active)
      await reload()
    } catch (e) {
      setActionError(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading && !item) return <Spinner />
  if (error) return <div className="page"><ErrorText>{error}</ErrorText></div>
  if (!item) return <div className="page"><p className="muted">Promemoria non trovato.</p></div>

  return (
    <div className="page">
      <a href="#/task/reminders">← Promemoria</a>
      <div className="card stack">
        <div className="row">
          <h1>{item.message}</h1>
          <Badge kind={item.active ? 'fatto' : 'bassa'}>{item.active ? 'Attivo' : 'Spento'}</Badge>
        </div>
        <div className="muted">{describeSchedule(item)}</div>
        <div className="muted">Per: {rolesText(item)}</div>
        <div className="muted">
          Dal {shortDate(item.start_date)}{item.end_date ? ` al ${shortDate(item.end_date)}` : ', senza scadenza'}
        </div>
      </div>
      {canUpdate && (
        <div className="card stack">
          <h2>Stato</h2>
          <div className="chips">
            <button className="chip" aria-pressed={item.active} disabled={busy || item.active} onClick={() => change(true)}>Attivo</button>
            <button className="chip" aria-pressed={!item.active} disabled={busy || !item.active} onClick={() => change(false)}>Spento</button>
          </div>
          <ErrorText>{actionError}</ErrorText>
        </div>
      )}
    </div>
  )
}
