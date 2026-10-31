import { useState } from 'react'
import { createSensor } from '../data/sensors.js'
import { go } from '../lib/hooks.js'
import { SENSOR_KINDS, optionalNumber } from '../lib/sensors.js'
import { Button, ErrorText, Field } from '../ui/kit.jsx'

export default function SensorNew({ ctx }) {
  const [form, setForm] = useState({ name: '', device_key: '', kind: 'temperatura', min: '', max: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.device_key.trim()) { setError('Nome e codice dispositivo sono obbligatori'); return }
    const min = optionalNumber(form.min)
    const max = optionalNumber(form.max)
    if (min === undefined || max === undefined) { setError('Soglie non valide'); return }
    if (min !== null && max !== null && min > max) { setError('La soglia minima supera la massima'); return }
    setBusy(true); setError('')
    try {
      await createSensor(ctx.hotelId, ctx.userId, { name: form.name, device_key: form.device_key, kind: form.kind, alert_min: min, alert_max: max })
      go('/sensors')
    } catch (err) { setError(err.message); setBusy(false) }
  }

  return (
    <form className="page" onSubmit={submit}>
      <a href="#/sensors">← Sensori e impianti</a>
      <h1>Nuovo sensore</h1>
      <div className="card stack">
        <Field label="Nome" id="name"><input id="name" className="input" value={form.name} onChange={set('name')} maxLength={80} placeholder="es. Cella frigo cucina" autoFocus /></Field>
        <Field label="Codice dispositivo" id="key"><input id="key" className="input" value={form.device_key} onChange={set('device_key')} maxLength={80} placeholder="id del dispositivo eWeLink" /></Field>
        <div className="chips" role="group" aria-label="Tipo">
          {SENSOR_KINDS.map((k) => (
            <button key={k.id} type="button" className="chip" aria-pressed={form.kind === k.id} onClick={() => setForm((f) => ({ ...f, kind: k.id }))}>{k.label}</button>
          ))}
        </div>
        {form.kind === 'temperatura' && (
          <>
            <Field label="Allerta sotto (°C, facoltativa)" id="min"><input id="min" className="input" inputMode="decimal" value={form.min} onChange={set('min')} /></Field>
            <Field label="Allerta sopra (°C, facoltativa)" id="max"><input id="max" className="input" inputMode="decimal" value={form.max} onChange={set('max')} /></Field>
          </>
        )}
        <ErrorText>{error}</ErrorText>
        <Button variant="primary" type="submit" block disabled={busy}>{busy ? 'Salvo…' : 'Aggiungi sensore'}</Button>
      </div>
    </form>
  )
}
