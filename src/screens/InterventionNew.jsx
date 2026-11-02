import { useEffect, useRef, useState } from 'react'
import { createIntervention } from '../data/interventions.js'
import { getIssue, updateIssueStatus } from '../data/issues.js'
import { listLocations, listStaff } from '../data/forms.js'
import { assignable, categoryOptions, clearDraft, loadDraft, locationLabel, locationOk, rangeOk, saveDraft } from '../lib/forms.js'
import { go, useAsync } from '../lib/hooks.js'
import { localInputToIso } from '../lib/interventions.js'
import { CATEGORIES } from '../lib/queue.js'
import { Button, ErrorText, Field } from '../ui/kit.jsx'
import { ChipPick, LocationInput, RoomsPicker, StaffPicker } from '../ui/forms.jsx'

const EMPTY = { title: '', zone: '', rooms: [], category: '', scheduled: '', until: '', assignees: [], notes: '' }
const CATS = categoryOptions(CATEGORIES)

// issueId: se arriva da una segnalazione, i campi si precompilano e l'intervento resta collegato.
export default function InterventionNew({ ctx, issueId = null }) {
  const draftKey = issueId ? `intervention-${issueId}` : 'intervention'
  const draft = useRef(loadDraft(draftKey, ctx.hotelId, ctx.userId))
  const [form, setForm] = useState({ ...EMPTY, ...(draft.current || {}) })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const { data: locations } = useAsync(() => listLocations(ctx.hotelId), [ctx.hotelId])
  const { data: staff } = useAsync(() => listStaff(ctx.hotelId), [ctx.hotelId])
  const { data: issue } = useAsync(() => (issueId ? getIssue(ctx.hotelId, issueId) : null), [ctx.hotelId, issueId])

  useEffect(() => {
    if (!issue || draft.current) return
    const known = (locations || []).some((l) => l.kind === 'room' && l.name === issue.room)
    setForm((f) => ({
      ...f, title: issue.title, category: issue.category, notes: issue.description || '',
      rooms: known ? [issue.room] : [], zone: known ? '' : issue.room || '',
    }))
  }, [issue, locations])

  useEffect(() => {
    const t = setTimeout(() => saveDraft(draftKey, ctx.hotelId, ctx.userId, form), 300)
    return () => clearTimeout(t)
  }, [form, draftKey, ctx.hotelId, ctx.userId])

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const pick = (key) => (value) => setForm((f) => ({ ...f, [key]: value }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) return setError('Scrivi cosa bisogna fare')
    if (form.zone.trim() && !locationOk(locations || [], form.zone)) return setError("Scegli la zona dall'elenco")
    if (!rangeOk(form.scheduled, form.until)) return setError('La fine deve essere dopo l\'inizio')
    setBusy(true)
    setError('')
    try {
      const item = await createIntervention(ctx.hotelId, ctx.userId, {
        title: form.title,
        location: locationLabel(form.rooms, form.zone),
        rooms: form.rooms,
        category: form.category,
        notes: form.notes,
        scheduled_at: localInputToIso(form.scheduled),
        scheduled_until: localInputToIso(form.until),
        assignee_ids: form.assignees,
        issue_id: issueId,
      })
      clearDraft(draftKey, ctx.hotelId, ctx.userId)
      // La segnalazione passa a "Tecnico" (se il ruolo può): chi la guarda vede che è presa in carico.
      if (issueId && issue?.status === 'da_fare') await updateIssueStatus(ctx.hotelId, issueId, 'tecnico').catch(() => {})
      go(`/interventions/${item.id}`)
    } catch (err) {
      setError(`${err.message}. La bozza resta sul telefono: riprova.`)
      setBusy(false)
    }
  }

  return (
    <form className="page" onSubmit={submit}>
      <a href={issueId ? `#/issues/${issueId}` : '#/interventions'}>← {issueId ? 'Segnalazione' : 'Interventi'}</a>
      <h1>Nuovo intervento</h1>
      {issue && <p className="banner">Da segnalazione: <strong>{issue.title}</strong></p>}
      <div className="card stack">
        <Field label="Cosa bisogna fare" id="title">
          <input id="title" className="input" value={form.title} onChange={set('title')} maxLength={140} autoFocus />
        </Field>
        <div className="stack">
          <span className="field-label">Categoria (facoltativo)</span>
          <ChipPick label="Categoria" options={CATS} value={form.category} onChange={(v) => pick('category')(form.category === v ? '' : v)} />
        </div>
        <Field label="Zona (facoltativo)" id="zone">
          <LocationInput id="zone" locations={locations || []} value={form.zone} onChange={pick('zone')} placeholder="es. Hall, Cucina" />
        </Field>
        <div className="stack">
          <span className="field-label">Camere{form.rooms.length ? ` · ${form.rooms.length} scelte` : ''}</span>
          <RoomsPicker locations={locations || []} selected={form.rooms} onChange={pick('rooms')} />
        </div>
        <div className="two">
          <Field label="Dal (facoltativo)" id="scheduled">
            <input id="scheduled" className="input" type="datetime-local" value={form.scheduled} onChange={set('scheduled')} />
          </Field>
          <Field label="Al (facoltativo)" id="until">
            <input id="until" className="input" type="datetime-local" min={form.scheduled || undefined} value={form.until} onChange={set('until')} />
          </Field>
        </div>
        <div className="stack">
          <span className="field-label">Chi lo esegue (facoltativo){form.assignees.length ? ` · ${form.assignees.length}` : ''}</span>
          <StaffPicker staff={assignable(staff)} selected={form.assignees} onChange={pick('assignees')} />
        </div>
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
