import { useState } from 'react'
import { listRequests, resolveItem } from '../data/supplies.js'
import { useAsync, go } from '../lib/hooks.js'
import { can, PERM } from '../lib/permissions.js'
import { filterRequests, itemStatusLabel, joinRequests, supplyCategoryLabel } from '../lib/supplies.js'
import { Badge, Button, ErrorText, Spinner, formatDate } from '../ui/kit.jsx'

const FILTERS = [
  { id: 'aperte', label: 'Da portare' },
  { id: 'chiuse', label: 'Chiuse' },
  { id: 'tutte', label: 'Tutte' },
]
const BADGE = { pending: 'in_corso', delivered: 'fatto', missing: 'aperto' }

function RequestCard({ request, canComplete, onResolve, busy }) {
  const { summary } = request
  return (
    <div className="card stack">
      <div className="row">
        <strong>{request.requested_by_name}</strong>
        <Badge kind={request.open ? 'in_corso' : 'fatto'}>{request.open ? `${summary.pending} da portare` : 'Chiusa'}</Badge>
      </div>
      <div className="muted">{formatDate(request.created_at)}{request.note ? ` · ${request.note}` : ''}</div>
      <ul className="people">
        {request.items.map((it) => (
          <li key={it.id}>
            <span>{it.product_name} <span className="muted">· {supplyCategoryLabel(it.category)}</span></span>
            {it.status === 'pending' && canComplete ? (
              <span className="chips">
                <button className="chip" disabled={busy} onClick={() => onResolve(it.id, 'delivered')}>Consegnato</button>
                <button className="chip" disabled={busy} onClick={() => onResolve(it.id, 'missing')}>Manca</button>
              </span>
            ) : (
              <Badge kind={BADGE[it.status]}>{itemStatusLabel(it.status)}</Badge>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function Supplies({ ctx }) {
  const [filter, setFilter] = useState('aperte')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const { data, error, loading, reload } = useAsync(() => listRequests(ctx.hotelId), [ctx.hotelId])
  const list = filterRequests(joinRequests(data?.requests || [], data?.items || []), filter)
  const canComplete = can(ctx.permissions, PERM.SUPPLIES_COMPLETE)

  const resolve = async (itemId, status) => {
    setBusy(true); setActionError('')
    try { await resolveItem(itemId, status); await reload() }
    catch (e) { setActionError(e.message) }
    finally { setBusy(false) }
  }

  return (
    <div className="page">
      <div className="row">
        <h1>Rifornimento</h1>
        {can(ctx.permissions, PERM.SUPPLIES_CREATE) && (
          <Button variant="primary" onClick={() => go('/supplies/new')}>+ Richiesta</Button>
        )}
      </div>
      <p className="muted">Prodotti richiesti dall'housekeeping, da portare ai piani.</p>
      {can(ctx.permissions, PERM.SUPPLIES_MANAGE) && <a href="#/supplies/products">Gestisci catalogo prodotti →</a>}

      <div className="chips" role="group" aria-label="Filtro richieste">
        {FILTERS.map((f) => (
          <button key={f.id} className="chip" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</button>
        ))}
      </div>

      {loading && !data && <Spinner />}
      <ErrorText>{error || actionError}</ErrorText>
      {error && <Button onClick={reload}>Riprova</Button>}

      <div className="list">
        {list.map((r) => <RequestCard key={r.id} request={r} canComplete={canComplete} onResolve={resolve} busy={busy} />)}
        {data && list.length === 0 && <div className="card muted">Nessuna richiesta in questo filtro.</div>}
      </div>
    </div>
  )
}
