// Logica pura (testabile) per la Home: riepilogo della giornata e "cosa c'è da fare".
// `data` ha una chiave per sezione: un array se la sezione è visibile e caricata, altrimenti null.
import { workQueue } from './queue.js'
import { filterAlerts, isForRole, isReminderCurrent, sortAlerts, summarizeAlerts, describeSchedule } from './task.js'
import { filterInterventions, sortInterventions, summarizeInterventions, interventionStatusLabel } from './interventions.js'
import { bookingsOnDay, shiftLabel, shortDate, worksInWeek, worksOnDay, weekStartIso } from './planning.js'
import { urgencyLabel, statusLabel } from './queue.js'

const count = (arr, fn) => (arr ? arr.filter(fn).length : null)

// Un riquadro per sezione: numero grande + dettaglio. `null` = sezione non disponibile (nascosta).
export function buildTiles(data, { today, role }) {
  const issues = data.issues
  const iv = data.interventions && summarizeInterventions(data.interventions)
  const alerts = data.alerts && summarizeAlerts(data.alerts)
  const openWorks = data.works && data.works.filter((w) => w.status !== 'fatto')
  return {
    issues: issues && {
      value: count(issues, (i) => i.status === 'da_fare'),
      label: 'Segnalazioni da fare',
      detail: `${count(issues, (i) => i.status !== 'completata' && i.urgency === 'urgente')} urgenti`,
      href: '#/issues', icon: 'alert',
    },
    interventions: iv && {
      value: count(data.interventions, (i) => i.status === 'da_fare'),
      label: 'Interventi da fare',
      detail: `${iv.running} in corso`,
      href: '#/interventions', icon: 'wrench',
    },
    works: openWorks && {
      value: worksOnDay(openWorks, today).length,
      label: 'Lavori oggi',
      detail: `${worksInWeek(openWorks, weekStartIso(today)).length} in settimana`,
      href: '#/planning/work', icon: 'calendar',
    },
    sale: data.bookings && {
      value: bookingsOnDay(data.bookings, today).length,
      label: 'Sale occupate oggi',
      detail: `${data.bookings.filter((b) => b.status === 'attiva' && b.date_from > today).length} in arrivo`,
      href: '#/planning/sale', icon: 'building',
    },
    alerts: alerts && {
      value: alerts.waiting,
      label: 'Avvisi da prendere',
      detail: `${alerts.taken} in carico`,
      href: '#/task/urgent', icon: 'alert', tone: alerts.waiting > 0 ? 'danger' : undefined,
    },
    reminders: data.reminders && {
      value: data.reminders.filter((r) => isForRole(r, role) && isReminderCurrent(r, today)).length,
      label: 'Promemoria per me',
      detail: `${data.reminders.filter((r) => r.active).length} attivi`,
      href: '#/task/reminders', icon: 'clock',
    },
  }
}

// Elenco unico "da fare adesso": al massimo `perSection` voci per sezione, nell'ordine di importanza.
export function buildTodo(data, { today, role, perSection = 3, max = 10 }) {
  const out = []
  const push = (section, items) => items.slice(0, perSection).forEach((i) => out.push({ section, ...i }))

  if (data.alerts) {
    push('Avviso', sortAlerts(filterAlerts(data.alerts, 'aperti')).map((a) => ({
      key: `a-${a.id}`, title: a.note, meta: a.status === 'aperto' ? 'Da prendere in carico' : 'In carico', href: `#/task/urgent/${a.id}`, tone: a.status === 'aperto' ? 'danger' : undefined,
    })))
  }
  if (data.issues) {
    push('Segnalazione', workQueue(data.issues, perSection).map((i) => ({
      key: `i-${i.id}`, title: i.title,
      meta: `${urgencyLabel(i.urgency)} · ${statusLabel(i.status)}${i.room ? ` · ${i.room}` : ''}`, href: `#/issues/${i.id}`,
    })))
  }
  if (data.interventions) {
    push('Intervento', sortInterventions(filterInterventions(data.interventions, 'aperti')).map((i) => ({
      key: `v-${i.id}`, title: i.title,
      meta: `${interventionStatusLabel(i.status)}${i.location ? ` · ${i.location}` : ''}`, href: `#/interventions/${i.id}`,
    })))
  }
  if (data.works) {
    push('Lavoro', worksOnDay(data.works.filter((w) => w.status !== 'fatto'), today).map((w) => ({
      key: `w-${w.id}`, title: w.description, meta: 'Oggi', href: `#/planning/work/${w.id}`,
    })))
  }
  if (data.bookings) {
    push('Sala', bookingsOnDay(data.bookings, today).map((b) => ({
      key: `b-${b.id}`, title: `${b.room} · ${b.client}`, meta: `${shiftLabel(b.shift)} · fino al ${shortDate(b.date_to)}`, href: `#/planning/sale/${b.id}`,
    })))
  }
  if (data.reminders) {
    push('Promemoria', data.reminders.filter((r) => isForRole(r, role) && isReminderCurrent(r, today)).map((r) => ({
      key: `r-${r.id}`, title: r.message, meta: describeSchedule(r), href: `#/task/reminders/${r.id}`,
    })))
  }
  return out.slice(0, max)
}

// ---- Presenza
// Se qualcuno dimentica di segnare l'uscita, dopo 16 ore non risulta più presente.
export const PRESENCE_MAX_HOURS = 16

export const isPresentNow = (row, now = Date.now()) =>
  Boolean(row.present) && now - new Date(row.since).getTime() < PRESENCE_MAX_HOURS * 3600e3

export const presentNow = (rows, now = Date.now()) =>
  rows.filter((r) => isPresentNow(r, now)).sort((a, b) => new Date(a.since).getTime() - new Date(b.since).getTime())

export const timeLabel = (iso) =>
  new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })

// Titolo breve per la Home: "sabato 31 ottobre"
export const todayTitle = (d = new Date()) => {
  const t = d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}
