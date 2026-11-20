import { useState } from 'react'
import { listTechnicians, listCompetencies, saveTechnician } from '../data/technicians.js'
import { useAsync } from '../lib/hooks.js'
import { can, PERM } from '../lib/permissions.js'
import { Badge, Button, ErrorText, Spinner } from '../ui/kit.jsx'

const EMPTY = { id: '', name: '', phone: '', company: '', email: '', notes: '', active: true, competencyIds: [] }
const shown = (p) => (p ? p.replace(/^\+39(\d{3})(\d{3})(\d+)$/, '+39 $1 $2 $3') : '')

function TechnicianForm({ ctx, draft, competencies, onClose, onSaved }) {
  const [t, setT] = useState(draft)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const toggle = (id) => setT((x) => ({ ...x, competencyIds: x.competencyIds.includes(id) ? x.competencyIds.filter((c) => c !== id) : [...x.competencyIds, id] }))
  const save = async () => {
    setBusy(true)
    setError('')
    try { await saveTechnician(ctx.hotelId, t); await onSaved(); onClose() } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return (
    <div className="card stack">
      <h2>{t.id ? 'Modifica tecnico' : 'Nuovo tecnico'}</h2>
      <label className="stack"><span className="muted">Nome</span><input className="input" maxLength={80} value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} /></label>
      <label className="stack"><span className="muted">Telefono WhatsApp</span><input className="input" inputMode="tel" placeholder="+39…" value={t.phone} onChange={(e) => setT({ ...t, phone: e.target.value })} /></label>
      <label className="stack"><span className="muted">Azienda</span><input className="input" maxLength={80} value={t.company} onChange={(e) => setT({ ...t, company: e.target.value })} /></label>
      <label className="stack"><span className="muted">Email</span><input className="input" type="email" maxLength={120} value={t.email} onChange={(e) => setT({ ...t, email: e.target.value })} /></label>
      <label className="stack"><span className="muted">Note</span><textarea className="textarea" rows="2" maxLength={500} value={t.notes} onChange={(e) => setT({ ...t, notes: e.target.value })} /></label>
      <div className="stack"><span className="muted">Competenze</span>
        <div className="chips">{competencies.map((c) => <button type="button" key={c.id} className="chip" aria-pressed={t.competencyIds.includes(c.id)} onClick={() => toggle(c.id)}>{c.label}</button>)}</div></div>
      <label className="row"><span>Attivo</span><input type="checkbox" checked={t.active} onChange={(e) => setT({ ...t, active: e.target.checked })} /></label>
      <div className="row">
        <Button disabled={busy} onClick={onClose}>Annulla</Button>
        <Button variant="primary" disabled={busy || !t.name.trim() || !t.phone.trim()} onClick={save}>{busy ? 'Salvo…' : 'Salva'}</Button>
      </div>
      <ErrorText>{error}</ErrorText>
    </div>
  )
}

export default function Technicians({ ctx }) {
  const { data, error, loading, reload } = useAsync(() => listTechnicians(ctx.hotelId), [ctx.hotelId])
  const { data: competencies } = useAsync(() => listCompetencies(), [])
  const [editing, setEditing] = useState(null)
  const canManage = can(ctx.permissions, PERM.TECHNICIANS_MANAGE)
  const label = (id) => (competencies || []).find((c) => c.id === id)?.label

  return (
    <div className="page">
      <div className="row">
        <h1>Tecnici</h1>
        {canManage && !editing && <Button variant="primary" onClick={() => setEditing({ ...EMPTY })}>+ Nuovo</Button>}
      </div>
      <p className="muted">Tecnici esterni della struttura. Per chiamarne uno apri la segnalazione e scegli «Assegna tecnico».</p>

      {editing && <TechnicianForm ctx={ctx} draft={editing} competencies={competencies || []} onClose={() => setEditing(null)} onSaved={reload} />}

      {loading && !data && <Spinner />}
      <ErrorText>{error}</ErrorText>
      <div className="list">
        {(data || []).map((t) => (
          <div key={t.id} className="card stack">
            <div className="row">
              <strong>{t.name}</strong>
              <Badge kind={t.active ? 'completata' : 'da_fare'}>{t.active ? 'Attivo' : 'Disattivato'}</Badge>
            </div>
            <div className="muted">{[t.company, shown(t.phone)].filter(Boolean).join(' · ')}</div>
            <div className="muted">{t.competencyIds.map(label).filter(Boolean).join(' · ') || 'Competenze da impostare'}</div>
            <div className="row">
              <a className="btn" href={`https://wa.me/${t.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
              {canManage && <Button onClick={() => setEditing({ ...EMPTY, ...t, company: t.company || '', email: t.email || '', notes: t.notes || '' })}>Modifica</Button>}
            </div>
          </div>
        ))}
        {data && data.length === 0 && <div className="card muted">Nessun tecnico per questa struttura.</div>}
      </div>
    </div>
  )
}
