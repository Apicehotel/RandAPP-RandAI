import { useState } from 'react'
import { createIssue } from '../data/issues.js'
import { go } from '../lib/hooks.js'
import { CATEGORIES, URGENCIES } from '../lib/queue.js'
import { Button, ErrorText, Field } from '../ui/kit.jsx'

export default function IssueNew({ ctx }) {
  const [form, setForm] = useState({ title: '', room: '', category: CATEGORIES[0], urgency: 'normale', description: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) {
      setError('Scrivi cosa non funziona')
      return
    }
    setBusy(true)
    setError('')
    try {
      const issue = await createIssue(ctx.hotelId, ctx.userId, form)
      go(`/issues/${issue.id}`)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <form className="page" onSubmit={submit}>
      <a href="#/issues">← Segnalazioni</a>
      <h1>Nuova segnalazione</h1>
      <div className="card stack">
        <Field label="Cosa non funziona" id="title">
          <input id="title" className="input" value={form.title} onChange={set('title')} maxLength={140} autoFocus />
        </Field>
        <Field label="Camera o zona" id="room">
          <input id="room" className="input" value={form.room} onChange={set('room')} maxLength={40} placeholder="es. 204, Hall, Cucina" />
        </Field>
        <Field label="Categoria" id="category">
          <select id="category" className="select" value={form.category} onChange={set('category')}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Urgenza" id="urgency">
          <select id="urgency" className="select" value={form.urgency} onChange={set('urgency')}>
            {URGENCIES.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
          </select>
        </Field>
        <Field label="Dettagli (facoltativo)" id="description">
          <textarea id="description" className="textarea" value={form.description} onChange={set('description')} maxLength={2000} />
        </Field>
        <ErrorText>{error}</ErrorText>
        <Button variant="primary" type="submit" block disabled={busy}>
          {busy ? 'Invio…' : 'Invia segnalazione'}
        </Button>
      </div>
    </form>
  )
}
