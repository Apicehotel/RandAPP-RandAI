import { useCallback, useEffect, useRef, useState } from 'react'

// Piccolo hook di caricamento: niente librerie extra, si ricarica a mano o quando torni sull'app.
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true })
  const alive = useRef(true)
  const run = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const data = await fn()
      if (alive.current) setState({ data, error: null, loading: false })
    } catch (error) {
      if (alive.current) setState({ data: null, error: error.message || 'Errore', loading: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    alive.current = true
    run()
    const onVisible = () => document.visibilityState === 'visible' && run()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive.current = false
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
    let alive = true
    const run = () => Promise.resolve().then(loader).then((n) => alive && setCount(n)).catch(() => {})
    run()
    const timer = setInterval(run, 60000)
    const onVisible = () => document.visibilityState === 'visible' && run()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('notifications:changed', run)
    return () => {
      alive = false
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('notifications:changed', run)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return count
}
