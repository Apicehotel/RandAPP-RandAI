import { useState } from 'react'
import { bottomNavFor, initialsFor, isActivePath } from '../lib/permissions.js'
import { hotelById } from '../lib/hotels.js'
import { FEATURES } from '../app/features.js'
import { logout } from '../lib/auth.js'
import Drawer from './Drawer.jsx'
import { Icon } from './kit.jsx'

// Unica fonte del "chrome" dell'app: nessuna schermata costruisce la propria barra.
// In alto: struttura a sinistra, cerchio del profilo a destra. In basso: 5 sezioni.
export default function Shell({ route, ctx, onLogout, onSwitchHotel, children }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const items = bottomNavFor(ctx.permissions, { randai: FEATURES.randai })
  const hotel = hotelById(ctx.hotelId)
  const hotelName = hotel?.name || ctx.hotelId

  return (
    <div className="shell">
      <header className="shell-top">
        <span className="hotel-chip">
          {hotel?.logo ? <img src={hotel.logo} alt="" width="28" height="28" /> : <Icon name="building" size={18} />}
          <span>{hotelName}</span>
        </span>
        <button
          type="button"
          className="avatar"
          aria-label={`Apri il menu di ${ctx.name || 'profilo'}`}
          onClick={() => setMenuOpen(true)}
        >
          {initialsFor(ctx.name)}
        </button>
      </header>

      <main className="shell-stage">{children}</main>

      <nav className="shell-nav" aria-label="Navigazione principale" data-count={items.length}>
        {items.map((item) => {
          const active = isActivePath(item, route)
          const cls = `nav-item${item.center ? ' nav-home' : ''}`
          const inner = (
            <>
              <span className="ico"><Icon name={item.icon} /></span>
              <span className="lbl">{item.label}</span>
            </>
          )
          return item.action === 'menu' ? (
            <button key={item.id} type="button" className={cls} onClick={() => setMenuOpen(true)}>{inner}</button>
          ) : (
            <a key={item.id} href={`#${item.path}`} className={cls} aria-current={active ? 'page' : undefined}>
              {inner}
            </a>
          )
        })}
      </nav>

      <Drawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        ctx={ctx}
        route={route}
        onSwitchHotel={onSwitchHotel}
        onLogout={async () => { await logout(); onLogout() }}
      />
    </div>
  )
}
