import test from 'node:test'
import assert from 'node:assert/strict'
import {
  filterInterventions, sortInterventions, summarizeInterventions, localInputToIso, interventionStatusLabel,
} from '../src/lib/interventions.js'

const mk = (id, status, scheduled_at, created_at = '2026-10-01T10:00:00Z') => ({ id, status, scheduled_at, created_at })

test('il filtro predefinito mostra solo gli aperti', () => {
  const items = [mk('a', 'da_fare'), mk('b', 'in_corso'), mk('c', 'fatto')]
  assert.deepEqual(filterInterventions(items, 'aperti').map((i) => i.id), ['a', 'b'])
  assert.deepEqual(filterInterventions(items, 'fatti').map((i) => i.id), ['c'])
  assert.equal(filterInterventions(items, 'tutti').length, 3)
})

test('ordine: prima in corso, poi programmati più vicini, poi senza data', () => {
  const items = [
    mk('senza', 'da_fare', null, '2026-10-01T10:00:00Z'),
    mk('tardi', 'da_fare', '2026-11-10T08:00:00Z'),
    mk('presto', 'da_fare', '2026-11-02T08:00:00Z'),
    mk('corso', 'in_corso', '2026-12-01T08:00:00Z'),
  ]
  assert.deepEqual(sortInterventions(items).map((i) => i.id), ['corso', 'presto', 'tardi', 'senza'])
})

test('riepilogo e etichette', () => {
  const items = [mk('a', 'da_fare'), mk('b', 'in_corso'), mk('c', 'fatto')]
  assert.deepEqual(summarizeInterventions(items), { open: 2, running: 1 })
  assert.equal(interventionStatusLabel('in_corso'), 'In corso')
})

test('data del modulo -> ISO, vuoto o non valido -> null', () => {
  assert.equal(localInputToIso(''), null)
  assert.equal(localInputToIso('boh'), null)
  assert.match(localInputToIso('2026-11-02T09:30'), /^2026-11-02T\d\d:\d\d:00\.000Z$/)
})
