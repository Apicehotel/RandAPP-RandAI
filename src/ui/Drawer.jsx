import { useEffect, useRef } from 'react'
import { initialsFor, menuGroupsFor, roleLabel } from '../lib/permissions.js'
import { hotelById } from '../lib/hotels.js'
import { Icon } from './kit.jsx'

// Menu laterale che si apre dal cerchio del profilo (o dal pulsante "Altro").
export default function Drawer({ open, onClose, ctx, route, onSwitchHotel, onLogout }) {
  const closeRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    closeRef.current?.focus()
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  const groups = menuGroupsFor(ctx.permissions)

  return (
    <div className="drawer-wrap">
      <button type="button" className="drawer-scrim" aria-label="Chiudi menu" onClick={onClose} tabIndex={-1} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Menu">
        <div className="drawer-head">
          <span className="avatar big" aria-hidden="true">{initialsFor(ctx.name)}</span>
          <div className="drawer-who">
            <strong>{ctx.name}</strong>
            <small>{roleLabel(ctx.role)} · {hotelById(ctx.hotelId)?.name}</small>
          </div>
          <button ref={closeRef} type="button" className="icon-btn" aria-label="Chiudi" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>

        <nav className="drawer-body" aria-label="Menu completo">
          {groups.map((group) => (
            <section key={group.id} className="drawer-group">
              <h3>{group.label}</h3>
              {group.items.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.path}`}
                  className="drawer-link"
                  aria-current={route === item.path ? 'page' : undefined}
                  onClick={onClose}
                >
                  <Icon name={item.icon} size={20} />
                  <span>{item.label}</span>
                </a>
              ))}
            </section>
          ))}
        </nav>

        <div className="drawer-foot">
          <button type="button" className="drawer-link" onClick={() => { onClose(); onSwitchHotel() }}>
            <Icon name="building" size={20} /><span>Cambia struttura</span>
          </button>
          <button type="button" className="drawer-link danger" onClick={() => { onClose(); onLogout() }}>
            <Icon name="close" size={20} /><span>Esci</span>
          </button>
        </div>
      </aside>
    </div>
  )
}
