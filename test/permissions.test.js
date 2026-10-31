import test from 'node:test'
import assert from 'node:assert/strict'
import { can, navFor, PERM, roleLabel } from '../src/lib/permissions.js'

test('can() funziona con Set e array, e nega se non ci sono permessi', () => {
  assert.equal(can(new Set([PERM.ISSUES_VIEW]), PERM.ISSUES_VIEW), true)
  assert.equal(can([PERM.ISSUES_VIEW], PERM.ISSUES_CREATE), false)
  assert.equal(can(null, PERM.ISSUES_VIEW), false)
  assert.equal(can(undefined, PERM.ISSUES_VIEW), false)
})

test('la navigazione mostra solo le voci consentite, il Profilo sempre', () => {
  const none = navFor(new Set()).map((i) => i.id)
  assert.deepEqual(none, ['profile'])
  const viewer = navFor(new Set([PERM.ISSUES_VIEW])).map((i) => i.id)
  assert.deepEqual(viewer, ['home', 'issues', 'profile'])
})

test('etichette ruolo', () => {
  assert.equal(roleLabel('manutentore'), 'Manutentore')
  assert.equal(roleLabel('sconosciuto'), 'sconosciuto')
})
