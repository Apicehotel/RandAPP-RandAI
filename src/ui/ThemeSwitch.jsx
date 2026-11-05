import { useEffect, useState } from 'react'
import { getTheme, setTheme } from '../lib/ui-prefs.js'

const prefersDark = () => {
  try { return window.matchMedia('(prefers-color-scheme: dark)').matches } catch { return false }
}
const resolve = (choice) => (choice === 'system' ? (prefersDark() ? 'dark' : 'light') : choice)

// Interruttore rapido chiaro/scuro (sole e luna), come nella vecchia app. Salva una scelta esplicita.
export default function ThemeSwitch({ className = '' }) {
  const [mode, setMode] = useState(() => resolve(getTheme()))
  useEffect(() => {
    const media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null
    const sync = () => setMode(resolve(getTheme()))
    media?.addEventListener?.('change', sync)
    return () => media?.removeEventListener?.('change', sync)
  }, [])
  const dark = mode === 'dark'
  const toggle = () => { const next = dark ? 'light' : 'dark'; setTheme(next); setMode(next) }
  return (
    <button type="button" role="switch" aria-checked={dark} aria-label="Tema scuro" data-testid="theme-switch"
      title={dark ? 'Passa al tema chiaro' : 'Passa al tema scuro'} className={`themeswitch ${dark ? 'is-dark' : ''} ${className}`} onClick={toggle}>
      <span className="themeswitch-track" aria-hidden="true">
        <svg className="ts-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
        <svg className="ts-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></svg>
        <span className="themeswitch-thumb" />
      </span>
    </button>
  )
}
