import { useRef, useState, useEffect } from 'react'
import { createWork } from '../data/planning.js'
import { listStaff } from '../data/forms.js'
import { assignable, categoryOptions, clearDraft, loadDraft, saveDraft } from '../lib/forms.js'
import { go, useAsync } from '../lib/hooks.js'
import { dayLabel, todayIso, weekDaysIso, weekStartIso } from '../lib/planning.js'
import { CATEGORIES } from '../lib/queue.js'
import { Button, ErrorText, Field } from '../ui/kit.jsx'
import { ChipPick, StaffPicker } from '../ui/forms.jsx'
import { WeekNav } from './PlanningWork.jsx'

const CATS = categoryOptions(CATEGORIES)

export default function PlanningWorkNew({ ctx }) {
  const draft = useRef(loadDraft('work', ctx.hotelId, ctx.userId))
  const [form, setForm] = useState({ description: '', category: '', selected: [], assignees: [], ...(draft.current || {}) })
  const [start, setStart] = useState(() => weekStartIso(todayIso()))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const { data: staff } = useAsync(() => listStaff(ctx.hotelId), [ctx.hotelId])

  useEffect(() => {
    const t = setTimeout(() => saveDraft('work', ctx.hotelId, ctx.userId, form), 300)
    return () => clearTimeout(t)
  }, [form, ctx.hotelId, ctx.userId])

  const pick = (key) => (value) => setForm((f) => ({ ...f, [key]: value }))
  const toggle = (iso) =>
    setForm((f) => ({ ...f, selected: f.selected.includes(iso) ? f.selected.filter((d) => d !== iso) : [...f.selected, iso] }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.description.trim()) return setError('Scrivi quale lavoro')
    if (form.selected.length === 0) return setError('Scegli almeno un giorno')
    setBusy(true)
    setError('')
    try {
      const work = await createWork(ctx.hotelId, ctx.userId, {
        description: form.description, days: form.selected, category: form.category, assignee_ids: form.assignees,
      })
      clearDraft('work', ctx.hotelId, ctx.userId)
      go(`/planning/work/${work.id}`)
    } catch (err) {
      setError(`${err.message}. La bozza resta sul telefono: riprova.`)
      setBusy(false)
    }
  }

  return (
    <form className="page" onSubmit={submit}>
      <a href="#/planning/work">← Planning Lavori</a>
      <h1>Nuovo lavoro</h1>
      <div className="card stack">
        <Field label="Quale lavoro" id="description">
          <input id="description" className="input" value={form.description} onChange={(e) => pick('description')(e.target.value)} maxLength={200} autoFocus />
        </Field>
        <div className="stack">
          <span className="field-label">Categoria (facoltativo)</span>
          <ChipPick label="Categoria" options={CATS} value={form.category} onChange={(v) => pick('category')(form.category === v ? '' : v)} />
        </div>
        <div className="stack">
          <span className="field-label">Giorni (anche di settimane diverse)</span>
          <WeekNav start={start} onChange={setStart} />
          <div className="chips wrap" role="group" aria-label="Giorni">
            {weekDaysIso(start).map((d) => (
              <button type="button" key={d} className="chip" aria-pressed={form.selected.includes(d)} onClick={() => toggle(d)}>
                {dayLabel(d)}
              </button>
            ))}
          </div>
          {form.selected.length > 0 && <p className="muted">Scelti: {[...form.selected].sort().map(dayLabel).join(' · ')}</p>}
        </div>
        <div className="stack">
          <span className="field-label">Chi lo esegue (facoltativo){form.assignees.length ? ` · ${form.assignees.length}` : ''}</span>
          <StaffPicker staff={assignable(staff)} selected={form.assignees} onChange={pick('assignees')} />
        </div>
        <ErrorText>{error}</ErrorText>
        <Button variant="primary" type="submit" block disabled={busy}>
          {busy ? 'Salvo…' : 'Aggiungi al planning'}
        </Button>
      </div>
    </form>
  )
}
