import { useState } from 'react'
import { getMyPhone, setMyPhone } from '../data/profile.js'
import { useAsync } from '../lib/hooks.js'
import { logout } from '../lib/auth.js'
import { hotelById } from '../lib/hotels.js'
import { roleLabel } from '../lib/permissions.js'
import { Button, ErrorText, Spinner } from '../ui/kit.jsx'

function MyPhone() {
  const { data, loading, error } = useAsync(() => getMyPhone(), [])
  const [value, setValue] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const shown = value ?? data ?? ''

  const save = async () => {
    setBusy(true); setErr(''); setMsg('')
    try {
      const saved = await setMyPhone(shown)
      setValue(saved)
      setMsg(saved ? 'Numero salvato. Le segnalazioni che hai mandato su WhatsApp ora sono a tuo nome.' : 'Numero tolto.')
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card stack">
      <h2>Il mio numero WhatsApp</h2>
      <p className="muted">Serve per riconoscerti quando scrivi su WhatsApp: le segnalazioni compaiono con il tuo nome. Lo vedi solo tu.</p>
      {loading && <Spinner />}
      <ErrorText>{error}</ErrorText>
      <input className="input" type="tel" inputMode="tel" autoComplete="tel" placeholder="+39 340 1234567"
        value={shown} onChange={(e) => { setValue(e.target.value); setMsg('') }} aria-label="Il mio numero WhatsApp" />
      <Button variant="primary" disabled={busy} onClick={save}>Salva numero</Button>
      <ErrorText>{err}</ErrorText>
      {msg && <p role="status">{msg}</p>}
    </div>
  )
}

export default function Profile({ ctx, onLogout, onSwitchHotel }) {
  return (
    <div className="page">
      <h1>Profilo</h1>
      <div className="card stack">
        <strong>{ctx.name}</strong>
        <span className="muted">{roleLabel(ctx.role)} · {hotelById(ctx.hotelId)?.name}</span>
      </div>

      <MyPhone />

      <div className="card stack">
        <Button onClick={onSwitchHotel}>Cambia struttura</Button>
        <Button variant="danger" onClick={async () => { await logout(); onLogout() }}>Esci</Button>
      </div>
    </div>
  )
}
