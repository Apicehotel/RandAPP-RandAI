import { useEffect, useState } from 'react'
import { getMyPhone, setMyPhone } from '../data/profile.js'
import { Button, ErrorText } from './kit.jsx'

const SKIP_DAYS = 7
const skipKey = (userId) => `randapp.phoneSkip.${userId}`
const skipped = (userId) => {
  try {
    const at = Number(localStorage.getItem(skipKey(userId)))
    return at > 0 && Date.now() - at < SKIP_DAYS * 86400000
  } catch { return false }
}

// Dopo l'accesso, chi non ha ancora il numero WhatsApp lo scrive da solo (così le sue segnalazioni WhatsApp hanno il suo nome).
// "Più tardi" lo nasconde per 7 giorni. Se non si riesce a leggere il numero non si mostra niente.
export default function PhonePrompt({ ctx }) {
  const [state, setState] = useState('hidden') // hidden | ask | done
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    let alive = true
    if (skipped(ctx.userId)) return undefined
    getMyPhone().then((p) => { if (alive && !p) setState('ask') }).catch(() => {})
    return () => { alive = false }
  }, [ctx.userId])

  if (state === 'hidden') return null
  if (state === 'done') return <div className="card" role="status">Numero salvato. Grazie!</div>

  const save = async (e) => {
    e.preventDefault()
    if (!value.trim()) return setErr('Scrivi il tuo numero')
    setBusy(true); setErr('')
    try { await setMyPhone(value); setState('done') } catch (er) { setErr(er.message) } finally { setBusy(false) }
  }
  const later = () => {
    try { localStorage.setItem(skipKey(ctx.userId), String(Date.now())) } catch { /* nessun problema */ }
    setState('hidden')
  }

  return (
    <form className="card stack" onSubmit={save} data-testid="phone-prompt">
      <h2>Il tuo numero WhatsApp</h2>
      <p className="muted">Scrivilo una volta: quando mandi una segnalazione su WhatsApp comparirai con il tuo nome. Lo vedi solo tu e gli admin.</p>
      <input className="input" type="tel" inputMode="tel" autoComplete="tel" placeholder="+39 340 1234567" value={value}
        onChange={(e) => setValue(e.target.value)} aria-label="Il mio numero WhatsApp" />
      <ErrorText>{err}</ErrorText>
      <div className="row" style={{ gap: 8 }}>
        <Button variant="primary" type="submit" disabled={busy}>Salva</Button>
        <Button type="button" onClick={later}>Più tardi</Button>
      </div>
    </form>
  )
}
