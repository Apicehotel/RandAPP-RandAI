import { useState } from 'react'
import { tokenFromRoute } from '../lib/recovery.js'
import { completePinRecovery } from '../data/recovery.js'
import { isValidPin } from '../lib/admin.js'
import { apiceLogo } from '../lib/hotels.js'
import { Button, ErrorText, Field } from '../ui/kit.jsx'

// Pagina del link ricevuto per email: si sceglie il nuovo PIN (4 cifre).
export default function Recover({ route }) {
  const token = tokenFromRoute(route)
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!isValidPin(pin)) return setErr('Il PIN deve avere 4 cifre')
    if (pin !== pin2) return setErr('I due PIN non sono uguali')
    setBusy(true); setErr('')
    try { await completePinRecovery(token, pin); setDone(true) } catch (er) { setErr(er.message) } finally { setBusy(false) }
  }
  const digits = (set) => (e) => { set(e.target.value.replace(/\D/g, '').slice(0, 4)); setErr('') }

  return (
    <div className="center">
      <div className="auth-box login">
        <div className="login-brand">
          <img className="brand-logo" src={apiceLogo} alt="ApiceHotel" width="132" height="132" />
          <h1>RandApp</h1>
          <strong>Nuovo PIN</strong>
        </div>
        <div className="card stack login-card">
          {!token && <p className="error" role="alert">Link non valido. Chiedi un nuovo link dalla pagina di accesso.</p>}
          {token && done && <p role="status" data-testid="recover-done">PIN cambiato. Ora puoi accedere con il nuovo PIN.</p>}
          {token && !done && (
            <form className="stack" onSubmit={submit}>
              <p className="muted">Scegli un nuovo PIN di 4 cifre.</p>
              <Field label="Nuovo PIN" id="rec-pin">
                <input id="rec-pin" className="input pin-input" type="password" inputMode="numeric" autoComplete="new-password" maxLength={4}
                  value={pin} onChange={digits(setPin)} placeholder="••••" data-testid="recover-pin" />
              </Field>
              <Field label="Ripeti il PIN" id="rec-pin2">
                <input id="rec-pin2" className="input pin-input" type="password" inputMode="numeric" autoComplete="new-password" maxLength={4}
                  value={pin2} onChange={digits(setPin2)} placeholder="••••" data-testid="recover-pin2" />
              </Field>
              <ErrorText>{err}</ErrorText>
              <Button variant="primary" type="submit" block disabled={busy}>{busy ? 'SALVO…' : 'SALVA PIN →'}</Button>
            </form>
          )}
          <a className="btn" href="#/home" data-testid="recover-home">Vai all'accesso</a>
        </div>
      </div>
    </div>
  )
}
