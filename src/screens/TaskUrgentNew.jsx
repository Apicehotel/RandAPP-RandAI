import { useState } from 'react'
import { createAlert } from '../data/task.js'
import { go } from '../lib/hooks.js'
import { Button, ErrorText, Field } from '../ui/kit.jsx'

export default function TaskUrgentNew({ ctx }) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (!note.trim()) return setError("Scrivi cosa è successo")
    setBusy(true)
    setError('')
    try {
      const alert = await createAlert(ctx.hotelId, ctx.userId, note)
      go(`/task/urgent/${alert.id}`)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <form className="page" onSubmit={submit}>
      <a href="#/task/urgent">← Avvisi Urgenti</a>
      <h1>Nuovo avviso urgente</h1>
      <div className="card stack">
        <Field label="Cosa è successo e dove" id="note">
          <textarea id="note" className="textarea" value={note} onChange={(e) => setNote(e.target.value)}
            maxLength={300} placeholder="es. Perdita d'acqua in cucina, vicino al lavello" autoFocus />
        </Field>
        <p className="muted">{note.length}/300</p>
        <ErrorText>{error}</ErrorText>
        <Button variant="primary" type="submit" block disabled={busy}>
          {busy ? 'Invio…' : 'Invia avviso'}
        </Button>
      </div>
    </form>
  )
}
