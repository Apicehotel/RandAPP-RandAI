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
const InterventionList = lazyWithRetry(() => import('../screens/Interventions.jsx').then((m) => ({ default: m.InterventionList })))
const InterventionDetail = lazyWithRetry(() => import('../screens/Interventions.jsx').then((m) => ({ default: m.InterventionDetail })))
const InterventionNew = lazyWithRetry(() => import('../screens/InterventionNew.jsx'))
const Planning = lazyWithRetry(() => import('../screens/Planning.jsx'))
const WorkList = lazyWithRetry(() => import('../screens/PlanningWork.jsx').then((m) => ({ default: m.WorkList })))
const WorkDetail = lazyWithRetry(() => import('../screens/PlanningWork.jsx').then((m) => ({ default: m.WorkDetail })))
const WorkNew = lazyWithRetry(() => import('../screens/PlanningWorkNew.jsx'))
const SaleList = lazyWithRetry(() => import('../screens/PlanningSale.jsx').then((m) => ({ default: m.SaleList })))
const SaleDetail = lazyWithRetry(() => import('../screens/PlanningSale.jsx').then((m) => ({ default: m.SaleDetail })))
const SaleNew = lazyWithRetry(() => import('../screens/PlanningSaleNew.jsx'))
const Task = lazyWithRetry(() => import('../screens/Task.jsx'))
const AlertList = lazyWithRetry(() => import('../screens/TaskUrgent.jsx').then((m) => ({ default: m.AlertList })))
const AlertDetail = lazyWithRetry(() => import('../screens/TaskUrgent.jsx').then((m) => ({ default: m.AlertDetail })))
const AlertNew = lazyWithRetry(() => import('../screens/TaskUrgentNew.jsx'))
const ReminderList = lazyWithRetry(() => import('../screens/TaskReminders.jsx').then((m) => ({ default: m.ReminderList })))
const ReminderDetail = lazyWithRetry(() => import('../screens/TaskReminders.jsx').then((m) => ({ default: m.ReminderDetail })))
const ReminderNew = lazyWithRetry(() => import('../screens/TaskReminderNew.jsx'))
const Profile = lazyWithRetry(() => import('../screens/Profile.jsx'))
const Operations = lazyWithRetry(() => import('../screens/Operations.jsx'))
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

const NoAccess = ({ text }) => <div className="page"><p className="muted">{text}</p></div>

// Planning: hub + Planning Lavori + Planning Sale, ognuno col suo permesso.
function PlanningScreen({ route, ctx }) {
  const has = (perm) => can(ctx.permissions, perm)
  const parts = route.split('/').filter(Boolean) // ['planning', 'work'|'sale', 'new'|<id>]
  const [, section, third] = parts

  if (section === 'work') {
    if (!has(PERM.PLANNING_WORK_VIEW)) return <NoAccess text="Non hai i permessi per il Planning Lavori." />
    if (third === 'new') {
      return has(PERM.PLANNING_WORK_CREATE) ? <WorkNew ctx={ctx} /> : <NoAccess text="Non puoi aggiungere lavori." />
    }
    return third ? <WorkDetail ctx={ctx} id={third} /> : <WorkList ctx={ctx} />
  }
  if (section === 'sale') {
    if (!has(PERM.PLANNING_SALE_VIEW)) return <NoAccess text="Non hai i permessi per il Planning Sale." />
    if (third === 'new') {
      return has(PERM.PLANNING_SALE_CREATE) ? <SaleNew ctx={ctx} /> : <NoAccess text="Non puoi prenotare le sale." />
    }
    return third ? <SaleDetail ctx={ctx} id={third} /> : <SaleList ctx={ctx} />
  }
  if (!has(PERM.PLANNING_WORK_VIEW) && !has(PERM.PLANNING_SALE_VIEW)) {
    return <NoAccess text="Non hai i permessi per vedere il Planning." />
  }
  return <Planning ctx={ctx} />
}

