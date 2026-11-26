// Un solo ascoltatore di «visibilitychange» per tutta l'app: ogni parte si iscrive con onBecameVisible()
// e viene chiamata quando la scheda torna visibile. Evita 4 ascoltatori separati sullo stesso evento.
const subs = new Set()
let bound = false

function fire() {
  if (document.visibilityState !== 'visible') return
  for (const fn of [...subs]) {
    try { fn() } catch { /* un'iscrizione che fallisce non ferma le altre */ }
  }
}

export function onBecameVisible(fn) {
  subs.add(fn)
  if (!bound && typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', fire)
    bound = true
  }
  return () => {
    subs.delete(fn)
    if (subs.size === 0 && bound) {
      document.removeEventListener('visibilitychange', fire)
      bound = false
    }
  }
}
