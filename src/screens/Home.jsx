import { useState } from 'react'
import { loadHome } from '../data/home.js'
import { listPresence, setPresence } from '../data/presence.js'
import { useAsync } from '../lib/hooks.js'
import { can, roleLabel, PERM } from '../lib/permissions.js'
import { buildTiles, buildTodo, isPresentNow, presentNow, timeLabel, todayTitle } from '../lib/home.js'
import { todayIso } from '../lib/planning.js'
import { Badge, Button, ErrorText, Icon, Spinner } from '../ui/kit.jsx'

const TILE_ORDER = ['alerts', 'issues', 'interventions', 'works', 'sale', 'reminders']

function Presence({ ctx }) {
  const { data, error, loading, reload } = useAsync(() => listPresence(ctx.hotelId), [ctx.hotelId])
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const canUpdate = can(ctx.permissions, PERM.PRESENCE_UPDATE)

  const people = presentNow(data || [])
  const mine = (data || []).find((r) => r.user_id === ctx.userId)
  const iAmIn = Boolean(mine && isPresentNow(mine))

  const toggle = async () => {
    setBusy(true)
    setActionError('')
    try {
      await setPresence(ctx.hotelId, !iAmIn)
      await reload()
    } catch (e) {
      setActionError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card stack" aria-label="Chi c'è in struttura">
      <div className="row">
        <h2>Chi c'è in struttura</h2>
        <span className="muted">{data ? people.length : ''}</span>
      </div>
      {loading && !data && <Spinner />}
      <ErrorText>{error}</ErrorText>
      {data && people.length === 0 && <p className="muted">Nessuno ha segnato la presenza.</p>}
      {people.length > 0 && (
        <ul className="people">
          {people.map((p) => (
            <li key={p.user_id}>
              <span className="who">{p.display_name}{p.user_id === ctx.userId ? ' (tu)' : ''}</span>
              <span className="muted">{roleLabel(p.role)} · dalle {timeLabel(p.since)}</span>
            </li>
          ))}
        </ul>
      )}
      {canUpdate && (
        <Button variant={iAmIn ? undefined : 'primary'} block disabled={busy} onClick={toggle}>
          {iAmIn ? 'Sono uscito' : 'Sono arrivato'}
        </Button>
      )}
      <ErrorText>{actionError}</ErrorText>
      {error && <Button onClick={reload}>Riprova</Button>}
    </section>
  )
}

// Home = riepilogo della giornata: un riquadro per sezione, chi c'è e cosa c'è da fare.
// Nessun pulsante "Nuova": si crea dentro le singole sezioni.
export default function Home({ ctx }) {
  const showPresence = can(ctx.permissions, PERM.PRESENCE_VIEW)
  const { data: loaded, error, loading } = useAsync(() => loadHome(ctx), [ctx.hotelId, ctx.role])

  if (loading && !loaded) return <Spinner />
  if (error) return <div className="page"><ErrorText>{error}</ErrorText></div>

  const { data, failed } = loaded
  const today = todayIso()
  const tiles = buildTiles(data, { today, role: ctx.role })
  const todo = buildTodo(data, { today, role: ctx.role })
  const visible = TILE_ORDER.filter((k) => tiles[k])

  return (
    <div className="page">
      <div className="stack">
        <h1>Oggi</h1>
        <p className="muted">{todayTitle()}</p>
      </div>

      {failed.length > 0 && (
        <div className="card muted" role="status">Alcune sezioni non si sono caricate. Riapri la Home per riprovare.</div>
      )}

      {visible.length > 0 && (
        <div className="hub-grid tiles">
          {visible.map((k) => {
            const t = tiles[k]
            return (
              <a key={k} className="card hub-choice tile" href={t.href}>
                <span className="head">
                  <span className={`icon${t.tone ? ` ${t.tone}` : ''}`}><Icon name={t.icon} size={20} /></span>
                  <span className="num">{t.value}</span>
                </span>
                <strong>{t.label}</strong>
                <span className="metrics"><span>{t.detail}</span></span>
              </a>
            )
          })}
        </div>
      )}

      {showPresence && <Presence ctx={ctx} />}

      <h2>Da fare adesso</h2>
      {todo.length === 0 ? (
        <div className="card muted">Niente da fare al momento.</div>
      ) : (
        <div className="list">
          {todo.map((t) => (
            <a key={t.key} className="card issue" href={t.href}>
              <div className="row">
                <span className="title">{t.title}</span>
                <Badge kind={t.tone === 'danger' ? 'urgente' : undefined}>{t.section}</Badge>
              </div>
              <div className="muted">{t.meta}</div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
