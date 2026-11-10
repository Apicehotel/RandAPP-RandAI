import { Suspense, lazy, useEffect, useState } from 'react'
import { bottomNavFor, initialsFor, isActivePath } from '../lib/permissions.js'
import { hotelById } from '../lib/hotels.js'
import { logout } from '../lib/auth.js'
import Drawer from './Drawer.jsx'
import HotelPicker from './HotelPicker.jsx'
import { countUnread } from '../data/notifications.js'
import { useUnread } from '../lib/hooks.js'
import { badgeText } from '../lib/notifications.js'
import { Icon } from './kit.jsx'
import OutboxBanner from './OutboxBanner.jsx'

const UrgentAlert = lazy(() => import('./UrgentAlert.jsx')) // a richiesta: non pesa sull'avvio
const RoomReadyAlert = lazy(() => import('./RoomReadyAlert.jsx'))
import { applyPalette } from '../lib/palette.js'
import { useKeyboardOpen } from '../lib/use-keyboard.js'

// Unica fonte del "chrome" dell'app: nessuna schermata costruisce la propria barra.
// In alto: struttura a sinistra, cerchio del profilo a destra. In basso: 5 sezioni.
export default function Shell({ route, ctx, onLogout, onSwitchHotel, onChangeHotel, children }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const items = bottomNavFor(ctx.permissions)
  const hotel = hotelById(ctx.hotelId)
  const hotelName = hotel?.name || ctx.hotelId
  const keyboard = useKeyboardOpen()
  // Ogni struttura ha la sua palette: cambia con la struttura scelta.
  useEffect(() => { applyPalette(ctx.hotelId) }, [ctx.hotelId])
  const unread = useUnread(() => countUnread(ctx.hotelId, ctx.userId), [ctx.hotelId, ctx.userId])

  return (
    <div className={`shell${keyboard ? ' kb' : ''}`}>
      <header className="shell-top">
        <button
          type="button"
          className="hotel-chip"
          aria-haspopup="dialog"
          aria-label={`Struttura: ${hotelName}. Tocca per cambiare`}
          onClick={() => setPickerOpen(true)}
        >
          {hotel?.logo ? <img src={hotel.logo} alt="" width="28" height="28" /> : <Icon name="building" size={18} />}
          <span>{hotelName}</span>
          <Icon name="chevron" size={16} />
        </button>
        <div className="top-right">
        <a href="#/notifications" className="bellbtn" aria-label={unread ? `Notifiche: ${unread} non lette` : 'Notifiche'}>
          <Icon name="bell" size={20} />
          {unread > 0 && <span className="bell-badge">{badgeText(unread)}</span>}
        </a>
        <button
          type="button"
          className="avatar"
          aria-haspopup="dialog"
          aria-label={`Apri il menu di ${ctx.name || 'profilo'}`}
          onClick={() => setMenuOpen(true)}
        >
          {initialsFor(ctx.name)}
        </button>
        </div>
      </header>

      <Suspense fallback={null}><UrgentAlert ctx={ctx} /><RoomReadyAlert ctx={ctx} /></Suspense>
      <OutboxBanner ctx={ctx} />
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
          return (
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
        onSwitchHotel={() => setPickerOpen(true)}
        onLogout={async () => { await logout(); onLogout() }}
      />
      <HotelPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        currentId={ctx.hotelId}
        onChange={onChangeHotel}
        onOtherUser={() => { setPickerOpen(false); onSwitchHotel() }}
      />
    </div>
  )
}
