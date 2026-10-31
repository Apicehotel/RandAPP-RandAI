import { navFor } from '../lib/permissions.js'
import { hotelById } from '../lib/hotels.js'
import { roleLabel } from '../lib/permissions.js'
import { Icon } from './kit.jsx'

const ICONS = { home: 'home', issues: 'list', profile: 'user' }

// Unica fonte del "chrome" dell'app: nessuna schermata costruisce la propria barra.
export default function Shell({ route, ctx, children }) {
  const items = navFor(ctx.permissions)
  return (
    <div className="shell">
      <header className="shell-top">
        <span className="hotel">{hotelById(ctx.hotelId)?.name || ctx.hotelId}</span>
        <span className="who">{ctx.name} · {roleLabel(ctx.role)}</span>
      </header>
      <main className="shell-stage">{children}</main>
      <nav className="shell-nav" aria-label="Navigazione principale">
        {items.map((item) => (
          <a
            key={item.id}
            href={`#${item.path}`}
            aria-current={route.startsWith(item.path) ? 'page' : undefined}
          >
            <Icon name={ICONS[item.id]} />
            <span>{item.label}</span>
          </a>
        ))}
      </nav>
    </div>
  )
}
