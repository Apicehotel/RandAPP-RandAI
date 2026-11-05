import test from 'node:test'
import assert from 'node:assert/strict'
import { groupPermissions, rolesMatrix, formatBytes, isValidPin, deliverySummary, permGroupLabel, permActionLabel } from '../src/lib/admin.js'

test('permessi raggruppati con nomi leggibili', () => {
  const g = groupPermissions(['issues.view', 'issues.create', 'admin.access', 'issues.view'])
  assert.deepEqual(g.map((x) => x.label), ['Amministrazione', 'Segnalazioni'])
  assert.deepEqual(g[1].perms, ['issues.create', 'issues.view'])
  assert.equal(permGroupLabel('planning_sale.manage'), 'Planning sale')
  assert.equal(permActionLabel('planning_sale.manage'), 'gestire')
})

test('matrice ruoli: tutti i ruoli presenti anche se vuoti', () => {
  const m = rolesMatrix([{ role: 'admin', permission: 'admin.access' }])
  assert.ok(m.admin.has('admin.access'))
  assert.equal(m.reception.size, 0)
})

test('formati e PIN', () => {
  assert.equal(formatBytes(512), '512 B')
  assert.equal(formatBytes(1536), '2 KB')
  assert.equal(formatBytes(5 * 1024 ** 2), '5.0 MB')
  assert.ok(isValidPin('0123'))
  assert.ok(!isValidPin('12a4'))
  assert.ok(!isValidPin('123'))
})

test('riepilogo invii per canale', () => {
  const s = deliverySummary([{ channel: 'whatsapp', status: 'sent', n: 3 }, { channel: 'whatsapp', status: 'failed', n: 1 }])
  assert.deepEqual(s, { whatsapp: { sent: 3, failed: 1 } })
})
