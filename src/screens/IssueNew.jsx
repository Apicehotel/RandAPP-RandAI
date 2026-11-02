import { useEffect, useRef, useState } from 'react'
import { createIssue } from '../data/issues.js'
import { listLocations } from '../data/forms.js'
import { clearDraft, categoryOptions, loadDraft, locationOk, saveDraft } from '../lib/forms.js'
import { go, useAsync } from '../lib/hooks.js'
import { CATEGORIES, URGENCIES } from '../lib/queue.js'
import { Button, ErrorText, Field } from '../ui/kit.jsx'
import { ChipPick, LocationInput } from '../ui/forms.jsx'

const EMPTY = { title: '', room: '', category: CATEGORIES[0], urgency: 'normale', description: '' }
const CATS = categoryOptions(CATEGORIES)
const URGS = URGENCIES.map((u) => ({ id: u.id, label: u.label }))

export default function IssueNew({ ctx }) {
  const draft = useRef(loadDraft('issue', ctx.hotelId, ctx.userId))
  const [form, setForm] = useState({ ...EMPTY, ...(draft.current || {}) })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const { data: locations } = useAsync(() => listLocations(ctx.hotelId), [ctx.hotelId])

  // La bozza resta sul telefono mentre scrivi: se esci per sbaglio non perdi nulla.
  useEffect(() => {
    const t = setTimeout(() => saveDraft('issue', ctx.hotelId, ctx.userId, form), 300)
    return () => clearTimeout(t)
  }, [form, ctx.hotelId, ctx.userId])

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const pick = (key) => (value) => setForm((f) => ({ ...f, [key]: value }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) return setError('Scrivi cosa non funziona')
    if (form.room.trim() && !locationOk(locations || [], form.room)) return setError('Scegli una camera o una zona dall\'elenco')
    setBusy(true)
    setError('')
    try {
      const issue = await createIssue(ctx.hotelId, ctx.userId, form)
      clearDraft('issue', ctx.hotelId, ctx.userId)
      go(`/issues/${issue.id}`)
    } catch (err) {
      setError(`${err.message}. La bozza resta sul telefono: riprova.`)
      setBusy(false)
    }
  }

  return (
    <form className="page" onSubmit={submit}>
      <a href="#/issues">← Segnalazioni</a>
      <h1>Nuova segnalazione</h1>
      {draft.current && <p className="banner">Bozza ripresa. <button type="button" className="linkbtn" onClick={() => { clearDraft('issue', ctx.hotelId, ctx.userId); setForm(EMPTY) }}>Svuota</button></p>}
      <div className="card stack">
        <Field label="Cosa non funziona" id="title">
          <input id="title" className="input" value={form.title} onChange={set('title')} maxLength={140} autoFocus />
        </Field>
        <Field label="Camera o zona" id="room">
          <LocationInput id="room" locations={locations || []} value={form.room} onChange={pick('room')} />
        </Field>
        <div className="stack">
          <span className="field-label">Categoria</span>
          <ChipPick label="Categoria" options={CATS} value={form.category} onChange={pick('category')} />
        </div>
        <div className="stack">
          <span className="field-label">Urgenza</span>
          <ChipPick label="Urgenza" options={URGS} value={form.urgency} onChange={pick('urgency')} />
        </div>
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
