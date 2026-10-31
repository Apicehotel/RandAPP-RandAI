// Tema (Sistema/Chiaro/Scuro) e dimensione (Piccolo/Normale/Grande).
export const THEMES = [
  { id: 'system', label: 'Sistema' },
  { id: 'light', label: 'Chiaro' },
  { id: 'dark', label: 'Scuro' },
]
export const SIZES = [
  { id: 'small', label: 'Piccolo' },
  { id: 'normal', label: 'Normale' },
  { id: 'large', label: 'Grande' },
]

const KEY_THEME = 'randapp.theme'
const KEY_SIZE = 'randapp.size'

const read = (key, allowed, fallback) => {
  try {
    const value = localStorage.getItem(key)
    return allowed.some((a) => a.id === value) ? value : fallback
  } catch {
    return fallback
  }
}
const write = (key, value) => {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* storage non disponibile: la preferenza vale solo per questa sessione */
  }
}

export const getTheme = () => read(KEY_THEME, THEMES, 'system')
export const getSize = () => read(KEY_SIZE, SIZES, 'normal')

export function applyPrefs({ theme = getTheme(), size = getSize() } = {}) {
  const root = document.documentElement
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
  root.setAttribute('data-size', size)
}

export function setTheme(theme) {
  write(KEY_THEME, theme)
  applyPrefs({ theme })
}
export function setSize(size) {
  write(KEY_SIZE, size)
  applyPrefs({ size })
}
