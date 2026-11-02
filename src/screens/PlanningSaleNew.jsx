import { useEffect, useMemo, useRef, useState } from 'react'
import { createBooking, getBooking, listBookings, updateBooking } from '../data/planning.js'
import { addSaleLayout, getSaleConfig, saveSaleClient } from '../data/forms.js'
import { applyRecall, clearDraft, findClient, loadDraft, prepDefaults, prepOk, saveDraft } from '../lib/forms.js'
import { useAsync, go } from '../lib/hooks.js'
import { can, PERM } from '../lib/permissions.js'
import {
  FORM_SHIFTS, addDaysIso, bookingConflicts, prepDay, roomAvailability, roomNames, roomsByFamily, shiftLabel, shortDate, todayIso,
} from '../lib/planning.js'
import { Button, ErrorText, Field } from '../ui/kit.jsx'
import { ChipPick, Stepper } from '../ui/forms.jsx'

const SHIFT_OPTS = FORM_SHIFTS.map((s) => ({ id: s.id, label: s.id === 'giornata' ? 'Giornata intera' : s.label }))
const AVAIL = { free: '● Libera', partial: '◐ Parziale', busy: '● Occupata' }

// editId: se presente la schermata modifica una prenotazione esistente (niente bozza).
export default function PlanningSaleNew({ ctx, editId = null }) {
  const today = todayIso()
  const draft = useRef(editId ? null : loadDraft('sale', ctx.hotelId, ctx.userId))
  const [form, setForm] = useState({
    client: '', room: '', layout: '', date_from: today, date_to: today, prep_date: today, shift: 'mattina',
    pax: '1', notes: '', audio: false, video: false, saveRecall: false, ...(draft.current || {}),
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [newLayout, setNewLayout] = useState('')
  const { data: existing } = useAsync(() => listBookings(ctx.hotelId, todayIso()), [ctx.hotelId])
  const { data: config, reload: reloadConfig } = useAsync(() => getSaleConfig(ctx.hotelId), [ctx.hotelId])

  const { data: current } = useAsync(() => (editId ? getBooking(ctx.hotelId, editId) : null), [ctx.hotelId, editId])
  useEffect(() => {
    if (!current) return
    setForm({
      client: current.client, room: current.room, layout: current.layout || '', date_from: current.date_from,
      date_to: current.date_to, prep_date: prepDay(current), shift: current.shift, pax: String(current.pax || 1),
      notes: current.notes || '', audio: current.audio_required, video: current.video_required, saveRecall: false,
    })
  }, [current])

  useEffect(() => {
    if (editId) return undefined
    const t = setTimeout(() => saveDraft('sale', ctx.hotelId, ctx.userId, form), 300)
    return () => clearTimeout(t)
  }, [form, ctx.hotelId, ctx.userId, editId])

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const pick = (key) => (value) => setForm((f) => ({ ...f, [key]: value }))
  const setFrom = (e) => {
    const v = e.target.value
    setForm((f) => ({
      ...f, date_from: v, date_to: f.date_to < v ? v : f.date_to,
      prep_date: !f.prep_date || f.prep_date > v ? v : f.prep_date,
    }))
  }

  const configuredRooms = (config?.rooms || []).filter((r) => r.active || r.name === form.room)
  const allRooms = config?.rooms || []
  const hasConfig = configuredRooms.length > 0
  const layouts = config?.layouts || []
  const roomHints = useMemo(() => roomNames(existing || []), [existing])
  const client = findClient(config?.clients, form.client)
  const prep = prepDefaults(form.date_from, addDaysIso)
  const canManage = can(ctx.permissions, PERM.PLANNING_SALE_MANAGE)

  // Stato di ogni sala nel periodo scelto: libera o già occupata (e da chi).
  const period = { date_from: form.date_from, date_to: form.date_to, shift: form.shift }
  const clash = form.room.trim() && form.date_to >= form.date_from
    ? bookingConflicts({ ...form, id: editId, room: form.room }, existing || [], allRooms)[0]
    : null

  const addLayout = async () => {
    if (!newLayout.trim()) return
    try {
      const l = await addSaleLayout(ctx.hotelId, newLayout)
      setNewLayout('')
      await reloadConfig()
      pick('layout')(l.name)
    } catch (err) {
      setError(err.message)
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!form.client.trim()) return setError("Scrivi il cliente o l'evento")
    if (!form.room.trim()) return setError('Scegli la sala')
    if (!form.date_from || form.date_to < form.date_from) return setError('Controlla le date')
    if (!prepOk(form.prep_date, form.date_from)) return setError("La preparazione deve essere il giorno dell'evento o prima")
    if (clash) return setError('La sala è già occupata in quel turno')
    setBusy(true)
    setError('')
    try {
      const input = { ...form, audio_required: form.audio, video_required: form.video }
      const booking = editId
        ? await updateBooking(ctx.hotelId, editId, input, allRooms)
        : await createBooking(ctx.hotelId, ctx.userId, input, allRooms)
      if (form.saveRecall) await saveSaleClient(ctx.hotelId, form).catch(() => {})
      if (!editId) clearDraft('sale', ctx.hotelId, ctx.userId)
      go(`/planning/sale/${booking.id}`)
    } catch (err) {
      setError(`${err.message}. La bozza resta sul telefono: riprova.`)
      setBusy(false)
    }
  }

  return (
    <form className="page" onSubmit={submit}>
      <a href={editId ? `#/planning/sale/${editId}` : '#/planning/sale'}>← {editId ? 'Prenotazione' : 'Planning Sale'}</a>
      <div className="row">
        <h1>{editId ? 'Modifica prenotazione' : 'Nuova prenotazione sala'}</h1>
        {canManage && <a href="#/planning/sale/config">Configura</a>}
      </div>
      <div className="card stack">
        <Field label="Cliente o evento" id="client">
          <input id="client" className="input" list="sale-clients" value={form.client} onChange={set('client')} maxLength={80} autoFocus />
          <datalist id="sale-clients">{(config?.clients || []).map((c) => <option key={c.id} value={c.name} />)}</datalist>
        </Field>
        {client && (client.preferred_room || client.preferred_layout) && (
          <div className="recall">
            <span>Richiamo: {[client.preferred_room, client.preferred_layout, client.preferred_pax && `${client.preferred_pax} pax`].filter(Boolean).join(' · ')}</span>
            <Button type="button" onClick={() => setForm((f) => applyRecall(f, client))}>Usa</Button>
          </div>
        )}

        <div className="two">
          <Field label="Evento dal" id="date_from">
            <input id="date_from" className="input" type="date" value={form.date_from} onChange={setFrom} />
          </Field>
          <Field label="Evento al" id="date_to">
            <input id="date_to" className="input" type="date" min={form.date_from} value={form.date_to} onChange={set('date_to')} />
          </Field>
        </div>
        <div className="stack">
          <span className="field-label">Turno evento</span>
          <ChipPick label="Turno" options={SHIFT_OPTS} value={form.shift} onChange={pick('shift')} />
        </div>

        <div className="stack">
          <span className="field-label">Da preparare il <small>(giorno operativo manutenzione)</small></span>
          <div className="chips wrap">
            <button type="button" className="chip" aria-pressed={form.prep_date === prep.same} onClick={() => pick('prep_date')(prep.same)}>Stesso giorno</button>
            <button type="button" className="chip" aria-pressed={form.prep_date === prep.before} onClick={() => pick('prep_date')(prep.before)}>Giorno prima</button>
          </div>
          <input className="input" type="date" max={form.date_from} value={form.prep_date} onChange={set('prep_date')} aria-label="Data preparazione" />
        </div>

        {hasConfig ? (
          <div className="stack">
            <span className="field-label">Sala · {configuredRooms.filter((r) => roomAvailability(r, period, existing || [], allRooms, editId) === 'free').length} libere nel periodo</span>
            {roomsByFamily(configuredRooms).map((g) => (
              <div key={g.name} className="stack">
                <small className="muted">{g.name}</small>
                <div className="chips wrap" role="group" aria-label={`Sale ${g.name}`}>
                  {g.rooms.map((r) => {
                    const a = roomAvailability(r, period, existing || [], allRooms, editId)
                    return (
                      <button type="button" key={r.id} className="chip" aria-pressed={form.room === r.name} disabled={a !== 'free'}
                        onClick={() => pick('room')(r.name)}>
                        {r.name} <small>{AVAIL[a]}</small>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Field label="Sala" id="room">
            <input id="room" className="input" list="sale-rooms" value={form.room} onChange={set('room')} maxLength={60} placeholder="es. Sala Giotto" />
            <datalist id="sale-rooms">{roomHints.map((r) => <option key={r} value={r} />)}</datalist>
          </Field>
        )}

        <div className="stack">
          <span className="field-label">Allestimento</span>
          {layouts.length > 0 && (
            <div className="chips wrap" role="group" aria-label="Allestimento">
              {layouts.map((l) => (
                <button type="button" key={l.id} className="chip" aria-pressed={form.layout === l.name} onClick={() => pick('layout')(form.layout === l.name ? '' : l.name)}>{l.name}</button>
              ))}
            </div>
          )}
          <div className="two">
            <input className="input" value={newLayout} onChange={(e) => setNewLayout(e.target.value)} maxLength={60} placeholder="Nuovo allestimento" aria-label="Nuovo allestimento" />
            <Button type="button" onClick={addLayout} disabled={!newLayout.trim()}>+ Aggiungi</Button>
          </div>
        </div>

        <div className="stack">
          <span className="field-label">Controlli richiesti</span>
          <label className="checkrow"><input type="checkbox" checked={form.audio} onChange={(e) => pick('audio')(e.target.checked)} /> Audio</label>
          <label className="checkrow"><input type="checkbox" checked={form.video} onChange={(e) => pick('video')(e.target.checked)} /> Video</label>
        </div>

        <div className="stack">
          <span className="field-label">Persone</span>
          <Stepper label="Persone" value={form.pax} onChange={pick('pax')} />
        </div>
        <Field label="Note (facoltativo)" id="notes">
          <textarea id="notes" className="textarea" value={form.notes} onChange={set('notes')} maxLength={2000} />
        </Field>
        <label className="checkrow">
          <input type="checkbox" checked={form.saveRecall} onChange={(e) => pick('saveRecall')(e.target.checked)} />
          {client ? 'Aggiorna richiamo cliente' : 'Salva come richiamo cliente'}
        </label>
        {clash && (
          <p className="error" role="alert">
            Sala già occupata: {clash.client} ({shortDate(clash.date_from)}, {shiftLabel(clash.shift)})
          </p>
        )}
        <ErrorText>{error}</ErrorText>
        <Button variant="primary" type="submit" block disabled={busy || Boolean(clash)}>
          {busy ? 'Salvo…' : editId ? 'Salva modifiche' : 'Prenota la sala'}
        </Button>
      </div>
    </form>
  )
}
