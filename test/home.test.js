import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildTiles, buildTodo, isPresentNow, presentNow, PRESENCE_MAX_HOURS,
} from '../src/lib/home.js'

const today = '2026-10-31'
const role = 'manutentore'
const empty = { issues: null, interventions: null, works: null, bookings: null, alerts: null, reminders: null }
const NOW = new Date('2026-10-31T12:00:00Z').getTime()

const issue = (id, status, urgency, created_at = '2026-10-31T08:00:00Z') => ({ id, title: `i${id}`, status, urgency, room: null, created_at })
const intv = (id, status) => ({ id, title: `v${id}`, status, location: null, created_at: '2026-10-30T08:00:00Z', scheduled_at: null })

test('riquadri: solo le sezioni disponibili, con i numeri giusti', () => {
  const data = {
    ...empty,
    issues: [issue(1, 'da_fare', 'urgente'), issue(2, 'tecnico', 'alta'), issue(3, 'completata', 'urgente')],
    interventions: [intv(1, 'da_fare'), intv(2, 'in_corso'), intv(3, 'fatto')],
    alerts: [{ id: 'a', status: 'aperto', note: 'x', created_at: '2026-10-31T10:00:00Z' }, { id: 'b', status: 'in_carico', note: 'y', created_at: '2026-10-31T09:00:00Z' }],
  }
  const t = buildTiles(data, { today, role })
  assert.equal(t.issues.value, 1)
  assert.equal(t.issues.detail, '1 urgenti') // la completata non conta
  assert.equal(t.interventions.value, 1)
  assert.equal(t.interventions.detail, '1 in corso')
  assert.equal(t.alerts.value, 1)
  assert.equal(t.alerts.tone, 'danger')
  assert.equal(t.works, null)
  assert.equal(t.sale, null)
  assert.equal(t.reminders, null)
})

test('riquadro avvisi non è rosso quando non ce ne sono da prendere', () => {
  const t = buildTiles({ ...empty, alerts: [{ id: 'b', status: 'in_carico', created_at: '2026-10-31T09:00:00Z' }] }, { today, role })
  assert.equal(t.alerts.value, 0)
  assert.equal(t.alerts.tone, undefined)
})

test('lavori e sale di oggi', () => {
  const data = {
    ...empty,
    works: [
      { id: 'w1', description: 'a', days: ['2026-10-31'], status: 'da_fare' },
      { id: 'w2', description: 'b', days: ['2026-10-31'], status: 'fatto' },
      { id: 'w3', description: 'c', days: ['2026-10-29'], status: 'da_fare' },
    ],
    bookings: [
      { id: 'b1', room: 'Sala', client: 'X', date_from: '2026-10-31', date_to: '2026-10-31', shift: 'sera', status: 'attiva' },
      { id: 'b2', room: 'Sala', client: 'Y', date_from: '2026-11-03', date_to: '2026-11-03', shift: 'sera', status: 'attiva' },
    ],
  }
  const t = buildTiles(data, { today, role })
  assert.equal(t.works.value, 1)
  assert.equal(t.works.detail, '2 in settimana')
  assert.equal(t.sale.value, 1)
  assert.equal(t.sale.detail, '1 in arrivo')
})

test('promemoria per me: solo il mio ruolo, attivi e in corso oggi', () => {
  const r = (id, over) => ({ id, message: id, active: true, target_roles: [], start_date: '2026-10-01', end_date: null, repeat_kind: 'daily', weekdays: [], times: ['09:00'], ...over })
  const data = { ...empty, reminders: [r('tutti', {}), r('mio', { target_roles: ['manutentore'] }), r('altro', { target_roles: ['reception'] }), r('spento', { active: false }), r('scaduto', { end_date: '2026-10-30' })] }
  const t = buildTiles(data, { today, role })
  assert.equal(t.reminders.value, 2)
  assert.equal(t.reminders.detail, '4 attivi')
})

test('da fare adesso: ordine per importanza, massimo 3 per sezione e 10 in tutto', () => {
  const data = {
    ...empty,
    alerts: Array.from({ length: 5 }, (_, i) => ({ id: `a${i}`, note: `n${i}`, status: 'aperto', created_at: `2026-10-31T0${i}:00:00Z` })),
    issues: Array.from({ length: 6 }, (_, i) => issue(i, 'da_fare', 'urgente', `2026-10-31T0${i}:00:00Z`)),
    interventions: Array.from({ length: 4 }, (_, i) => intv(i, 'da_fare')),
    works: Array.from({ length: 4 }, (_, i) => ({ id: `w${i}`, description: 'w', days: [today], status: 'da_fare' })),
  }
  const todo = buildTodo(data, { today, role })
  assert.equal(todo.length, 10)
  assert.deepEqual([...new Set(todo.map((t) => t.section))], ['Avviso', 'Segnalazione', 'Intervento', 'Lavoro'])
  assert.equal(todo.filter((t) => t.section === 'Avviso').length, 3)
  assert.equal(todo[0].title, 'n0') // il più vecchio per primo
  assert.equal(todo[0].tone, 'danger')
  assert.equal(todo[0].href, '#/task/urgent/a0')
})

test('da fare adesso: vuoto se non c\'è nulla o niente è visibile', () => {
  assert.deepEqual(buildTodo(empty, { today, role }), [])
  assert.deepEqual(buildTodo({ ...empty, issues: [issue(1, 'completata', 'urgente')] }, { today, role }), [])
})

test('presenza: sparisce dopo 16 ore o se ha segnato l\'uscita', () => {
  const h = (n) => new Date(NOW - n * 3600e3).toISOString()
  assert.equal(PRESENCE_MAX_HOURS, 16)
  assert.equal(isPresentNow({ present: true, since: h(2) }, NOW), true)
  assert.equal(isPresentNow({ present: true, since: h(17) }, NOW), false)
  assert.equal(isPresentNow({ present: false, since: h(1) }, NOW), false)
  const list = presentNow([
    { user_id: 'b', present: true, since: h(1) },
    { user_id: 'a', present: true, since: h(5) },
    { user_id: 'c', present: false, since: h(2) },
  ], NOW)
  assert.deepEqual(list.map((x) => x.user_id), ['a', 'b']) // chi è arrivato prima in cima
})

test('titolo del giorno: prima lettera maiuscola, mese minuscolo', async () => {
  const { todayTitle } = await import('../src/lib/home.js')
  assert.equal(todayTitle(new Date(2026, 9, 31)), 'Sabato 31 ottobre')
})
