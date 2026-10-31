import { Icon } from '../ui/kit.jsx'

// Segnaposto onesto per le sezioni non ancora costruite (Planning, Task).
export default function ComingSoon({ title, icon, text }) {
  return (
    <div className="page">
      <h1>{title}</h1>
      <div className="card soon">
        <span className="icon"><Icon name={icon} size={28} /></span>
        <strong>In arrivo</strong>
        <p className="muted">{text}</p>
      </div>
    </div>
  )
}
