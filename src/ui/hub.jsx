import { Icon } from './kit.jsx'

// Tre numeri in riga (stesso schema in Planning e Operatività). tone: 'warn' | 'ok' | undefined.
export function StatRow({ stats }) {
  return (
    <div className="stats3">
      {stats.map((s) => (
        <div className="card" key={s.label}>
          <span className={`stat-num ${s.tone || ''}`}>{s.value}</span>
          <span className="muted">{s.label}</span>
        </div>
      ))}
    </div>
  )
}

// Riquadro del hub: titolo, tre numeri e (se il ruolo può creare) il tasto "+ Nuovo".
export function HubChoice({ href, icon, title, stats, newHref, newLabel }) {
  return (
    <div className="card hub-choice">
      <a className="hub-link" href={href}>
        <span className="icon"><Icon name={icon} /></span>
        <strong>{title}</strong>
        <span className="stats3 mini">
          {stats.map((s) => (
            <span key={s.label}><b className={s.tone ? `${s.tone}-text` : ''}>{s.value}</b><small>{s.label}</small></span>
          ))}
        </span>
      </a>
      {newHref && <a className="btn primary block" href={newHref}>{newLabel}</a>}
    </div>
  )
}
