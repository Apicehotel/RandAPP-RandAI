import { Suspense, useEffect, useState } from 'react'
import { isConfigured, missingConfig } from '../lib/supabase.js'
import { hasActiveSession, loadContext } from '../lib/auth.js'
import { lazyWithRetry } from '../lib/lazy-retry.js'
import { useRoute } from '../lib/hooks.js'
import { can, PERM } from '../lib/permissions.js'
import { randaiEnabled, loadRandAI } from '../randai/index.js'
import Shell from '../ui/Shell.jsx'
import Login from '../screens/Login.jsx'
import { Spinner } from '../ui/kit.jsx'

// Ogni schermata si scarica solo quando la apri.
const Home = lazyWithRetry(() => import('../screens/Home.jsx'))
const IssueList = lazyWithRetry(() => import('../screens/Issues.jsx').then((m) => ({ default: m.IssueList })))
const IssueDetail = lazyWithRetry(() => import('../screens/Issues.jsx').then((m) => ({ default: m.IssueDetail })))
const IssueNew = lazyWithRetry(() => import('../screens/IssueNew.jsx'))
const Profile = lazyWithRetry(() => import('../screens/Profile.jsx'))
const RandAI = lazyWithRetry(loadRandAI)

const HOTEL_KEY = 'randapp.hotel'
const readHotel = () => {
  try { return localStorage.getItem(HOTEL_KEY) } catch { return null }
}
const writeHotel = (id) => {
  try { id ? localStorage.setItem(HOTEL_KEY, id) : localStorage.removeItem(HOTEL_KEY) } catch { /* ignora */ }
}

function SetupNeeded() {
  return (
    <div className="center">
      <div className="auth-box">
        <h1>Configurazione mancante</h1>
        <p className="muted">Imposta queste variabili d'ambiente e rifai il build:</p>
        <div className="card stack">
          {missingConfig.map((name) => <code key={name}>{name}</code>)}
        </div>
      </div>
    </div>
  )
}

function Screen({ route, ctx, onLogout, onSwitchHotel }) {
  const canView = can(ctx.permissions, PERM.ISSUES_VIEW)

  if (route.startsWith('/profile')) return <Profile ctx={ctx} onLogout={onLogout} onSwitchHotel={onSwitchHotel} />
  if (route.startsWith('/randai') && randaiEnabled) return <RandAI />
  if (!canView) return <div className="page"><p className="muted">Non hai i permessi per vedere questa sezione.</p></div>

  if (route === '/issues/new') {
    return can(ctx.permissions, PERM.ISSUES_CREATE)
      ? <IssueNew ctx={ctx} />
      : <div className="page"><p className="muted">Non puoi creare segnalazioni.</p></div>
  }
  if (route.startsWith('/issues/')) return <IssueDetail ctx={ctx} id={route.split('/')[2]} />
  if (route.startsWith('/issues')) return <IssueList ctx={ctx} />
  return <Home ctx={ctx} />
}

export default function App() {
  const route = useRoute()
  const [ctx, setCtx] = useState(null)
  const [booting, setBooting] = useState(isConfigured)

  // All'avvio riprende la sessione salvata (se c'è) senza chiedere di nuovo il PIN.
  useEffect(() => {
    if (!isConfigured) return
    let cancelled = false
    ;(async () => {
      try {
        const hotelId = readHotel()
        if (hotelId && (await hasActiveSession())) {
          const restored = await loadContext(hotelId)
          if (!cancelled && restored) setCtx(restored)
        }
      } catch {
        /* nessuna sessione valida: si passa al login */
      } finally {
        if (!cancelled) setBooting(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  if (!isConfigured) return <SetupNeeded />
  if (booting) return <div className="center"><Spinner /></div>

  if (!ctx) {
    return (
      <Login
        initialHotel={readHotel()}
        onLoggedIn={(c) => { writeHotel(c.hotelId); setCtx(c); window.location.hash = '/home' }}
      />
    )
  }

  return (
    <Shell route={route} ctx={ctx}>
      <Suspense fallback={<Spinner />}>
        <Screen
          route={route}
          ctx={ctx}
          onLogout={() => setCtx(null)}
          onSwitchHotel={() => { writeHotel(null); setCtx(null) }}
        />
      </Suspense>
    </Shell>
  )
}
