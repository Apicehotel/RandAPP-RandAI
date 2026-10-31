import { useState } from 'react'
import { listItems, getItem, listMovements, moveStock, updateItem } from '../data/warehouse.js'
import { useAsync, go } from '../lib/hooks.js'
import { can, PERM } from '../lib/permissions.js'
import {
  MOVE_KINDS, checkMove, filterItems, formatQty, isLow, isOut, moveKindLabel, parseAmount, summarizeWarehouse,
} from '../lib/warehouse.js'
import { Badge, Button, ErrorText, Field, Spinner, formatDate } from '../ui/kit.jsx'

const FILTERS = [
  { id: 'tutti', label: 'Tutti' },
  { id: 'sotto', label: 'Sotto scorta' },
  { id: 'esauriti', label: 'Esauriti' },
]

function StockBadge({ item }) {
  if (isOut(item)) return <Badge kind="aperto">Esaurito</Badge>
  if (isLow(item)) return <Badge kind="alta">Sotto scorta</Badge>
  return null
}

export function ItemList({ ctx }) {
  const [filter, setFilter] = useState('tutti')
  const [query, setQuery] = useState('')
  const { data, error, loading, reload } = useAsync(() => listItems(ctx.hotelId), [ctx.hotelId])
  const visible = filterItems(data || [], { filter, query })
  const sum = summarizeWarehouse(data || [])

  return (
    <div className="page">
      <div className="row">
        <h1>Magazzino</h1>
        {can(ctx.permissions, PERM.WAREHOUSE_CREATE) && (
          <Button variant="primary" onClick={() => go('/warehouse/new')}>+ Articolo</Button>
        )}
      </div>
      {data && <p className="muted">{sum.total} articoli · {sum.low} sotto scorta · {sum.out} esauriti</p>}

      <input className="input" type="search" placeholder="Cerca articolo, categoria, ubicazione" value={query}
        onChange={(e) => setQuery(e.target.value)} aria-label="Cerca nel magazzino" />
      <div className="chips" role="group" aria-label="Filtro magazzino">
        {FILTERS.map((f) => (
          <button key={f.id} className="chip" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</button>
        ))}
      </div>

      {loading && !data && <Spinner />}
      <ErrorText>{error}</ErrorText>
      {error && <Button onClick={reload}>Riprova</Button>}

      <div className="list">
        {visible.map((i) => (
          <a key={i.id} className="card issue" href={`#/warehouse/${i.id}`}>
            <div className="row">
              <span className="title">{i.name}</span>
              <strong>{formatQty(i.quantity, i.unit)}</strong>
            </div>
            <div className="row muted">
              <span>{[i.category, i.location].filter(Boolean).join(' · ') || 'Senza ubicazione'}</span>
              <StockBadge item={i} />
            </div>
          </a>
        ))}
        {data && visible.length === 0 && (
          <div className="card muted">{data.length === 0 ? 'Magazzino vuoto: aggiungi il primo articolo.' : 'Nessun articolo trovato.'}</div>
        )}
      </div>
    </div>
  )
}

export function ItemDetail({ ctx, id }) {
  const { data: item, error, loading, reload } = useAsync(() => getItem(ctx.hotelId, id), [ctx.hotelId, id])
  const moves = useAsync(() => listMovements(ctx.hotelId, id), [ctx.hotelId, id])
  const [kind, setKind] = useState('carico')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const canMove = can(ctx.permissions, PERM.WAREHOUSE_MOVE)
  const canManage = can(ctx.permissions, PERM.WAREHOUSE_MANAGE)

  const submit = async (e) => {
    e.preventDefault()
    const value = parseAmount(amount)
    const problem = checkMove(item, kind, value)
    if (problem) { setActionError(problem); return }
    setBusy(true); setActionError('')
    try {
      await moveStock(id, kind, value, note)
      setAmount(''); setNote('')
      await Promise.all([reload(), moves.reload()])
    } catch (err) {
      setActionError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const toggleActive = async () => {
    setBusy(true); setActionError('')
    try { await updateItem(ctx.hotelId, id, { active: !item.active }); await reload() }
    catch (err) { setActionError(err.message) }
    finally { setBusy(false) }
  }

  if (loading && !item) return <Spinner />
  if (error) return <div className="page"><ErrorText>{error}</ErrorText></div>
  if (!item) return <div className="page"><p className="muted">Articolo non trovato.</p></div>

  return (
    <div className="page">
      <a href="#/warehouse">← Magazzino</a>
      <div className="card stack">
        <div className="row"><h1>{item.name}</h1><StockBadge item={item} /></div>
        <div className="row"><span className="muted">Giacenza</span><strong>{formatQty(item.quantity, item.unit)}</strong></div>
        {Number(item.min_quantity) > 0 && (
          <div className="row"><span className="muted">Scorta minima</span><span>{formatQty(item.min_quantity, item.unit)}</span></div>
        )}
        {item.category && <div className="row"><span className="muted">Categoria</span><span>{item.category}</span></div>}
        {item.location && <div className="row"><span className="muted">Ubicazione</span><span>{item.location}</span></div>}
        {item.notes && <p>{item.notes}</p>}
        {!item.active && <Badge kind="">Archiviato</Badge>}
      </div>

      {canMove && item.active && (
        <form className="card stack" onSubmit={submit}>
          <h2>Movimento</h2>
          <div className="chips" role="group" aria-label="Tipo di movimento">
            {MOVE_KINDS.map((k) => (
              <button key={k.id} type="button" className="chip" aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>{k.label}</button>
            ))}
          </div>
          <p className="muted">{MOVE_KINDS.find((k) => k.id === kind)?.hint}</p>
          <Field label={`Quantità (${item.unit})`} id="amount">
            <input id="amount" className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Nota (facoltativa)" id="note">
            <input id="note" className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
          </Field>
          <ErrorText>{actionError}</ErrorText>
          <Button variant="primary" type="submit" block disabled={busy}>{busy ? 'Salvo…' : 'Registra'}</Button>
        </form>
      )}

      <div className="card stack">
        <h2>Movimenti</h2>
        {moves.loading && !moves.data && <Spinner />}
        {moves.data?.length === 0 && <p className="muted">Nessun movimento.</p>}
        <ul className="people">
          {(moves.data || []).map((m) => (
            <li key={m.id}>
              <span>{moveKindLabel(m.kind)} {Number(m.delta) > 0 ? '+' : ''}{formatQty(m.delta)}{m.note ? ` · ${m.note}` : ''}</span>
              <span className="muted">{formatDate(m.created_at)}</span>
            </li>
          ))}
        </ul>
      </div>

      {canManage && (
        <div className="card stack">
          <Button onClick={toggleActive} disabled={busy}>{item.active ? 'Archivia articolo' : 'Ripristina articolo'}</Button>
          {!canMove && <ErrorText>{actionError}</ErrorText>}
        </div>
      )}
    </div>
  )
}
