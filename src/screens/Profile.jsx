import { useState } from 'react'
import { getMyPhone, setMyPhone, getMyProfile, setMyProfile } from '../data/profile.js'
import { getMyEmail, setMyEmail } from '../data/recovery.js'
import { isValidEmail, normalizeEmail } from '../lib/recovery.js'
import { normalizeName, normalizeUsername, profileError } from '../lib/profile.js'
import { useAsync } from '../lib/hooks.js'
import { logout } from '../lib/auth.js'
import { hotelById } from '../lib/hotels.js'
import { roleLabel, can, PERM } from '../lib/permissions.js'
import { Button, ErrorText, Spinner } from '../ui/kit.jsx'
import PhoneField from '../ui/PhoneField.jsx'

function MyData() {
  const { data, loading, error } = useAsync(async () => {
    const [prof, phone, email] = await Promise.all([getMyProfile(), getMyPhone(), getMyEmail()])
    return { ...prof, phone, email }
  }, [])
  const [f, setF] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const v = f ?? data
  const set = (k) => (e) => { setF({ ...v, [k]: typeof e === 'string' ? e : e.target.value }); setMsg('') }

  const save = async () => {
    const problem = profileError(v, isValidEmail)
    if (problem) return setErr(problem)
    setBusy(true); setErr(''); setMsg('')
    try {
      const prof = await setMyProfile({ username: normalizeUsername(v.username), firstName: normalizeName(v.firstName), lastName: normalizeName(v.lastName) })
      const phone = await setMyPhone(v.phone)
      const email = await setMyEmail(normalizeEmail(v.email))
      setF({ ...prof, phone, email })
      setMsg('Dati salvati. Le segnalazioni che hai mandato su WhatsApp con questo numero ora sono a tuo nome.')
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="card stack">
      <h2>I miei dati</h2>
      <p className="muted">Li vedi solo tu (e gli admin per il numero). Il nome con cui accedi non cambia.</p>
      {loading && <Spinner />}
      <ErrorText>{error}</ErrorText>
      {v && (
        <>
          <label className="field"><span>Username</span>
            <input className="input" autoCapitalize="none" autoCorrect="off" autoComplete="username" placeholder="es. mario.rossi"
              value={v.username} onChange={set('username')} aria-label="Username" />
          </label>
          <label className="field"><span>Nome</span>
            <input className="input" autoComplete="given-name" value={v.firstName} onChange={set('firstName')} aria-label="Nome" />
          </label>
          <label className="field"><span>Cognome</span>
            <input className="input" autoComplete="family-name" value={v.lastName} onChange={set('lastName')} aria-label="Cognome" />
          </label>
          <div className="field"><span>Numero WhatsApp</span>
            <PhoneField value={v.phone} label="Il mio numero WhatsApp" onChange={set('phone')} />
          </div>
          <label className="field"><span>Email</span>
            <input className="input" type="email" inputMode="email" autoComplete="email" placeholder="nome@esempio.it"
              value={v.email} onChange={set('email')} aria-label="La mia email" />
            <small className="muted">Serve per recuperare il PIN se lo dimentichi.</small>
          </label>
          <Button variant="primary" disabled={busy} onClick={save}>Salva i miei dati</Button>
        </>
      )}
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

      <MyData />

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
