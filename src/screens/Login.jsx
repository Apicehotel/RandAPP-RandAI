import { useEffect, useRef, useState } from 'react'
import { HOTELS, apiceLogo } from '../lib/hotels.js'
import { searchUsersAcrossHotels, loginUser, loadContext } from '../lib/auth.js'
import { Button, ErrorText, Field, Spinner } from '../ui/kit.jsx'
import { LocalErrors } from './ErrorLog.jsx'
import { testConnection } from '../lib/auth.js'
import Appearance from '../ui/Appearance.jsx'

export const ADMIN_INTENT_KEY = 'randapp.adminIntent'

const PIN_LENGTH = 4
const MIN_QUERY = 2
const norm = (s) => String(s || '').trim().toLocaleLowerCase('it')

// Schermata unica come nella vecchia app: Utente + PIN (4 cifre, entra da solo), poi — se hai più strutture — la scelta della struttura.
export default function Login({ initialHotel, onLoggedIn }) {
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState([])
  const [searching, setSearching] = useState(false)
  const [user, setUser] = useState(null)
  const [open, setOpen] = useState(false)
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [picking, setPicking] = useState(null) // { user, ctx }
  const [showLog, setShowLog] = useState(false)
  const [probe, setProbe] = useState(null)
  const [gear, setGear] = useState(false)
  const [adminIntent, setAdminIntent] = useState(false)
  const busyRef = useRef(false)
  const pinRef = useRef(null)

  // Ricerca nome con piccola attesa, per non chiamare il server a ogni lettera.
  useEffect(() => {
    if (user || query.trim().length < MIN_QUERY) {
      if (!user) setUsers([])
      return undefined
    }
    let cancelled = false
    const timer = setTimeout(async () => {
      setSearching(true)
      setError('')
      try {
        const found = await searchUsersAcrossHotels(query.trim())
        if (!cancelled) setUsers(found)
      } catch (e) {
        if (!cancelled) setError(e.message)
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, 300)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [query, user])

  const suggestions = user ? [] : users.filter((u) => norm(u.name).startsWith(norm(query))).slice(0, 6)

  const pick = (u) => {
    setUser(u)
    setQuery(u.name)
    setOpen(false)
    setError('')
    setTimeout(() => pinRef.current?.focus(), 0)
  }

  const submit = async (value = pin) => {
    if (busyRef.current) return
    setError('')
    if (!user) return setError(query.trim().length < MIN_QUERY ? 'Scrivi almeno 2 lettere del nome' : 'Seleziona il tuo nome dalla lista')
    if (value.length !== PIN_LENGTH) return setError('Inserisci un PIN di 4 cifre')
    busyRef.current = true
    setBusy(true)
    try {
      const ctx = await loginUser({ user, pin: value, preferredHotel: initialHotel })
      if (adminIntent) { try { sessionStorage.setItem(ADMIN_INTENT_KEY, '1') } catch { /* nessun problema */ } }
      if (user.hotels.length > 1) setPicking({ user, ctx })
      else onLoggedIn(ctx)
    } catch (e) {
      setError(e.message)
      setPin('')
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  const enter = async (hotelId) => {
    setBusy(true)
    setError('')
    try {
      const ctx = hotelId === picking.ctx.hotelId ? picking.ctx : await loadContext(hotelId)
      if (!ctx) throw new Error('Non hai accesso a questa struttura')
      onLoggedIn(ctx)
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  if (picking) {
    const hotels = HOTELS.filter((h) => picking.user.hotels.includes(h.id))
    return (
      <div className="center">
        <div className="auth-box">
          <img className="brand-logo" src={apiceLogo} alt="ApiceHotel" width="132" height="132" />
          <h1>Ciao {picking.user.name.split(' ')[0]}</h1>
          <p className="muted">Scegli la struttura con cui vuoi lavorare</p>
          <div className="hotels">
            {hotels.map((h) => (
              <button key={h.id} type="button" className="hotel-pick" disabled={busy} onClick={() => enter(h.id)}>
                <img src={h.logo} alt="" width="56" height="56" />
                <span>{h.name}</span>
              </button>
            ))}
          </div>
          <ErrorText>{error}</ErrorText>
        </div>
      </div>
    )
  }

  return (
    <div className="center">
      <div className="auth-box login">
        <button type="button" className="login-gear" aria-label="Impostazioni" aria-expanded={gear} data-testid="login-gear" onClick={() => setGear((v) => !v)}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3.2" /><path d="M12 3v2.5M12 18.5V21M21 12h-2.5M5.5 12H3M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8M18.4 18.4l-1.8-1.8M7.4 7.4 5.6 5.6" />
          </svg>
        </button>
        {gear && (
          <section className="card stack login-gear-panel" data-testid="login-gear-panel">
            <h3>Impostazioni</h3>
            <label className="login-admin">
              <input type="checkbox" checked={adminIntent} onChange={(e) => setAdminIntent(e.target.checked)} />
              <span><b>Accesso admin</b><small>Dopo il PIN ti porto al Profilo, con le impostazioni di amministrazione</small></span>
            </label>
          </section>
        )}
        <div className="login-brand">
          <img className="brand-logo" src={apiceLogo} alt="ApiceHotel" width="132" height="132" />
          <h1>RandApp</h1>
          <strong>Manutenzione</strong>
          <p className="muted">Gestione e manutenzione delle strutture</p>
        </div>

        <form className="card stack login-card" onSubmit={(e) => { e.preventDefault(); submit() }} autoComplete="off">
          <header>
            <h2>Bentornato</h2>
            <p className="muted">Accedi per continuare</p>
          </header>

          <Field label="Utente" id="login-user">
            <div className="suggest-wrap">
              <input
                id="login-user" className="input" value={query} placeholder="Scrivi il tuo nome" autoComplete="username"
                autoCapitalize="words" data-testid="login-user-input"
                onFocus={() => setOpen(true)}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                onChange={(e) => { setQuery(e.target.value); setUser(null); setError(''); setOpen(true) }}
              />
              {searching && <Spinner />}
              {open && suggestions.length > 0 && (
                <ul className="suggest" data-testid="login-suggestions">
                  {suggestions.map((u) => (
                    <li key={u.id}>
                      <button type="button" onMouseDown={(ev) => { ev.preventDefault(); pick(u) }} onClick={() => pick(u)}>
                        <b>{u.name}</b>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {!searching && !user && query.trim().length >= MIN_QUERY && users.length === 0 && !error && (
              <small className="muted">Nessun utente trovato.</small>
            )}
          </Field>

          <Field label="PIN" id="login-pin">
            <input
              id="login-pin" ref={pinRef} className="input pin-input" type="password" value={pin} placeholder="••••"
              inputMode="numeric" enterKeyHint="go" autoComplete="current-password" maxLength={PIN_LENGTH} data-testid="login-pin-input"
              onChange={(e) => {
                const next = e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH)
                setPin(next)
                setError('')
                if (next.length === PIN_LENGTH) submit(next)
              }}
            />
          </Field>

          <ErrorText>{error}</ErrorText>
          <Button variant="primary" type="submit" block disabled={busy} data-testid="login-submit">
            {busy ? 'ACCESSO…' : 'ACCEDI →'}
          </Button>

          <div className="login-divider"><span>oppure</span></div>
          <div className="login-tools">
            <Button type="button" onClick={() => setShowLog((v) => !v)}>{showLog ? 'Nascondi errori' : 'Registro errori'}</Button>
            <Button type="button" onClick={async () => { setProbe({ text: 'Provo…' }); setProbe(await testConnection()) }}>Prova collegamento</Button>
          </div>
          {showLog && <LocalErrors />}
          {probe && <p className={probe.ok ? 'muted' : 'error'} role="status">{probe.text}</p>}
        </form>

        <Appearance />
      </div>
    </div>
  )
}
