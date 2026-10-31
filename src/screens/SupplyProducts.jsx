import { useState } from 'react'
import { createProduct, listProducts, setProductActive } from '../data/supplies.js'
import { useAsync } from '../lib/hooks.js'
import { SUPPLY_CATEGORIES, supplyCategoryLabel } from '../lib/supplies.js'
import { Badge, Button, ErrorText, Field, Spinner } from '../ui/kit.jsx'

export default function SupplyProducts({ ctx }) {
  const { data, error, loading, reload } = useAsync(() => listProducts(ctx.hotelId), [ctx.hotelId])
  const [category, setCategory] = useState('minibar')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')

  const run = async (fn) => {
    setBusy(true); setActionError('')
    try { await fn(); await reload() } catch (e) { setActionError(e.message) } finally { setBusy(false) }
  }
  const add = (e) => {
    e.preventDefault()
    if (!name.trim()) { setActionError('Scrivi il nome del prodotto'); return }
    run(async () => { await createProduct(ctx.hotelId, ctx.userId, category, name); setName('') })
  }

  return (
    <div className="page">
      <a href="#/supplies">← Rifornimento</a>
      <h1>Catalogo prodotti</h1>
      <form className="card stack" onSubmit={add}>
        <div className="chips" role="group" aria-label="Categoria">
          {SUPPLY_CATEGORIES.map((c) => (
            <button key={c.id} type="button" className="chip" aria-pressed={category === c.id} onClick={() => setCategory(c.id)}>{c.label}</button>
          ))}
        </div>
        <Field label="Nome prodotto" id="name"><input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></Field>
        <ErrorText>{actionError}</ErrorText>
        <Button variant="primary" type="submit" block disabled={busy}>Aggiungi</Button>
      </form>

      {loading && !data && <Spinner />}
      <ErrorText>{error}</ErrorText>
      <div className="card stack">
        {data?.length === 0 && <p className="muted">Nessun prodotto.</p>}
        <ul className="people">
          {(data || []).map((p) => (
            <li key={p.id}>
              <span>{p.name} <span className="muted">· {supplyCategoryLabel(p.category)}</span></span>
              <span>
                {!p.active && <Badge kind="">Nascosto</Badge>}{' '}
                <button className="link-btn" disabled={busy} onClick={() => run(() => setProductActive(ctx.hotelId, p.id, !p.active))}>
                  {p.active ? 'Nascondi' : 'Mostra'}
                </button>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
