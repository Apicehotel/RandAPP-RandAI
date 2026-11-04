import test from 'node:test'
import assert from 'node:assert/strict'
import { sortByPriority, workQueue, summarize, filterByStatus } from '../src/lib/queue.js'

const issue = (id, urgency, status, created_at) => ({ id, urgency, status, created_at })

const sample = [
  issue('a', 'normale', 'da_fare', '2026-10-01T08:00:00Z'),
  issue('b', 'urgente', 'da_fare', '2026-10-03T08:00:00Z'),
  issue('c', 'urgente', 'tecnico', '2026-10-02T08:00:00Z'),
  issue('d', 'bassa', 'completata', '2026-09-01T08:00:00Z'),
  issue('e', 'alta', 'attesa_pezzo', '2026-10-01T09:00:00Z'),
]

test('ordina per urgenza, a parità la più vecchia prima', () => {
  assert.deepEqual(sortByPriority(sample).map((i) => i.id), ['c', 'b', 'e', 'a', 'd'])
})

test('la coda di lavoro esclude le completate e rispetta il limite', () => {
  assert.deepEqual(workQueue(sample).map((i) => i.id), ['c', 'b', 'e', 'a'])
  assert.equal(workQueue(sample, 2).length, 2)
})

test('riepilogo conta solo le aperte', () => {
  assert.deepEqual(summarize(sample), { open: 4, urgent: 2, waitingPart: 1, withTechnician: 1 })
})

test('filtro per stato; "tutte" e vuoto non filtrano', () => {
  assert.equal(filterByStatus(sample, 'da_fare').length, 2)
  assert.equal(filterByStatus(sample, 'tutte').length, 5)
  assert.equal(filterByStatus(sample, undefined).length, 5)
})

test('non modifica l\'array originale', () => {
  const copy = [...sample]
  sortByPriority(sample)
  assert.deepEqual(sample, copy)
})

import { issueStats } from '../src/lib/queue.js'
import { interventionStats } from '../src/lib/interventions.js'

test('statistiche Operatività: aperte, urgenti, fatte oggi', () => {
  const at = (d) => new Date(`${d}T10:00:00`).toISOString()
  const issues = [
    { status: 'aperta', urgency: 'urgente' },
    { status: 'in_corso', urgency: 'normale' },
    { status: 'completata', completed_at: at('2026-11-04') },
    { status: 'completata', completed_at: at('2026-11-03') },
  ]
  assert.deepEqual(issueStats(issues, '2026-11-04'), { open: 2, urgent: 1, done: 1 })
  const items = [
    { status: 'programmato' },
    { status: 'in_corso' },
    { status: 'fatto', completed_at: at('2026-11-04') },
    { status: 'fatto', completed_at: at('2026-11-01') },
  ]
  assert.deepEqual(interventionStats(items, '2026-11-04'), { open: 2, running: 1, done: 1 })
})
