import { useMemo, useState } from 'react'
import { clampPax, locationOk, roomGroups, suggestLocations, toggleIn, togglePlan } from '../lib/forms.js'
import { Icon } from './kit.jsx'
import { roleLabel } from '../lib/permissions.js'

// Scelta singola a "chip" (categoria, urgenza, turno…). Le icone sono facoltative.
export function ChipPick({ options, value, onChange, label }) {
  return (
    <div className="chips wrap" role="group" aria-label={label}>
      {options.map((o) => (
        <button type="button" key={o.id} className="chip" aria-pressed={value === o.id} onClick={() => onChange(o.id)}>
          {o.icon && <Icon name={o.icon} size={16} />} {o.label}
        </button>
      ))}
    </div>
  )
}

// Un solo luogo (camera o zona) con suggerimenti mentre si scrive.
// Se la struttura ha un catalogo il luogo deve esistere; senza catalogo il testo è libero.
export function LocationInput({ id, locations, value, onChange, placeholder = 'es. 204, Hall, Cucina' }) {
  const [open, setOpen] = useState(false)
  const hints = useMemo(() => suggestLocations(locations, value).filter((n) => n !== value), [locations, value])
  const bad = value.trim() && !locationOk(locations, value)
  return (
    <div className="suggest-wrap">
      <input id={id} className="input" value={value} maxLength={40} autoComplete="off" placeholder={placeholder}
        onChange={(e) => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)} />
      {open && hints.length > 0 && (
        <ul className="suggest" role="listbox">
          {hints.map((h) => (
            <li key={h}><button type="button" role="option" onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange(h); setOpen(false) }}>{h}</button></li>
          ))}
        </ul>
      )}
      {bad && <p className="error">Questo luogo non è nell'elenco della struttura.</p>}
    </div>
  )
}

// Più camere insieme, raggruppate per piano: il conteggio rimane nella testata
// e la selezione è visibile nel piano aperto. Evita il riepilogo duplicato in alto.
export function RoomsPicker({ locations, selected, onChange }) {
  const groups = useMemo(() => roomGroups(locations), [locations])
  const [open, setOpen] = useState(groups[0]?.name || '')
  if (groups.length === 0) return <p className="muted">Nessun elenco camere per questa struttura: scrivi il luogo sopra.</p>
  return (
    <div className="stack">
      {groups.map((g) => {
        const count = g.rooms.filter((r) => selected.includes(r)).length
        const isOpen = open === g.name
        return (
          <div key={g.name} className="roomgroup">
            <div className="row">
              <button type="button" className={`chip floor${count ? ' has-sel' : ''}`} aria-expanded={isOpen} onClick={() => setOpen(isOpen ? '' : g.name)}>
                <Icon name="chevron" size={14} /> {g.name}{count ? ` · ${count} scelte` : ''}
              </button>
              <button type="button" className="linkbtn" onClick={() => onChange(togglePlan(selected, g.rooms))}>
                {count === g.rooms.length ? 'Togli tutte' : 'Tutte'}
              </button>
            </div>
            {isOpen && (
              <div className="chips wrap">
                {g.rooms.map((r) => (
                  <button type="button" key={r} className="chip" aria-pressed={selected.includes(r)} onClick={() => onChange(toggleIn(selected, r))}>{r}</button>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// Colleghi a cui assegnare: più persone, con nome e ruolo.
export function StaffPicker({ staff, selected, onChange }) {
  if (!staff || staff.length === 0) return <p className="muted">Nessun collega assegnabile.</p>
  return (
    <div className="staff-grid">
      {staff.map((p) => {
        const on = selected.includes(p.user_id)
        return (
          <button type="button" key={p.user_id} className="staff" aria-pressed={on} onClick={() => onChange(toggleIn(selected, p.user_id))}>
            <Icon name="user" size={18} />
            <span><strong>{p.display_name}</strong><small>{roleLabel(p.role)}</small></span>
            <span aria-hidden="true">{on ? '✓' : ''}</span>
          </button>
        )
      })}
    </div>
  )
}

// Contatore − [n] + per le persone (PAX).
export function Stepper({ value, onChange, label }) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" className="btn" aria-label="Meno" onClick={() => onChange(String(clampPax(value, -1)))}>−</button>
      <input className="input" inputMode="numeric" value={value} aria-label={label}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))} />
      <button type="button" className="btn" aria-label="Più" onClick={() => onChange(String(clampPax(value, 1)))}>+</button>
    </div>
  )
}
