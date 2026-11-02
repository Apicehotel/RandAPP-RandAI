import { useState } from 'react'
import { addSaleRoom, getSaleConfig, setSaleRoomActive } from '../data/forms.js'
import { useAsync } from '../lib/hooks.js'
import { Button, ErrorText, Field, Spinner } from '../ui/kit.jsx'

// Elenco delle sale prenotabili della struttura (solo chi ha planning_sale.manage).
export default function PlanningSaleConfig({ ctx }) {
  const { data, error, loading, reload } = useAsync(() => getSaleConfig(ctx.hotelId), [ctx.hotelId])
  const [name, setName] = useState('')
  const [capacity, setCapacity] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const run = async (fn) => {
    setBusy(true)
    setMsg('')
    try { await fn(); await reload() } catch (e) { setMsg(e.message) } finally { setBusy(false) }
  }
  const add = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    run(async () => {
      const max = Math.max(0, ...(data?.rooms || []).map((r) => r.sort_order))
      await addSaleRoom(ctx.hotelId, { name, capacity, sort_order: max + 10 })
      setName(''); setCapacity('')
    })
  }

  return (
    <div className="page">
      <a href="#/planning/sale">← Planning Sale</a>
      <h1>Sale della struttura</h1>
      {loading && !data && <Spinner />}
      <ErrorText>{error}</ErrorText>
      <div className="list">
        {(data?.rooms || []).map((r) => (
          <div key={r.id} className="card row">
            <span>{r.name}{r.capacity ? ` · ${r.capacity} posti` : ''}{r.active ? '' : ' · nascosta'}</span>
            <Button disabled={busy} onClick={() => run(() => setSaleRoomActive(ctx.hotelId, r.id, !r.active))}>{r.active ? 'Nascondi' : 'Mostra'}</Button>
          </div>
        ))}
        {data && data.rooms.length === 0 && <div className="card muted">Nessuna sala: aggiungi la prima.</div>}
      </div>
      <form className="card stack" onSubmit={add}>
        <h2>Aggiungi sala</h2>
        <Field label="Nome" id="room-name"><input id="room-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} /></Field>
        <Field label="Posti (facoltativo)" id="room-cap"><input id="room-cap" className="input" inputMode="numeric" value={capacity} onChange={(e) => setCapacity(e.target.value.replace(/\D/g, ''))} /></Field>
        <ErrorText>{msg}</ErrorText>
        <Button variant="primary" type="submit" block disabled={busy || !name.trim()}>Aggiungi</Button>
      </form>
    </div>
  )
}
