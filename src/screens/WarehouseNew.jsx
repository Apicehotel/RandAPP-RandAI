import { useState } from 'react'
import { createItem } from '../data/warehouse.js'
import { go } from '../lib/hooks.js'
import { parseAmount } from '../lib/warehouse.js'
import { Button, ErrorText, Field } from '../ui/kit.jsx'

export default function WarehouseNew({ ctx }) {
  const [form, setForm] = useState({ name: '', category: '', unit: 'pz', min: '', location: '', notes: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { setError("Scrivi il nome dell'articolo"); return }
    const min = form.min.trim() === '' ? 0 : parseAmount(form.min)
    if (min === null) { setError('Scorta minima non valida'); return }
    setBusy(true); setError('')
    try {
      const item = await createItem(ctx.hotelId, ctx.userId, {
        name: form.name, category: form.category, unit: form.unit, min_quantity: min,
        location: form.location, notes: form.notes,
      })
      go(`/warehouse/${item.id}`)
    } catch (err) {
      setError(err.message); setBusy(false)
    }
  }

  return (
    <form className="page" onSubmit={submit}>
      <a href="#/warehouse">← Magazzino</a>
      <h1>Nuovo articolo</h1>
      <p className="muted">La giacenza parte da zero: dopo averlo creato registra un carico.</p>
      <div className="card stack">
        <Field label="Nome" id="name"><input id="name" className="input" value={form.name} onChange={set('name')} maxLength={120} autoFocus /></Field>
        <Field label="Categoria (facoltativa)" id="category"><input id="category" className="input" value={form.category} onChange={set('category')} maxLength={60} placeholder="es. Idraulica, Elettrico, Pulizia" /></Field>
        <Field label="Unità" id="unit"><input id="unit" className="input" value={form.unit} onChange={set('unit')} maxLength={12} placeholder="pz, kg, lt, conf." /></Field>
        <Field label="Scorta minima (avvisa sotto questo valore)" id="min"><input id="min" className="input" inputMode="decimal" value={form.min} onChange={set('min')} /></Field>
        <Field label="Ubicazione (facoltativa)" id="location"><input id="location" className="input" value={form.location} onChange={set('location')} maxLength={80} placeholder="es. Magazzino piano -1, scaffale B" /></Field>
        <Field label="Note (facoltative)" id="notes"><textarea id="notes" className="textarea" value={form.notes} onChange={set('notes')} maxLength={500} /></Field>
        <ErrorText>{error}</ErrorText>
        <Button variant="primary" type="submit" block disabled={busy}>{busy ? 'Salvo…' : 'Crea articolo'}</Button>
      </div>
    </form>
  )
}
