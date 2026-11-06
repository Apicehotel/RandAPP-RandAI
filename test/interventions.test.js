import test from 'node:test'
import assert from 'node:assert/strict'
import {
  filterInterventions, sortInterventions, summarizeInterventions, localInputToIso, interventionStatusLabel,
  roomsProgress, interventionPeople,
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

test('roomsProgress segue l ordine di rooms e conta le fatte', () => {
  const item = { rooms: ['101', '102', '103'], rooms_done: { '102': { at: '2026-11-02T09:00:00.000Z', by: 'Luca' } } }
  const p = roomsProgress(item)
  assert.equal(p.total, 3)
  assert.equal(p.done, 1)
  assert.deepEqual(p.rooms.map((r) => r.room), ['101', '102', '103'])
  assert.deepEqual(p.rooms[1], { room: '102', done: true, at: '2026-11-02T09:00:00.000Z', by: 'Luca' })
  assert.equal(p.rooms[0].done, false)
})

test('roomsProgress: rooms_done assente, null o vuoto -> 0 fatte', () => {
  for (const rooms_done of [undefined, null, {}]) {
    const p = roomsProgress({ rooms: ['101', '102'], rooms_done })
    assert.equal(p.total, 2)
    assert.equal(p.done, 0)
  }
})

test('roomsProgress: senza camere -> total 0 e nessuna riga', () => {
  for (const rooms of [undefined, null, []]) {
    assert.deepEqual(roomsProgress({ rooms, rooms_done: { '101': { at: null, by: null } } }), { total: 0, done: 0, rooms: [] })
  }
})

test('roomsProgress: una camera fuori da rooms viene ignorata', () => {
  const p = roomsProgress({ rooms: ['101'], rooms_done: { '999': { at: null, by: null } } })
  assert.equal(p.done, 0)
  assert.equal(p.rooms.length, 1)
})

test('roomsProgress: at e by nulli -> fatta senza data né nome', () => {
  const p = roomsProgress({ rooms: ['101'], rooms_done: { '101': { at: null, by: null } } })
  assert.deepEqual(p.rooms[0], { room: '101', done: true, at: null, by: null })
})

test('interventionPeople: created_by_name, poi il profilo, altrimenti null', () => {
  const staff = [{ user_id: 'u1', display_name: 'Anna' }]
  assert.equal(interventionPeople({ created_by_name: '  Marco ', created_by: 'u1' }, staff).createdBy, 'Marco')
  assert.equal(interventionPeople({ created_by_name: null, created_by: 'u1' }, staff).createdBy, 'Anna')
  assert.equal(interventionPeople({ created_by_name: null, created_by: 'zz' }, staff).createdBy, null)
  assert.equal(interventionPeople({ created_by_name: null, created_by: null }, undefined).createdBy, null)
})

test('interventionPeople: completedBy solo se fatto e con nome', () => {
  assert.equal(interventionPeople({ status: 'fatto', completed_by_name: 'Luca' }, []).completedBy, 'Luca')
  assert.equal(interventionPeople({ status: 'in_corso', completed_by_name: 'Luca' }, []).completedBy, null)
  assert.equal(interventionPeople({ status: 'fatto', completed_by_name: null }, []).completedBy, null)
})
