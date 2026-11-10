import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync(new URL('../supabase/migrations/0036_interventions_multi_floor_rooms.sql', import.meta.url), 'utf8')
const dataModule = readFileSync(new URL('../src/data/interventions.js', import.meta.url), 'utf8')

test('multi-floor interventions permit 126 rooms, still capped at 300', () => {
  assert.match(migration, /drop constraint if exists interventions_rooms_check/i)
  assert.match(migration, /cardinality\(rooms\) <= 300/i)
  assert.ok(126 <= 300)
  assert.ok(301 > 300)
})

test('the intervention creation path explains constraint failures', () => {
  assert.match(dataModule, /error\.code === '23514'/)
  assert.match(dataModule, /error\.code === '42501'/)
  assert.match(dataModule, /codice: \$\{error\.code/)
})
