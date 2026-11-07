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

import { usagePercent, activityBars } from '../src/lib/admin.js'
import { readFileSync as readSql, readdirSync as listSql } from 'node:fs'
import { join as joinPath } from 'node:path'
import { fileURLToPath as toPath } from 'node:url'

test('consumi: percentuale delle connessioni, mai oltre 0-100 e senza massimo niente barra', () => {
  assert.equal(usagePercent(30, 60), 50)
  assert.equal(usagePercent(5, 0), null)
  assert.equal(usagePercent('x', 60), null)
  assert.equal(usagePercent(90, 60), 100)
  assert.equal(usagePercent(-3, 60), 0)
})

test('consumi: barre di attività sul giorno più alto, totali giusti, dati mancanti ok', () => {
  const r = activityBars([{ date: '2026-11-01', issues: 2, interventions: 2 }, { date: '2026-11-02', issues: 1, interventions: 0 }, { date: '2026-11-03' }])
  assert.deepEqual(r.bars.map((b) => b.height), [100, 25, 0])
  assert.equal(r.issues, 3)
  assert.equal(r.interventions, 2)
  assert.deepEqual(activityBars(null), { bars: [], issues: 0, interventions: 0 })
})

test('0030: admin_usage con permesso admin, un solo group by per tabella, chiavi di prima conservate', () => {
  const dir = toPath(new URL('../supabase/migrations/', import.meta.url))
  const sql = readSql(joinPath(dir, listSql(dir).find((f) => f.startsWith('0030'))), 'utf8')
  assert.match(sql, /has_permission\(p_hotel, 'admin\.access'\)/)
  for (const k of ['errors_7d', 'db_bytes', 'photos_bytes', 'max_connections', 'activity_30d', 'devices']) assert.ok(sql.includes(`'${k}'`), k)
  assert.equal((sql.match(/group by 1/g) || []).length, 2)
})
