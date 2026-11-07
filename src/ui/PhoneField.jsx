import { useState } from 'react'
import { COUNTRIES, filterCountries, joinPhone, splitPhone } from '../lib/phone.js'

// Campo numero con prefisso internazionale (predefinito +39) e ricerca del paese.
// `value` e `onChange` usano il numero intero ("+393401234567"); vuoto = nessun numero.
export default function PhoneField({ value, onChange, label = 'Numero WhatsApp', placeholder = '340 1234567' }) {
  const { dial, national } = splitPhone(value)
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  // Se si sceglie un prefisso senza numero, il prefisso resta visibile finché non si scrive il numero.
  const [pending, setPending] = useState(null)
  const shownDial = national ? dial : (pending ?? dial)
  const results = filterCountries(q, COUNTRIES)

  const pick = (d) => {
    setPending(d); setOpen(false); setQ('')
    onChange(joinPhone(d, national))
  }
  const typeNumber = (e) => onChange(joinPhone(shownDial, e.target.value))

  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="row" style={{ gap: 8, alignItems: 'stretch' }}>
        <button type="button" className="btn" aria-haspopup="listbox" aria-expanded={open}
          aria-label={`Prefisso internazionale: +${shownDial}`} onClick={() => setOpen(!open)}>
          +{shownDial} ▾
        </button>
        <input className="input" type="tel" inputMode="tel" autoComplete="tel-national" placeholder={placeholder}
          value={national} onChange={typeNumber} aria-label={label} style={{ flex: 1 }} />
      </div>
      {open && (
        <div className="card stack" style={{ gap: 6 }}>
          <input className="input" type="search" autoFocus placeholder="Cerca paese o prefisso" value={q}
            onChange={(e) => setQ(e.target.value)} aria-label="Cerca paese o prefisso" />
          <ul role="listbox" aria-label="Paesi" style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 220, overflowY: 'auto' }}>
            {results.map((c) => (
              <li key={`${c.name}-${c.dial}`} role="option" aria-selected={c.dial === shownDial}>
                <button type="button" className="btn block" style={{ textAlign: 'left' }} onClick={() => pick(c.dial)}>
                  {c.name} <span className="muted">+{c.dial}</span>
                </button>
              </li>
            ))}
            {results.length === 0 && <li className="muted">Nessun paese trovato</li>}
          </ul>
        </div>
      )}
    </div>
  )
}
