import { useCallback, useEffect, useRef, useState } from 'react'
import { logError } from './errorlog.js'
import { readWithJwtRecovery } from './jwt-recovery.js'

// Piccolo hook di caricamento: niente librerie extra, si ricarica a mano o quando torni sull'app.
// Ogni esecuzione ha un numero di generazione: una risposta vecchia non sovrascrive una più recente
// (es. cambio hotel veloce).
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true })
  const gen = useRef(0)
  const run = useCallback(async () => {
    const mine = ++gen.current
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const data = await readWithJwtRecovery(fn) // solo letture: un solo rinnovo sessione se l'orario non è allineato
      if (mine === gen.current) setState({ data, error: null, loading: false })
    } catch (error) {
      logError('schermata', error)
      if (mine === gen.current) setState({ data: null, error: error.message || 'Errore', loading: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    run()
    const onVisible = () => document.visibilityState === 'visible' && run()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      gen.current += 1
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [run])

  return { ...state, reload: run }
}

// Router a hash minimale: #/home, #/issues, #/issues/new, #/issues/<id>
export function useRoute() {
  const read = () => window.location.hash.replace(/^#/, '') || '/home'
  const [path, setPath] = useState(read)
  useEffect(() => {
    const onChange = () => setPath(read())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return path
}

export const go = (path) => {
  window.location.hash = path
}

// Numero di notifiche non lette (campanella): si aggiorna ogni minuto, quando si torna sull'app
// e quando una schermata dice che qualcosa è cambiato (evento "notifications:changed").
export function useUnread(loader, deps = []) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    let gen = 0
    const run = () => {
      const mine = ++gen
      return Promise.resolve()
        .then(loader)
        .then((n) => { if (mine === gen) setCount(n) })
        .catch(() => {})
    }
    run()
    const timer = setInterval(run, 60000)
    const onVisible = () => document.visibilityState === 'visible' && run()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('notifications:changed', run)
    return () => {
      gen += 1
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('notifications:changed', run)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return count
}
