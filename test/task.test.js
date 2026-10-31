import test from 'node:test'
import assert from 'node:assert/strict'
import {
  filterAlerts, sortAlerts, summarizeAlerts, alertPatch, isForRole, isReminderCurrent,
  normalizeTimes, describeSchedule, validateReminder, agoLabel,
} from '../src/lib/task.js'

const a = (id, status, created_at) => ({ id, status, created_at })

test('avvisi: filtri e riepilogo', () => {
  const items = [a('1', 'aperto', '2026-10-31T10:00:00Z'), a('2', 'in_carico', '2026-10-31T09:00:00Z'), a('3', 'risolto', '2026-10-30T09:00:00Z')]
  assert.deepEqual(filterAlerts(items, 'aperti').map((x) => x.id), ['1', '2'])
  assert.deepEqual(filterAlerts(items, 'risolti').map((x) => x.id), ['3'])
  assert.equal(filterAlerts(items, 'tutti').length, 3)
  assert.deepEqual(summarizeAlerts(items), { waiting: 1, taken: 1 })
})

test('avvisi: prima i da prendere, poi in carico; a parità il più vecchio', () => {
  const items = [
    a('carico', 'in_carico', '2026-10-31T08:00:00Z'),
    a('nuovo', 'aperto', '2026-10-31T10:00:00Z'),
    a('vecchio', 'aperto', '2026-10-31T07:00:00Z'),
    a('fatto', 'risolto', '2026-10-30T07:00:00Z'),
  ]
  assert.deepEqual(sortAlerts(items).map((x) => x.id), ['vecchio', 'nuovo', 'carico', 'fatto'])
})

test('avvisi: chi e quando si registra dal nuovo stato', () => {
  const now = '2026-10-31T12:00:00.000Z'
  assert.deepEqual(alertPatch('in_carico', 'u1', now), { status: 'in_carico', taken_by: 'u1', taken_at: now, resolved_at: null })
  assert.deepEqual(alertPatch('risolto', 'u1', now), { status: 'risolto', resolved_at: now })
  assert.deepEqual(alertPatch('aperto', 'u1', now), { status: 'aperto', taken_by: null, taken_at: null, resolved_at: null })
})

const r = (over) => ({ active: true, target_roles: [], start_date: '2026-10-01', end_date: null, repeat_kind: 'once', weekdays: [], times: ['09:00'], ...over })

test('promemoria: per ruolo (nessun ruolo = tutti), solo se attivo', () => {
  assert.equal(isForRole(r({}), 'reception'), true)
  assert.equal(isForRole(r({ target_roles: ['manutentore'] }), 'manutentore'), true)
  assert.equal(isForRole(r({ target_roles: ['manutentore'] }), 'reception'), false)
  assert.equal(isForRole(r({ active: false }), 'reception'), false)
})

test('promemoria: validità per data', () => {
  assert.equal(isReminderCurrent(r({}), '2026-10-31'), true)
  assert.equal(isReminderCurrent(r({ end_date: '2026-10-30' }), '2026-10-31'), false)
  assert.equal(isReminderCurrent(r({ start_date: '2026-11-01' }), '2026-10-31'), false)
  assert.equal(isReminderCurrent(r({ active: false }), '2026-10-31'), false)
})

test('orari: validi, senza doppioni, ordinati', () => {
  assert.deepEqual(normalizeTimes(['18:30', '09:00', '09:00', '25:00', 'ab', '']), ['09:00', '18:30'])
})

test('descrizione della pianificazione', () => {
  assert.equal(describeSchedule(r({ repeat_kind: 'daily', times: ['09:00', '18:00'] })), 'Ogni giorno · 09:00, 18:00')
  assert.equal(describeSchedule(r({ repeat_kind: 'weekly', weekdays: ['mon', 'fri'] })), 'Giorni scelti (Lun Ven) · 09:00')
})

test('validazione del modulo promemoria', () => {
  const ok = { message: 'Chiudi i cancelli', repeat_kind: 'once', weekdays: [], times: ['09:00'], start_date: '2026-10-31', end_date: '' }
  assert.equal(validateReminder(ok), null)
  assert.match(validateReminder({ ...ok, message: '  ' }), /messaggio/)
  assert.match(validateReminder({ ...ok, repeat_kind: 'weekly' }), /giorno/)
  assert.match(validateReminder({ ...ok, times: ['', '99:99'] }), /orario/)
  assert.match(validateReminder({ ...ok, end_date: '2026-10-01' }), /fine/)
})

test('"quanto tempo fa"', () => {
  const now = new Date('2026-10-31T12:00:00Z').getTime()
  assert.equal(agoLabel('2026-10-31T11:59:40Z', now), 'ora')
  assert.equal(agoLabel('2026-10-31T11:48:00Z', now), '12 min fa')
  assert.equal(agoLabel('2026-10-31T09:00:00Z', now), '3 h fa')
  assert.equal(agoLabel('2026-10-28T12:00:00Z', now), '3 g fa')
})
