import { useCallback, useEffect, useRef, useState } from 'react'
import { logError } from './errorlog.js'
import { readWithJwtRecovery } from './jwt-recovery.js'
import { listOutbox, OUTBOX_EVENT } from './outbox.js'

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
    window.addEventListener('outbox:flushed', run) // le modifiche fatte offline sono arrivate al server
    return () => {
      gen.current += 1
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('outbox:flushed', run)
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

// Modifiche in attesa di invio dell'utente collegato (si aggiorna da sola quando la coda cambia).
export function usePending(ctx) {
  const read = () => listOutbox({ userId: ctx.userId })
  const [list, setList] = useState(read)
  useEffect(() => {
    const update = () => setList(read())
    update()
    window.addEventListener(OUTBOX_EVENT, update)
    return () => window.removeEventListener(OUTBOX_EVENT, update)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.userId])
  return list
}

// true = il telefono dice di avere la rete.
export function useOnline() {
  const [online, setOnline] = useState(() => globalThis.navigator?.onLine !== false)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  return online
}
