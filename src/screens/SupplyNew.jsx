import { useState } from 'react'
import { createRequest, listProducts } from '../data/supplies.js'
import { useAsync, go } from '../lib/hooks.js'
import { can, PERM } from '../lib/permissions.js'
import { groupProducts } from '../lib/supplies.js'
import { Button, ErrorText, Field, Spinner } from '../ui/kit.jsx'

export default function SupplyNew({ ctx }) {
  const { data, error, loading } = useAsync(() => listProducts(ctx.hotelId), [ctx.hotelId])
  const [picked, setPicked] = useState(() => new Set())
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const groups = groupProducts(data || [])

  const toggle = (id) => setPicked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const submit = async (e) => {
    e.preventDefault()
    if (picked.size === 0) { setActionError('Scegli almeno un prodotto'); return }
    setBusy(true); setActionError('')
    try { await createRequest(ctx.hotelId, [...picked], note); go('/supplies') }
    catch (err) { setActionError(err.message); setBusy(false) }
  }

  return (
    <form className="page" onSubmit={submit}>
      <a href="#/supplies">← Rifornimento</a>
      <h1>Nuova richiesta</h1>
      {loading && !data && <Spinner />}
      <ErrorText>{error}</ErrorText>
      {data && groups.length === 0 && (
        <div className="card stack">
          <p className="muted">Il catalogo prodotti è vuoto.</p>
          {can(ctx.permissions, PERM.SUPPLIES_MANAGE) && <a href="#/supplies/products">Aggiungi i prodotti →</a>}
        </div>
      )}
      {groups.map((g) => (
        <div key={g.id} className="card stack">
          <h2>{g.label}</h2>
          <div className="chips wrap" role="group" aria-label={g.label}>
            {g.products.map((p) => (
              <button key={p.id} type="button" className="chip" aria-pressed={picked.has(p.id)} onClick={() => toggle(p.id)}>{p.name}</button>
            ))}
          </div>
        </div>
      ))}
      {groups.length > 0 && (
        <div className="card stack">
          <Field label="Nota (facoltativa)" id="note"><input id="note" className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="es. piano 2, entro le 14" /></Field>
          <ErrorText>{actionError}</ErrorText>
          <Button variant="primary" type="submit" block disabled={busy}>{busy ? 'Invio…' : `Invia richiesta (${picked.size})`}</Button>
        </div>
      )}
    </form>
  )
}
