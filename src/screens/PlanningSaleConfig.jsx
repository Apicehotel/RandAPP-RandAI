import { useState } from 'react'
import { addSaleRoom, getSaleConfig, setSaleRoomActive } from '../data/forms.js'
import { useAsync } from '../lib/hooks.js'
import { comboParts, roomParts } from '../lib/planning.js'
import { Button, ErrorText, Field, Spinner } from '../ui/kit.jsx'

// Elenco delle sale prenotabili (solo chi ha planning_sale.manage): sale singole e combinazioni.
export default function PlanningSaleConfig({ ctx }) {
  const { data, error, loading, reload } = useAsync(() => getSaleConfig(ctx.hotelId), [ctx.hotelId])
  const [name, setName] = useState('')
  const [family, setFamily] = useState('')
  const [capacity, setCapacity] = useState('')
  const [combo, setCombo] = useState(false)
  const [picked, setPicked] = useState([])
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const rooms = data?.rooms || []
  // Combinazioni: si compongono solo con sale singole attive.
  const bases = rooms.filter((r) => r.active && roomParts(r).length === 1)

  const run = async (fn) => {
    setBusy(true)
    setMsg('')
    try { await fn(); await reload() } catch (e) { setMsg(e.message) } finally { setBusy(false) }
  }
  const add = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    if (combo && picked.length < 2) return setMsg('Seleziona almeno due sale base.')
    run(async () => {
      const max = Math.max(0, ...rooms.map((r) => r.sort_order))
      await addSaleRoom(ctx.hotelId, {
        name, family: family || name, capacity, sort_order: max + 10,
        parts: combo ? comboParts(bases.filter((r) => picked.includes(r.id))) : [],
      })
      setName(''); setFamily(''); setCapacity(''); setPicked([]); setCombo(false)
    })
  }

  return (
    <div className="page">
      <a href="#/planning/sale">← Planning Sale</a>
      <h1>Sale della struttura</h1>
      {loading && !data && <Spinner />}
      <ErrorText>{error}</ErrorText>
      <div className="list">
        {rooms.map((r) => (
          <div key={r.id} className="card row">
            <span>
              <b>{r.name}</b>{r.capacity ? ` · ${r.capacity} posti` : ''}{roomParts(r).length > 1 ? ' · combinazione' : ''}{r.active ? '' : ' · nascosta'}
              <small className="muted"> {r.family}</small>
            </span>
            <Button disabled={busy} onClick={() => run(() => setSaleRoomActive(ctx.hotelId, r.id, !r.active))}>{r.active ? 'Disattiva' : 'Attiva'}</Button>
          </div>
        ))}
        {data && rooms.length === 0 && <div className="card muted">Nessuna sala: aggiungi la prima.</div>}
      </div>
      <form className="card stack" onSubmit={add}>
        <h2>Aggiungi sala</h2>
        <Field label="Nome" id="room-name"><input id="room-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} /></Field>
        <Field label="Famiglia (es. Sax, Trumpet, Auditorium)" id="room-family"><input id="room-family" className="input" value={family} onChange={(e) => setFamily(e.target.value)} maxLength={60} placeholder="vuoto = come il nome" /></Field>
        <Field label="Posti (facoltativo)" id="room-cap"><input id="room-cap" className="input" inputMode="numeric" value={capacity} onChange={(e) => setCapacity(e.target.value.replace(/\D/g, ''))} /></Field>
        <div className="two">
          <button type="button" className="chip" aria-pressed={!combo} onClick={() => { setCombo(false); setPicked([]) }}>Singola</button>
          <button type="button" className="chip" aria-pressed={combo} onClick={() => setCombo(true)}>Combinazione</button>
        </div>
        {combo && (
          <div className="chips wrap" role="group" aria-label="Sale della combinazione">
            {bases.map((r) => (
              <button type="button" key={r.id} className="chip" aria-pressed={picked.includes(r.id)}
                onClick={() => setPicked(picked.includes(r.id) ? picked.filter((x) => x !== r.id) : [...picked, r.id])}>{r.name}</button>
            ))}
          </div>
        )}
        {combo && <small className="muted">Una combinazione occupa anche le sale che la compongono (es. "Sax 1+2" blocca Sax 1 e Sax 2).</small>}
        <ErrorText>{msg}</ErrorText>
        <Button variant="primary" type="submit" block disabled={busy || !name.trim()}>Aggiungi</Button>
      </form>
    </div>
  )
}
