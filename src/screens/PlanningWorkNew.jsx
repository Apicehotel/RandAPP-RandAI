import { useState } from 'react'
import { createWork } from '../data/planning.js'
import { go } from '../lib/hooks.js'
import { dayLabel, todayIso, weekDaysIso, weekStartIso } from '../lib/planning.js'
import { Button, ErrorText, Field } from '../ui/kit.jsx'
import { WeekNav } from './PlanningWork.jsx'

export default function PlanningWorkNew({ ctx }) {
  const [description, setDescription] = useState('')
  const [start, setStart] = useState(() => weekStartIso(todayIso()))
  const [selected, setSelected] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const toggle = (iso) =>
    setSelected((cur) => (cur.includes(iso) ? cur.filter((d) => d !== iso) : [...cur, iso]))

  const submit = async (e) => {
    e.preventDefault()
    if (!description.trim()) return setError('Scrivi quale lavoro')
    if (selected.length === 0) return setError('Scegli almeno un giorno')
    setBusy(true)
    setError('')
    try {
      const work = await createWork(ctx.hotelId, ctx.userId, { description, days: selected })
      go(`/planning/work/${work.id}`)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <form className="page" onSubmit={submit}>
      <a href="#/planning/work">← Planning Lavori</a>
      <h1>Nuovo lavoro</h1>
      <div className="card stack">
        <Field label="Quale lavoro" id="description">
          <input id="description" className="input" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} autoFocus />
        </Field>
        <div className="stack">
          <span className="field-label">Giorni (anche di settimane diverse)</span>
          <WeekNav start={start} onChange={setStart} />
          <div className="chips wrap" role="group" aria-label="Giorni">
            {weekDaysIso(start).map((d) => (
              <button type="button" key={d} className="chip" aria-pressed={selected.includes(d)} onClick={() => toggle(d)}>
                {dayLabel(d)}
              </button>
            ))}
          </div>
          {selected.length > 0 && <p className="muted">Scelti: {[...selected].sort().map(dayLabel).join(' · ')}</p>}
        </div>
        <ErrorText>{error}</ErrorText>
        <Button variant="primary" type="submit" block disabled={busy}>
          {busy ? 'Salvo…' : 'Aggiungi al planning'}
        </Button>
      </div>
    </form>
  )
}

