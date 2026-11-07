import { useState } from 'react'
import { adminPhoneOverview, adminSetPhone } from '../data/profile.js'
import { useAsync } from '../lib/hooks.js'
import { roleLabel } from '../lib/permissions.js'
import { Button, ErrorText, Spinner, formatDate } from '../ui/kit.jsx'
import PhoneField from '../ui/PhoneField.jsx'

const shown = (p) => (p ? p.replace(/^\+39(\d{3})(\d{3})(\d+)$/, '+39 $1 $2 $3') : '')

function PersonRow({ ctx, row, onSaved }) {
  const [value, setValue] = useState(row.phone || '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const save = async () => {
    setBusy(true); setErr(''); setMsg('')
    try {
      const saved = await adminSetPhone(ctx.hotelId, row.auth_user_id, value)
      setValue(saved)
      setMsg(saved ? 'Salvato' : 'Numero tolto')
      onSaved()
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="card stack">
      <div className="row">
        <strong>{row.name}</strong>
        <span className="muted">{roleLabel(row.role)}</span>
      </div>
      <div className="muted">
        {row.phone ? `${shown(row.phone)} · ${row.issues} segnalazioni WhatsApp` : 'Numero mancante'}
      </div>
      <PhoneField value={value} label={`Numero di ${row.name}`} onChange={setValue} />
      <Button onClick={save} disabled={busy || value === (row.phone || '')}>Salva</Button>
      {msg && <p role="status">{msg}</p>}
      <ErrorText>{err}</ErrorText>
    </div>
  )
}

export default function Phones({ ctx }) {
  const { data, error, loading, reload } = useAsync(() => adminPhoneOverview(ctx.hotelId), [ctx.hotelId])
  const people = (data || []).filter((r) => r.kind === 'persona').sort((a, b) => Number(!!a.phone) - Number(!!b.phone) || a.name.localeCompare(b.name))
  const orphans = (data || []).filter((r) => r.kind === 'numero').sort((a, b) => b.issues - a.issues)
  const missing = people.filter((p) => !p.phone).length

  return (
    <div className="page">
      <a href="#/profile">← Profilo</a>
      <h1>Numeri WhatsApp</h1>
      <p className="muted">Quando un numero è assegnato a una persona, le sue segnalazioni WhatsApp mostrano il nome.</p>
      {loading && !data && <Spinner />}
      <ErrorText>{error}</ErrorText>
      {data && (
        <>
          <div className="card"><strong>{missing}</strong> {missing === 1 ? 'persona senza numero' : 'persone senza numero'} su {people.length}</div>
          {people.map((p) => <PersonRow key={p.auth_user_id} ctx={ctx} row={p} onSaved={reload} />)}
          <h2>Numeri non assegnati ({orphans.length})</h2>
          <p className="muted">Hanno scritto su WhatsApp ma nessuna persona ha questo numero.</p>
          {orphans.map((o) => (
            <div key={o.phone} className="card row">
              <strong>{shown(o.phone)}</strong>
              <span className="muted">{o.issues} segnalazioni · ultima {formatDate(o.last_at)}</span>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