// Task: hub + Avvisi Urgenti + Promemoria, ognuno col suo permesso.
function TaskScreen({ route, ctx }) {
  const has = (perm) => can(ctx.permissions, perm)
  const [, section, third] = route.split('/').filter(Boolean) // ['task', 'urgent'|'reminders', 'new'|<id>]

  if (section === 'urgent') {
    if (!has(PERM.URGENT_VIEW)) return <NoAccess text="Non hai i permessi per gli Avvisi Urgenti." />
    if (third === 'new') {
      return has(PERM.URGENT_CREATE) ? <AlertNew ctx={ctx} /> : <NoAccess text="Non puoi inviare avvisi." />
    }
    return third ? <AlertDetail ctx={ctx} id={third} /> : <AlertList ctx={ctx} />
  }
  if (section === 'reminders') {
    if (!has(PERM.REMINDERS_VIEW)) return <NoAccess text="Non hai i permessi per i Promemoria." />
    if (third === 'new') {
      return has(PERM.REMINDERS_CREATE) ? <ReminderNew ctx={ctx} /> : <NoAccess text="Non puoi creare promemoria." />
    }
    return third ? <ReminderDetail ctx={ctx} id={third} /> : <ReminderList ctx={ctx} />
  }
  if (!has(PERM.URGENT_VIEW) && !has(PERM.REMINDERS_VIEW)) {
    return <NoAccess text="Non hai i permessi per vedere i Task." />
  }
  return <Task ctx={ctx} />
}

function Screen({ route, ctx, onLogout, onSwitchHotel }) {
  const canView = can(ctx.permissions, PERM.ISSUES_VIEW)

  if (route.startsWith('/profile')) return <Profile ctx={ctx} onLogout={onLogout} onSwitchHotel={onSwitchHotel} />
  if (route.startsWith('/randai') && randaiEnabled) return <RandAI />
  if (route.startsWith('/planning')) return <PlanningScreen route={route} ctx={ctx} />
  if (route.startsWith('/task')) return <TaskScreen route={route} ctx={ctx} />
  if (route.startsWith('/interventions')) {
    if (!can(ctx.permissions, PERM.INTERVENTIONS_VIEW)) return <NoAccess text="Non hai i permessi per vedere gli interventi." />
    if (route === '/interventions/new') {
      return can(ctx.permissions, PERM.INTERVENTIONS_CREATE)
        ? <InterventionNew ctx={ctx} />
        : <NoAccess text="Non puoi creare interventi." />
    }
    if (route.startsWith('/interventions/')) return <InterventionDetail ctx={ctx} id={route.split('/')[2]} />
    return <InterventionList ctx={ctx} />
  }
  if (route.startsWith('/issues')) {
    if (!canView) return <NoAccess text="Non hai i permessi per vedere le segnalazioni." />
    if (route === '/issues/new') {
      return can(ctx.permissions, PERM.ISSUES_CREATE)
        ? <IssueNew ctx={ctx} />
        : <NoAccess text="Non puoi creare segnalazioni." />
    }
    if (route.startsWith('/issues/')) return <IssueDetail ctx={ctx} id={route.split('/')[2]} />
    return <IssueList ctx={ctx} />
  }
  if (route.startsWith('/operations')) {
    if (!canView && !can(ctx.permissions, PERM.INTERVENTIONS_VIEW)) return <NoAccess text="Non hai i permessi per vedere l'Operatività." />
    return <Operations ctx={ctx} />
  }
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

  // Cambio struttura senza rifare il PIN: stessa sessione, nuova iscrizione (ruolo e permessi si rileggono).
  const changeHotel = async (hotelId) => {
    const next = await loadContext(hotelId)
    if (!next) throw new Error('Non hai accesso a questa struttura')
    writeHotel(hotelId)
    setCtx(next)
    window.location.hash = '/home'
  }

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
    <Shell
      route={route}
      ctx={ctx}
      onLogout={() => setCtx(null)}
      onSwitchHotel={() => { writeHotel(null); setCtx(null) }}
      onChangeHotel={changeHotel}
    >
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
