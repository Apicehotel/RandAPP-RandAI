import { useState } from 'react'
import { tokenFromRoute } from '../lib/recovery.js'
import { completePinRecovery } from '../data/recovery.js'
import { isValidPin } from '../lib/admin.js'
import { apiceLogo } from '../lib/hotels.js'
import { Button, ErrorText, Field } from '../ui/kit.jsx'

// Email: link monouso. WhatsApp: codice OTP ricevuto e nuovo PIN.
export default function Recover({ route }) {
  const token = tokenFromRoute(route)
  const params = new URLSearchParams(String(route || '').split('?')[1] || '')
  const userId = params.get('user_id') || ''
  const whatsapp = params.get('channel') === 'whatsapp' && /^[0-9a-f-]{36}$/i.test(userId)
  const validRoute = Boolean(token || whatsapp)
  const [otp, setOtp] = useState('')
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
    try { await completePinRecovery(token, pin, whatsapp ? { channel: 'whatsapp', user_id: userId, otp } : {}); setDone(true) } catch (er) { setErr(er.message) } finally { setBusy(false) }
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
          {!validRoute && <p className="error" role="alert">Link non valido. Chiedi un nuovo recupero dalla pagina di accesso.</p>}
          {validRoute && done && <p role="status" data-testid="recover-done">PIN cambiato. Ora puoi accedere con il nuovo PIN.</p>}
          {validRoute && !done && (
            <form className="stack" onSubmit={submit}>
              <p className="muted">Scegli un nuovo PIN di 4 cifre.</p>
              {whatsapp && <Field label="Codice ricevuto su WhatsApp" id="rec-otp">
                <input id="rec-otp" className="input pin-input" type="text" inputMode="numeric" autoComplete="one-time-code"
                  maxLength={6} value={otp} onChange={(e) => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setErr('') }}
                  placeholder="000000" data-testid="recover-otp" required pattern="[0-9]{6}" />
              </Field>}
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
