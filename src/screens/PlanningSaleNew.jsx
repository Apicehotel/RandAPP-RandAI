import { useMemo, useState } from 'react'
import { createBooking, listBookings } from '../data/planning.js'
import { useAsync, go } from '../lib/hooks.js'
import { SHIFTS, bookingConflicts, roomNames, shiftLabel, shortDate, todayIso } from '../lib/planning.js'
import { Button, ErrorText, Field } from '../ui/kit.jsx'

export default function PlanningSaleNew({ ctx }) {
  const today = todayIso()
  const [form, setForm] = useState({ client: '', room: '', date_from: today, date_to: today, shift: 'mattina', pax: '', notes: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const { data: existing } = useAsync(() => listBookings(ctx.hotelId, todayIso()), [ctx.hotelId])

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const setFrom = (e) => {
    const v = e.target.value
    setForm((f) => ({ ...f, date_from: v, date_to: f.date_to < v ? v : f.date_to }))
  }

  const rooms = useMemo(() => roomNames(existing || []), [existing])
  const clash = useMemo(
    () => (form.room.trim() && form.date_from && form.date_to >= form.date_from
      ? bookingConflicts(form, existing || [])[0] : null),
    [form, existing],
  )

  const submit = async (e) => {
    e.preventDefault()
    if (!form.client.trim()) return setError('Scrivi il cliente o l\'evento')
    if (!form.room.trim()) return setError('Scrivi la sala')
    if (!form.date_from || form.date_to < form.date_from) return setError('Controlla le date')
    if (clash) return setError('La sala è già occupata in quel turno')
    setBusy(true)
    setError('')
    try {
      const booking = await createBooking(ctx.hotelId, ctx.userId, form)
      go(`/planning/sale/${booking.id}`)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <form className="page" onSubmit={submit}>
      <a href="#/planning/sale">← Planning Sale</a>
      <h1>Nuova prenotazione sala</h1>
      <div className="card stack">
        <Field label="Cliente o evento" id="client">
          <input id="client" className="input" value={form.client} onChange={set('client')} maxLength={80} autoFocus />
        </Field>
        <Field label="Sala" id="room">
          <input id="room" className="input" list="sale-rooms" value={form.room} onChange={set('room')} maxLength={60} placeholder="es. Sala Giotto" />
          <datalist id="sale-rooms">{rooms.map((r) => <option key={r} value={r} />)}</datalist>
        </Field>
        <Field label="Dal" id="date_from">
          <input id="date_from" className="input" type="date" value={form.date_from} onChange={setFrom} />
        </Field>
        <Field label="Al" id="date_to">
          <input id="date_to" className="input" type="date" min={form.date_from} value={form.date_to} onChange={set('date_to')} />
        </Field>
        <Field label="Turno" id="shift">
          <select id="shift" className="select" value={form.shift} onChange={set('shift')}>
            {SHIFTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </Field>
        <Field label="Persone (facoltativo)" id="pax">
          <input id="pax" className="input" type="number" inputMode="numeric" min="1" max="5000" value={form.pax} onChange={set('pax')} />
        </Field>
        <Field label="Note (facoltativo)" id="notes">
          <textarea id="notes" className="textarea" value={form.notes} onChange={set('notes')} maxLength={2000} />
        </Field>
        {clash && (
          <p className="error" role="alert">
            Sala già occupata: {clash.client} ({shortDate(clash.date_from)}, {shiftLabel(clash.shift)})
          </p>
        )}
        <ErrorText>{error}</ErrorText>
        <Button variant="primary" type="submit" block disabled={busy || Boolean(clash)}>
          {busy ? 'Salvo…' : 'Prenota la sala'}
        </Button>
      </div>
    </form>
  )
}
