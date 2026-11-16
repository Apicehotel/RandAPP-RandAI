import { useEffect, useRef, useState } from 'react'
import { createIssue } from '../data/issues.js'
import { listLocations } from '../data/forms.js'
import { clearDraft, categoryOptions, loadDraft, locationOk, saveDraft } from '../lib/forms.js'
import { go, useAsync } from '../lib/hooks.js'
import { CATEGORIES, URGENCIES } from '../lib/queue.js'
import { Button, ErrorText, Field } from '../ui/kit.jsx'
import { ChipPick, LocationInput } from '../ui/forms.jsx'
import SimilarCases from '../ui/SimilarCases.jsx'
import { logAi } from '../data/ai.js'
import { queryFrom, scrubText } from '../lib/ai.js'

const EMPTY = { title: '', room: '', category: CATEGORIES[0], urgency: 'normale', description: '' }
const CATS = categoryOptions(CATEGORIES)
const URGS = URGENCIES.map((u) => ({ id: u.id, label: u.label }))

export default function IssueNew({ ctx }) {
  const draft = useRef(loadDraft('issue', ctx.hotelId, ctx.userId))
  const [form, setForm] = useState({ ...EMPTY, ...(draft.current || {}) })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [savedOffline, setSavedOffline] = useState(false)
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
      if (issue.pending) { setSavedOffline(true); setBusy(false); return } // senza rete: salvata sul telefono, parte da sola
      // La scelta della persona (testo → categoria e urgenza) è un esempio verificato per l'IA locale futura. Non blocca mai l'invio.
      logAi(ctx.hotelId, { feature: 'classify', source: 'human', input: { title: scrubText(form.title).slice(0, 140), description: scrubText(form.description).slice(0, 500) }, output: { category: form.category, urgency: form.urgency } })
      go(`/issues/${issue.id}`)
    } catch (err) {
      setError(`${err.message}. La bozza resta sul telefono: riprova.`)
      setBusy(false)
    }
  }

  if (savedOffline) {
    return (
      <div className="page">
        <h1>Segnalazione salvata sul telefono</h1>
        <div className="card stack">
          <p>Non c'è connessione: la segnalazione verrà inviata da sola appena torna la rete. Fino ad allora compare in elenco come «in attesa di invio».</p>
          <Button variant="primary" onClick={() => go('/issues')}>Vai alle segnalazioni</Button>
          <Button onClick={() => { setForm(EMPTY); setSavedOffline(false) }}>Nuova segnalazione</Button>
        </div>
      </div>
    )
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
        <SimilarCases ctx={ctx} query={queryFrom(form)} />
        <Button variant="primary" type="submit" block disabled={busy}>
          {busy ? 'Invio…' : 'Invia segnalazione'}
        </Button>
      </div>
    </form>
  )
}
