import { useState } from 'react'
import { THEMES, SIZES, getTheme, getSize, setTheme, setSize } from '../lib/ui-prefs.js'

function Segmented({ label, options, value, onPick }) {
  return (
    <div className="appearance-row">
      <span>{label}</span>
      <div className="seg" role="group" aria-label={label}>
        {options.map((o) => (
          <button key={o.id} type="button" aria-pressed={value === o.id} onClick={() => onPick(o.id)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// Tema (Sistema/Chiaro/Scuro) e dimensione (Piccolo/Normale/Grande): si applicano subito.
export default function Appearance() {
  const [theme, setThemeState] = useState(getTheme)
  const [size, setSizeState] = useState(getSize)
  return (
    <section className="drawer-group" aria-label="Aspetto">
      <h3>Aspetto</h3>
      <div className="appearance">
        <Segmented label="Tema" options={THEMES} value={theme} onPick={(v) => { setTheme(v); setThemeState(v) }} />
        <Segmented label="Dimensione" options={SIZES} value={size} onPick={(v) => { setSize(v); setSizeState(v) }} />
      </div>
    </section>
  )
}
