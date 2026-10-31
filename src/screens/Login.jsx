import { useEffect, useState } from 'react'
import { HOTELS } from '../lib/hotels.js'
import { searchUsers, loginWithPin } from '../lib/auth.js'
import { Button, ErrorText, Spinner } from '../ui/kit.jsx'

const PIN_LENGTH = 4
const MIN_QUERY = 2

// Passi: struttura -> nome -> PIN
export default function Login({ initialHotel, onLoggedIn }) {
  const [hotelId, setHotelId] = useState(initialHotel || null)
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState([])
  const [searching, setSearching] = useState(false)
  const [user, setUser] = useState(null)
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Ricerca nome con piccola attesa, per non chiamare il server a ogni lettera.
  useEffect(() => {
    if (!hotelId || user) return undefined
    if (query.trim().length < MIN_QUERY) {
      setUsers([])
      return undefined
    }
    let cancelled = false
    const timer = setTimeout(async () => {
      setSearching(true)
      setError('')
      try {
        const found = await searchUsers(hotelId, query.trim())
        if (!cancelled) setUsers(found)
      } catch (e) {
        if (!cancelled) setError(e.message)
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [hotelId, query, user])

  const submit = async (value) => {
    setBusy(true)
    setError('')
    try {
      const ctx = await loginWithPin({ hotelId, userId: user.id, pin: value })
      if (!ctx) throw new Error('Accesso alla struttura non consentito')
      onLoggedIn(ctx)
    } catch (e) {
      setError(e.message)
      setPin('')
      setBusy(false)
    }
  }

  const press = (digit) => {
    if (busy || pin.length >= PIN_LENGTH) return
    const next = pin + digit
    setPin(next)
    if (next.length === PIN_LENGTH) submit(next)
  }

  const reset = () => {
    setUser(null)
    setPin('')
    setError('')
  }

  if (!hotelId) {
    return (
      <div className="center">
        <div className="auth-box">
          <h1>RandApp</h1>
          <p className="muted">Scegli la struttura</p>
          <div className="hotels">
            {HOTELS.map((h) => (
              <Button key={h.id} onClick={() => setHotelId(h.id)}>{h.name}</Button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="center">
        <div className="auth-box">
          <h1>Chi sei?</h1>
          <input
            className="input"
            autoFocus
            autoComplete="off"
            placeholder="Scrivi le prime lettere del tuo nome"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Nome"
          />
          {searching && <Spinner />}
          <div className="hotels">
            {users.map((u) => (
              <Button key={u.id} onClick={() => setUser(u)}>{u.name}</Button>
            ))}
          </div>
          {!searching && query.trim().length >= MIN_QUERY && users.length === 0 && !error && (
            <p className="muted">Nessun utente trovato.</p>
          )}
          <ErrorText>{error}</ErrorText>
          <Button variant="" onClick={() => setHotelId(null)}>Cambia struttura</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="center">
      <div className="auth-box">
        <h1>Ciao {user.name}</h1>
        <p className="muted">Inserisci il PIN</p>
        <div className="pin-dots" aria-label={`${pin.length} cifre inserite su ${PIN_LENGTH}`}>
          {Array.from({ length: PIN_LENGTH }, (_, i) => (
            <span key={i} className={i < pin.length ? 'on' : ''} />
          ))}
        </div>
        <ErrorText>{error}</ErrorText>
        <div className="pad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button key={d} type="button" onClick={() => press(d)} disabled={busy}>{d}</button>
          ))}
          <button type="button" onClick={reset} disabled={busy} aria-label="Indietro">←</button>
          <button type="button" onClick={() => press('0')} disabled={busy}>0</button>
          <button type="button" onClick={() => setPin((p) => p.slice(0, -1))} disabled={busy} aria-label="Cancella">⌫</button>
        </div>
        {busy && <Spinner />}
      </div>
    </div>
  )
}
