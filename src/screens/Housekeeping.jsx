import { useState } from 'react'
import { addRooms, listRooms, resetDay, setRoomActive, setRoomNote, setRoomStatus } from '../data/housekeeping.js'
import { useAsync } from '../lib/hooks.js'
import { can, PERM } from '../lib/permissions.js'
import { ROOM_STATUSES, groupByFloor, parseRoomList, roomStatusLabel, summarizeRooms } from '../lib/housekeeping.js'
import { Badge, Button, ErrorText, Field, Spinner } from '../ui/kit.jsx'

const BADGE = { dafare: 'aperto', in_corso: 'in_corso', fatto: 'fatto' }

function AddRooms({ ctx, onDone }) {
  const [floor, setFloor] = useState('1')
  const [rooms, setRooms] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    const list = parseRoomList(rooms)
    const f = Number(floor)
    if (!list.length) { setError('Scrivi almeno un numero di camera'); return }
    if (!Number.isInteger(f)) { setError('Piano non valido'); return }
    setBusy(true); setError(''); setMessage('')
    try {
      const { added, skipped } = await addRooms(ctx.hotelId, ctx.userId, f, list)
      setMessage(`${added} aggiunte${skipped.length ? ` · già presenti: ${skipped.join(', ')}` : ''}`)
      setRooms('')
      await onDone()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  return (
    <form className="card stack" onSubmit={submit}>
      <h2>Aggiungi camere</h2>
      <Field label="Piano (0 = piano terra)" id="floor"><input id="floor" className="input" inputMode="numeric" value={floor} onChange={(e) => setFloor(e.target.value)} /></Field>
      <Field label="Camere (separate da virgola o spazio)" id="rooms"><input id="rooms" className="input" value={rooms} onChange={(e) => setRooms(e.target.value)} placeholder="201, 202, 203" /></Field>
      <ErrorText>{error}</ErrorText>
      {message && <p className="muted">{message}</p>}
      <Button variant="primary" type="submit" block disabled={busy}>Aggiungi</Button>
    </form>
  )
}

export default function Housekeeping({ ctx }) {
  const { data, error, loading, reload } = useAsync(() => listRooms(ctx.hotelId), [ctx.hotelId])
  const [onlyOpen, setOnlyOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const canUpdate = can(ctx.permissions, PERM.HOUSEKEEPING_UPDATE)
  const canManage = can(ctx.permissions, PERM.HOUSEKEEPING_MANAGE)
  const rooms = data || []
  const sum = summarizeRooms(rooms)
  const floors = groupByFloor(rooms, { onlyOpen })
  const current = rooms.find((r) => r.id === selected)

  const run = async (fn) => {
    setBusy(true); setActionError('')
    try { await fn(); await reload() } catch (e) { setActionError(e.message) } finally { setBusy(false) }
  }
  const open = (r) => { setSelected(r.id); setNote(r.note || '') }

  return (
    <div className="page">
      <h1>Housekeeping</h1>
      {data && <p className="muted">{sum.total} camere · {sum.todo} da fare · {sum.running} in corso · {sum.done} fatte</p>}
      <div className="chips" role="group" aria-label="Vista camere">
        <button className="chip" aria-pressed={!onlyOpen} onClick={() => setOnlyOpen(false)}>Tutte</button>
        <button className="chip" aria-pressed={onlyOpen} onClick={() => setOnlyOpen(true)}>Da fare</button>
      </div>
      {canUpdate && <p className="muted">Tocca una camera per cambiarne lo stato o scrivere una nota.</p>}

      {loading && !data && <Spinner />}
      <ErrorText>{error || actionError}</ErrorText>
      {error && <Button onClick={reload}>Riprova</Button>}

      {floors.map((f) => (
        <div key={f.floor} className="card stack">
          <div className="row"><h2>{f.label}</h2><span className="muted">{f.summary.done}/{f.summary.total} fatte</span></div>
          <div className="chips wrap">
            {f.rooms.map((r) => (
              <button key={r.id} className="chip" aria-pressed={selected === r.id}
                onClick={() => open(r)}
                aria-label={`Camera ${r.room}: ${roomStatusLabel(r.status)}`} disabled={busy}>
                {r.room} <Badge kind={BADGE[r.status]}>{roomStatusLabel(r.status)}</Badge>
              </button>
            ))}
          </div>
        </div>
      ))}
      {data && rooms.length === 0 && (
        <div className="card muted">Nessuna camera: {canManage ? 'aggiungile qui sotto.' : "chiedi a un responsabile di aggiungerle."}</div>
      )}

      {current && (
        <div className="card stack">
          <div className="row"><h2>Camera {current.room}</h2><button className="link-btn" onClick={() => setSelected(null)}>Chiudi</button></div>
          {canUpdate && (
            <div className="chips">
              {ROOM_STATUSES.map((s) => (
                <button key={s.id} className="chip" aria-pressed={current.status === s.id} disabled={busy}
                  onClick={() => run(() => setRoomStatus(ctx.hotelId, ctx.userId, current.id, s.id))}>{s.label}</button>
              ))}
            </div>
          )}
          <Field label="Nota" id="note"><input id="note" className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} readOnly={!canUpdate} /></Field>
          {canUpdate && <Button disabled={busy} onClick={() => run(() => setRoomNote(ctx.hotelId, ctx.userId, current.id, note))}>Salva nota</Button>}
          {canManage && <Button disabled={busy} onClick={() => run(async () => { await setRoomActive(current.id, false); setSelected(null) })}>Togli la camera dall'elenco</Button>}
        </div>
      )}

      {canManage && (
        <>
          <AddRooms ctx={ctx} onDone={reload} />
          <div className="card stack">
            <h2>Nuova giornata</h2>
            <p className="muted">Rimette "da fare" tutte le camere.</p>
            <Button disabled={busy} onClick={() => { if (window.confirm('Rimettere tutte le camere da fare?')) run(() => resetDay(ctx.hotelId)) }}>Riparti da zero</Button>
          </div>
        </>
      )}
    </div>
  )
}
