import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = new URL('../supabase/migrations/', import.meta.url).pathname
const sql = readdirSync(dir)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => readFileSync(join(dir, f), 'utf8'))
  .join('\n')

const tables = [...sql.matchAll(/create table\s+(?:if not exists\s+)?randapp\.(\w+)/gi)].map((m) => m[1])

test('esistono tabelle nello schema', () => {
  assert.ok(tables.length >= 6)
})

test('ogni tabella ha la RLS attiva', () => {
  for (const t of tables) {
    const re = new RegExp(`alter table\\s+randapp\\.${t}\\s+enable row level security`, 'i')
    assert.match(sql, re, `RLS non attiva su randapp.${t}`)
  }
})

test('le segnalazioni hanno hotel_id obbligatorio', () => {
  assert.match(sql, /create table randapp\.issues[\s\S]*?hotel_id\s+text not null/i)
})

test('le credenziali PIN non sono leggibili dal browser', () => {
  assert.match(sql, /revoke all on randapp\.auth_pin_credentials from anon, authenticated/i)
  assert.doesNotMatch(sql, /create policy[^;]*on randapp\.auth_pin_credentials/i)
})

test('le segnalazioni non si cancellano dal browser', () => {
  assert.doesNotMatch(sql, /create policy[^;]*on randapp\.issues\s+for delete/i)
  assert.doesNotMatch(sql, /grant[^;]*delete[^;]*on randapp\.issues/i)
})

test('le policy sulle segnalazioni passano da has_permission con hotel_id', () => {
  const policies = [...sql.matchAll(/create policy\s+\w+\s+on randapp\.issues[\s\S]*?;/gi)].map((m) => m[0])
  assert.equal(policies.length, 3)
  for (const p of policies) assert.match(p, /has_permission\(hotel_id,/i)
})

test('gli interventi: hotel_id obbligatorio, 3 policy con has_permission, niente delete', () => {
  assert.match(sql, /create table randapp\.interventions[\s\S]*?hotel_id\s+text not null/i)
  const policies = [...sql.matchAll(/create policy\s+\w+\s+on randapp\.interventions[\s\S]*?;/gi)].map((m) => m[0])
  assert.equal(policies.length, 3)
  for (const p of policies) assert.match(p, /has_permission\(hotel_id,\s*'interventions\./i)
  assert.doesNotMatch(sql, /create policy[^;]*on randapp\.interventions\s+for delete/i)
  assert.doesNotMatch(sql, /grant[^;]*delete[^;]*on randapp\.interventions/i)
})

test('planning: hotel_id obbligatorio, 3 policy con has_permission ciascuna, niente delete', () => {
  for (const [table, prefix] of [['planning_works', 'planning_work'], ['sale_bookings', 'planning_sale']]) {
    assert.match(sql, new RegExp(`create table randapp\\.${table}[\\s\\S]*?hotel_id\\s+text not null`, 'i'))
    const policies = [...sql.matchAll(new RegExp(`create policy\\s+\\w+\\s+on randapp\\.${table}[\\s\\S]*?;`, 'gi'))].map((m) => m[0])
    assert.equal(policies.length, 3, table)
    for (const p of policies) assert.match(p, new RegExp(`has_permission\\(hotel_id,\\s*'${prefix}\\.`, 'i'))
    assert.doesNotMatch(sql, new RegExp(`create policy[^;]*on randapp\\.${table}\\s+for delete`, 'i'))
    assert.doesNotMatch(sql, new RegExp(`grant[^;]*delete[^;]*on[^;]*randapp\\.${table}`, 'i'))
  }
})

test('task: hotel_id obbligatorio, 3 policy con has_permission ciascuna, niente delete', () => {
  for (const [table, prefix] of [['urgent_alerts', 'urgent'], ['reminders', 'reminders']]) {
    assert.match(sql, new RegExp(`create table randapp\\.${table}[\\s\\S]*?hotel_id\\s+text not null`, 'i'))
    const policies = [...sql.matchAll(new RegExp(`create policy\\s+\\w+\\s+on randapp\\.${table}[\\s\\S]*?;`, 'gi'))].map((m) => m[0])
    assert.equal(policies.length, 3, table)
    for (const p of policies) assert.match(p, new RegExp(`has_permission\\(hotel_id,\\s*'${prefix}\\.`, 'i'))
    assert.doesNotMatch(sql, new RegExp(`create policy[^;]*on randapp\\.${table}\\s+for delete`, 'i'))
    assert.doesNotMatch(sql, new RegExp(`grant[^;]*delete[^;]*on[^;]*randapp\\.${table}`, 'i'))
  }
})

test('presenza: si legge con has_permission, si scrive solo con la funzione del server', () => {
  const policies = [...sql.matchAll(/create policy\s+\w+\s+on randapp\.presence[\s\S]*?;/gi)].map((m) => m[0])
  assert.equal(policies.length, 1)
  assert.match(policies[0], /for select/i)
  assert.match(policies[0], /has_permission\(hotel_id,\s*'presence\.view'/i)
  assert.match(sql, /revoke all on randapp\.presence from anon, authenticated/i)
  assert.doesNotMatch(sql, /grant[^;]*(insert|update|delete)[^;]*on randapp\.presence/i)
  assert.match(sql, /function randapp\.set_presence[\s\S]*security definer/i)
  assert.match(sql, /has_permission\(p_hotel,\s*'presence\.update'\)/i)
  assert.match(sql, /grant execute on function randapp\.set_presence\(text, boolean\) to authenticated/i)
})
