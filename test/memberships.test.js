import test from 'node:test'
import assert from 'node:assert/strict'
import { hotelsForMemberships } from '../src/lib/memberships.js'

const ALL = [{ id: 'hotelgio', name: 'Giò' }, { id: 'chocohotel', name: 'Choco' }, { id: 'brigantino', name: 'Brigantino' }]

test('mostra solo le strutture dell\'utente, nell\'ordine canonico, col ruolo', () => {
  const out = hotelsForMemberships(
    [{ hotel_id: 'brigantino', role: 'reception' }, { hotel_id: 'hotelgio', role: 'manutentore' }],
    ALL,
  )
  assert.deepEqual(out.map((h) => [h.id, h.role]), [['hotelgio', 'manutentore'], ['brigantino', 'reception']])
})

test('ignora strutture sconosciute e gestisce l\'assenza di dati', () => {
  assert.deepEqual(hotelsForMemberships([{ hotel_id: 'altro', role: 'admin' }], ALL), [])
  assert.deepEqual(hotelsForMemberships(null, ALL), [])
  assert.deepEqual(hotelsForMemberships([], ALL), [])
})
