import { statusLabel, urgencyLabel } from '../lib/queue.js'

export const Spinner = () => <div className="spinner" role="status" aria-label="Caricamento" />

export function Button({ variant, block, className = '', ...props }) {
  const cls = ['btn', variant, block && 'block', className].filter(Boolean).join(' ')
  return <button className={cls} {...props} />
}

export function Field({ label, id, children }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  )
}

export const ErrorText = ({ children }) =>
  children ? <p className="error" role="alert">{children}</p> : null

export function Badge({ kind, children }) {
  return <span className={`badge ${kind || ''}`}>{children}</span>
}

export const UrgencyBadge = ({ urgency }) => <Badge kind={urgency}>{urgencyLabel(urgency)}</Badge>
export const StatusBadge = ({ status }) => <Badge kind={status}>{statusLabel(status)}</Badge>

// Icone SVG inline: niente librerie di icone nel bundle.
const PATHS = {
  home: 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  list: 'M4 6h16M4 12h16M4 18h10',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  alert: 'M12 3l10 18H2zM12 10v5M12 18h.01',
  wrench: 'M14 6a4 4 0 0 0 5 5l-9 9a2.5 2.5 0 0 1-4-4l9-9a4 4 0 0 0-1-1z',
  clock: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  box: 'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  check: 'M5 12l5 5L20 7',
  menu: 'M4 7h16M4 12h16M4 17h16',
  plus: 'M12 5v14M5 12h14',
  sparkles: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  building: 'M5 21V4h9v17M14 9h5v12M3 21h18M8 8h2M8 12h2M8 16h2',
  close: 'M6 6l12 12M18 6L6 18',
  chevron: 'M6 9l6 6 6-6',
}

export function Icon({ name, size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name] || PATHS.list} />
    </svg>
  )
}

export const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''
