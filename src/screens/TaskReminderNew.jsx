import { useState } from 'react'
import { createReminder } from '../data/task.js'
import { go } from '../lib/hooks.js'
import { ROLE_LABELS } from '../lib/permissions.js'
import { REPEATS, WEEKDAYS, validateReminder } from '../lib/task.js'
import { todayIso } from '../lib/planning.js'
import { Button, ErrorText, Field } from '../ui/kit.jsx'

const toggle = (list, v) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

export default function TaskReminderNew({ ctx }) {
  const [form, setForm] = useState({
    message: '', target_roles: [], repeat_kind: 'once', weekdays: [], times: ['09:00'], start_date: todayIso(), end_date: '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const patch = (changes) => setForm((f) => ({ ...f, ...changes }))

  const submit = async (e) => {
    e.preventDefault()
    const problem = validateReminder(form)
    if (problem) return setError(problem)
    setBusy(true)
    setError('')
    try {
      const r = await createReminder(ctx.hotelId, ctx.userId, form)
      go(`/task/reminders/${r.id}`)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  const setTime = (i, v) => patch({ times: form.times.map((t, idx) => (idx === i ? v : t)) })

  return (
    <form className="page" onSubmit={submit}>
      <a href="#/task/reminders">← Promemoria</a>
      <h1>Nuovo promemoria</h1>
      <div className="card stack">
        <Field label="Messaggio" id="message">
          <textarea id="message" className="textarea" value={form.message} onChange={(e) => patch({ message: e.target.value })}
            maxLength={500} placeholder="es. Controllare l'irrigazione prima di uscire" autoFocus />
        </Field>

        <div className="stack">
          <span className="field-label">Per chi (nessuno scelto = tutti)</span>
          <div className="chips wrap" role="group" aria-label="Ruoli">
            {Object.entries(ROLE_LABELS).map(([id, label]) => (
              <button type="button" key={id} className="chip" aria-pressed={form.target_roles.includes(id)}
                onClick={() => patch({ target_roles: toggle(form.target_roles, id) })}>{label}</button>
            ))}
          </div>
        </div>

        <Field label="Ripetizione" id="repeat">
          <select id="repeat" className="select" value={form.repeat_kind} onChange={(e) => patch({ repeat_kind: e.target.value })}>
            {REPEATS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </Field>

        {form.repeat_kind === 'weekly' && (
          <div className="chips wrap" role="group" aria-label="Giorni">
            {WEEKDAYS.map((d) => (
              <button type="button" key={d.id} className="chip" aria-pressed={form.weekdays.includes(d.id)}
                onClick={() => patch({ weekdays: toggle(form.weekdays, d.id) })}>{d.label}</button>
            ))}
          </div>
        )}

        <div className="stack">
          <span className="field-label">Orari</span>
          {form.times.map((t, i) => (
            <div className="row" key={i}>
              <input className="input" type="time" aria-label={`Orario ${i + 1}`} value={t} onChange={(e) => setTime(i, e.target.value)} />
              {form.times.length > 1 && (
                <button type="button" className="chip" onClick={() => patch({ times: form.times.filter((_, idx) => idx !== i) })}>Togli</button>
              )}
            </div>
          ))}
          {form.times.length < 8 && (
            <button type="button" className="chip" onClick={() => patch({ times: [...form.times, '12:00'] })}>+ Orario</button>
          )}
        </div>

        <Field label="Dal" id="start_date">
          <input id="start_date" className="input" type="date" value={form.start_date} onChange={(e) => patch({ start_date: e.target.value })} />
        </Field>
        <Field label="Fino al (facoltativo)" id="end_date">
          <input id="end_date" className="input" type="date" min={form.start_date} value={form.end_date} onChange={(e) => patch({ end_date: e.target.value })} />
        </Field>

        <ErrorText>{error}</ErrorText>
        <Button variant="primary" type="submit" block disabled={busy}>
          {busy ? 'Salvo…' : 'Salva promemoria'}
        </Button>
      </div>
    </form>
  )
}
