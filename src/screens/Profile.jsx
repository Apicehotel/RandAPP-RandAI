import { useState } from 'react'
import { getMyPhone, setMyPhone } from '../data/profile.js'
import { getMyEmail, setMyEmail } from '../data/recovery.js'
import { isValidEmail, normalizeEmail } from '../lib/recovery.js'
import { useAsync } from '../lib/hooks.js'
import { logout } from '../lib/auth.js'
import { hotelById } from '../lib/hotels.js'
import { roleLabel, can, PERM } from '../lib/permissions.js'
import { Button, ErrorText, Spinner } from '../ui/kit.jsx'
import PhoneField from '../ui/PhoneField.jsx'

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
      <PhoneField value={shown} label="Il mio numero WhatsApp" onChange={(v) => { setValue(v); setMsg('') }} />
      <Button variant="primary" disabled={busy} onClick={save}>Salva numero</Button>
      <ErrorText>{err}</ErrorText>
      {msg && <p role="status">{msg}</p>}
    </div>
  )
}

function MyEmail() {
  const { data, loading, error } = useAsync(() => getMyEmail(), [])
  const [value, setValue] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const shown = value ?? data ?? ''

  const save = async () => {
    if (shown.trim() && !isValidEmail(shown)) return setErr('Email non valida')
    setBusy(true); setErr(''); setMsg('')
    try {
      const saved = await setMyEmail(normalizeEmail(shown))
      setValue(saved)
      setMsg(saved ? 'Email salvata. Se dimentichi il PIN ti arriva il link qui.' : 'Email tolta.')
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="card stack">
      <h2>La mia email</h2>
      <p className="muted">Serve solo per recuperare il PIN se lo dimentichi. La vedi solo tu.</p>
      {loading && <Spinner />}
      <ErrorText>{error}</ErrorText>
      <input className="input" type="email" inputMode="email" autoComplete="email" placeholder="nome@esempio.it"
        value={shown} onChange={(e) => { setValue(e.target.value); setMsg('') }} aria-label="La mia email" />
      <Button variant="primary" disabled={busy} onClick={save}>Salva email</Button>
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
      <MyEmail />

      {can(ctx.permissions, PERM.ADMIN) && (
        <div className="card stack">
          <h2>Impostazioni admin</h2>
          <p className="muted">Utenti e PIN, ruoli, notifiche WhatsApp, consumi, diagnostica.</p>
          <a className="btn" href="#/settings">Apri impostazioni</a>
          <a href="#/phones">Numeri WhatsApp non assegnati</a>
        </div>
      )}

      <div className="card stack">
        <h2>Registro errori</h2>
        <p className="muted">Se qualcosa non funziona, qui vedi la causa.</p>
        <a className="btn" href="#/errors">Apri registro errori</a>
      </div>

      <div className="card stack">
        <Button onClick={onSwitchHotel}>Cambia struttura</Button>
        <Button variant="danger" onClick={async () => { await logout(); onLogout() }}>Esci</Button>
      </div>
    </div>
  )
}
