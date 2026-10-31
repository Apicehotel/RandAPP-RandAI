import { logout } from '../lib/auth.js'
import { hotelById } from '../lib/hotels.js'
import { roleLabel } from '../lib/permissions.js'
import { Button } from '../ui/kit.jsx'

export default function Profile({ ctx, onLogout, onSwitchHotel }) {
  return (
    <div className="page">
      <h1>Profilo</h1>
      <div className="card stack">
        <strong>{ctx.name}</strong>
        <span className="muted">{roleLabel(ctx.role)} · {hotelById(ctx.hotelId)?.name}</span>
      </div>

      <div className="card stack">
        <Button onClick={onSwitchHotel}>Cambia struttura</Button>
        <Button variant="danger" onClick={async () => { await logout(); onLogout() }}>Esci</Button>
      </div>
    </div>
  )
}
