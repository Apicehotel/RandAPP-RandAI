import { useEffect, useRef, useState } from 'react'
import { HOTELS, apiceLogo } from '../lib/hotels.js'
import { searchUsersAcrossHotels, loginUser, loginAdminPin, loadContext } from '../lib/auth.js'
import { Button, ErrorText, Field, Spinner } from '../ui/kit.jsx'
import { LocalErrors } from './ErrorLog.jsx'
import { testConnection } from '../lib/auth.js'
import ThemeSwitch from '../ui/ThemeSwitch.jsx'
import { can, PERM } from '../lib/permissions.js'
import { requestPinRecovery } from '../data/recovery.js'

export const ADMIN_INTENT_KEY = 'randapp.adminIntent'

const PIN_LENGTH = 4
const ADMIN_PIN_LENGTH = 6
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
  const [adminMode, setAdminMode] = useState(false) // 'Impostazioni': accesso protetto, poi Profilo
  const [forgot, setForgot] = useState('') // '' | 'sending' | 'sent'
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

  // Impostazioni: solo PIN amministratore (6 cifre), come la vecchia app.
  const submitAdmin = async (value) => {
    if (value.length !== ADMIN_PIN_LENGTH) return setError('Inserisci il PIN amministratore (6 cifre)')
    busyRef.current = true
    setBusy(true)
    try {
      const ctx = await loginAdminPin({ pin: value, preferredHotel: initialHotel })
      if (!can(ctx.permissions, PERM.ADMIN)) throw new Error('Accesso amministratore non disponibile')
      try { sessionStorage.setItem(ADMIN_INTENT_KEY, '1') } catch { /* nessun problema */ }
      onLoggedIn(ctx)
    } catch (e) {
      setError(e.message)
      setPin('')
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  const submit = async (value = pin) => {
    if (busyRef.current) return
    setError('')
    if (adminMode) return submitAdmin(value)
    if (!user) return setError(query.trim().length < MIN_QUERY ? 'Scrivi almeno 2 lettere del nome' : 'Seleziona il tuo nome dalla lista')
    if (value.length !== PIN_LENGTH) return setError('Inserisci un PIN di 4 cifre')
    busyRef.current = true
    setBusy(true)
    try {
      const ctx = await loginUser({ user, pin: value, preferredHotel: initialHotel })
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

  const sendRecovery = async () => {
    if (!user) return setError('Scrivi e seleziona prima il tuo nome, poi tocca "PIN dimenticato?"')
    setForgot('sending'); setError('')
    try { await requestPinRecovery(user.id); setForgot('sent') } catch (e) { setError(e.message); setForgot('') }
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
        <div className="login-corner">
          <button type="button" className={`login-gear ${adminMode ? 'is-on' : ''}`} aria-label="Impostazioni" aria-pressed={adminMode} data-testid="open-settings-link"
            title="Impostazioni (accesso amministratore)" onClick={() => { setAdminMode((v) => !v); setError(''); setPin(''); setTimeout(() => pinRef.current?.focus(), 0) }}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
            </svg>
          </button>
          <ThemeSwitch />
        </div>
        <div className="login-brand">
          <img className="brand-logo" src={apiceLogo} alt="ApiceHotel" width="132" height="132" />
          <h1>RandApp</h1>
          <strong>Manutenzione</strong>
          <p className="muted">Gestione e manutenzione delle strutture</p>
        </div>

        <form className="card stack login-card" onSubmit={(e) => { e.preventDefault(); submit() }} autoComplete="off">
          <header>
            {adminMode && <button type="button" className="login-back" data-testid="admin-back" onClick={() => { setAdminMode(false); setError(''); setPin('') }}>‹ RandApp</button>}
            <h2>{adminMode ? 'Impostazioni' : 'Bentornato'}</h2>
            <p className="muted">{adminMode ? 'Accesso protetto amministratore' : 'Accedi per continuare'}</p>
          </header>

          {!adminMode && <Field label="Utente" id="login-user">
            <div className="suggest-wrap">
              <input
                id="login-user" className="input" value={query} placeholder="Scrivi il tuo nome o username" autoComplete="username"
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
          </Field>}

          <Field label={adminMode ? 'PIN amministratore' : 'PIN'} id="login-pin">
            <input
              id="login-pin" ref={pinRef} className="input pin-input" type="password" value={pin} placeholder={adminMode ? '••••••' : '••••'}
              inputMode="numeric" enterKeyHint="go" autoComplete="current-password" maxLength={adminMode ? ADMIN_PIN_LENGTH : PIN_LENGTH} data-testid="login-pin-input"
              onChange={(e) => {
                const max = adminMode ? ADMIN_PIN_LENGTH : PIN_LENGTH
                const next = e.target.value.replace(/\D/g, '').slice(0, max)
                setPin(next)
                setError('')
                if (next.length === max) submit(next)
              }}
            />
          </Field>

          <ErrorText>{error}</ErrorText>
          <Button variant="primary" type="submit" block disabled={busy} data-testid="login-submit">
            {busy ? 'ACCESSO…' : adminMode ? 'ENTRA →' : 'ACCEDI →'}
          </Button>

          {!adminMode && (forgot === 'sent'
            ? <p className="muted" role="status" data-testid="forgot-sent">Se nel tuo profilo c'è un'email, ti abbiamo mandato un link per scegliere un nuovo PIN (vale 15 minuti). Se non hai l'email nel profilo, chiedi a un admin di reimpostare il PIN.</p>
            : <button type="button" className="login-back" data-testid="forgot-pin" disabled={forgot === 'sending'} onClick={sendRecovery}>PIN dimenticato?</button>)}

          <div className="login-tools">
            <Button type="button" onClick={() => setShowLog((v) => !v)}>{showLog ? 'Nascondi errori' : 'Registro errori'}</Button>
            <Button type="button" onClick={async () => { setProbe({ text: 'Provo…' }); setProbe(await testConnection()) }}>Prova collegamento</Button>
          </div>
          {showLog && <LocalErrors />}
          {probe && <p className={probe.ok ? 'muted' : 'error'} role="status">{probe.text}</p>}
        </form>
      </div>
    </div>
  )
}
