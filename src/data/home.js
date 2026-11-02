import { can, PERM } from '../lib/permissions.js'
import { addDaysIso, todayIso, weekStartIso } from '../lib/planning.js'
import { listIssues } from './issues.js'
import { listInterventions } from './interventions.js'
import { listWorkDays, listBookings } from './planning.js'
import { listAlerts, listReminders } from './task.js'

// Carica in parallelo solo le sezioni che l'utente può vedere. Se una sezione fallisce,
// le altre si vedono lo stesso: la chiave resta null e il nome finisce in `failed`.
export async function loadHome(ctx) {
  const p = ctx.permissions
  const today = todayIso()
  const jobs = {
    issues: can(p, PERM.ISSUES_VIEW) && (() => listIssues(ctx.hotelId)),
    interventions: can(p, PERM.INTERVENTIONS_VIEW) && (() => listInterventions(ctx.hotelId)),
    // Giorni di lavoro della settimana in corso (uno stato per giorno).
    works: can(p, PERM.PLANNING_WORK_VIEW) && (() => listWorkDays(ctx.hotelId, { from: weekStartIso(today), to: addDaysIso(weekStartIso(today), 6) })),
    bookings: can(p, PERM.PLANNING_SALE_VIEW) && (() => listBookings(ctx.hotelId, today)),
    alerts: can(p, PERM.URGENT_VIEW) && (() => listAlerts(ctx.hotelId)),
    reminders: can(p, PERM.REMINDERS_VIEW) && (() => listReminders(ctx.hotelId)),
  }
  const names = Object.keys(jobs).filter((k) => jobs[k])
  const settled = await Promise.allSettled(names.map((k) => jobs[k]()))
  const data = Object.fromEntries(Object.keys(jobs).map((k) => [k, null]))
  const failed = []
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') data[names[i]] = r.value
    else failed.push(names[i])
  })
  return { data, failed }
}
