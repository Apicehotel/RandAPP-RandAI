import { useState } from 'react'
import { logout } from '../lib/auth.js'
import { hotelById } from '../lib/hotels.js'
import { roleLabel } from '../lib/permissions.js'
import { THEMES, SIZES, getTheme, getSize, setTheme, setSize } from '../lib/ui-prefs.js'
import { Button } from '../ui/kit.jsx'

function Choice({ label, options, value, onPick }) {
  return (
    <div className="stack">
      <span className="muted">{label}</span>
      <div className="chips" role="group" aria-label={label}>
        {options.map((o) => (
          <button key={o.id} className="chip" aria-pressed={value === o.id} onClick={() => onPick(o.id)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function Profile({ ctx, onLogout, onSwitchHotel }) {
  const [theme, setThemeState] = useState(getTheme)
  const [size, setSizeState] = useState(getSize)

  return (
    <div className="page">
      <h1>Profilo</h1>
      <div className="card stack">
        <strong>{ctx.name}</strong>
        <span className="muted">{roleLabel(ctx.role)} · {hotelById(ctx.hotelId)?.name}</span>
      </div>

      <div className="card stack">
        <Choice label="Tema" options={THEMES} value={theme}
          onPick={(v) => { setTheme(v); setThemeState(v) }} />
        <Choice label="Dimensione" options={SIZES} value={size}
          onPick={(v) => { setSize(v); setSizeState(v) }} />
      </div>

      <div className="card stack">
        <Button onClick={onSwitchHotel}>Cambia struttura</Button>
        <Button variant="danger" onClick={async () => { await logout(); onLogout() }}>Esci</Button>
      </div>
    </div>
  )
}
