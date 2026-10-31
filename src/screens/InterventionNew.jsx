import { useState } from 'react'
import { createIntervention } from '../data/interventions.js'
import { go } from '../lib/hooks.js'
import { localInputToIso } from '../lib/interventions.js'
import { Button, ErrorText, Field } from '../ui/kit.jsx'

export default function InterventionNew({ ctx }) {
  const [form, setForm] = useState({ title: '', location: '', scheduled: '', notes: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) {
      setError('Scrivi cosa bisogna fare')
      return
    }
    setBusy(true)
    setError('')
    try {
      const item = await createIntervention(ctx.hotelId, ctx.userId, {
        title: form.title,
        location: form.location,
        notes: form.notes,
        scheduled_at: localInputToIso(form.scheduled),
      })
      go(`/interventions/${item.id}`)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <form className="page" onSubmit={submit}>
      <a href="#/interventions">← Interventi</a>
      <h1>Nuovo intervento</h1>
      <div className="card stack">
        <Field label="Cosa bisogna fare" id="title">
          <input id="title" className="input" value={form.title} onChange={set('title')} maxLength={140} autoFocus />
        </Field>
        <Field label="Camera o zona" id="location">
          <input id="location" className="input" value={form.location} onChange={set('location')} maxLength={40} placeholder="es. 204, Hall, Cucina" />
        </Field>
        <Field label="Quando (facoltativo)" id="scheduled">
          <input id="scheduled" className="input" type="datetime-local" value={form.scheduled} onChange={set('scheduled')} />
        </Field>
        <Field label="Note (facoltativo)" id="notes">
          <textarea id="notes" className="textarea" value={form.notes} onChange={set('notes')} maxLength={2000} />
        </Field>
        <ErrorText>{error}</ErrorText>
        <Button variant="primary" type="submit" block disabled={busy}>
          {busy ? 'Salvo…' : 'Crea intervento'}
        </Button>
      </div>
    </form>
  )
}
