import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = fileURLToPath(new URL('../supabase/migrations/', import.meta.url))
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

test('0033: UPDATE senza hotel_id e foto legate alla segnalazione', () => {
  const harden = readFileSync(join(dir, '0033_harden_updates.sql'), 'utf8')
  assert.match(harden, /function randapp\.forbid_hotel_id_change/)
  assert.match(harden, /grant update \(\s*title, description[\s\S]*?\)\s*on randapp\.issues to authenticated/)
  assert.doesNotMatch(harden.match(/grant update \(\s*title, description[\s\S]*?\)\s*on randapp\.issues to authenticated/)?.[0] || '', /hotel_id/)
  assert.match(harden, /grant update \(\s*title, location[\s\S]*completed_by_name\s*\)\s*on randapp\.interventions to authenticated/)
  assert.match(harden, /create policy issue_photos_insert[\s\S]*exists \(\s*select 1 from randapp\.issues/)
  // La sottoquery deve confrontare esplicitamente l'hotel della foto con quello della segnalazione.
  const photoInsert = harden.match(/create policy issue_photos_insert[\s\S]*?\);/)?.[0] || ''
  assert.match(photoInsert, /randapp\.has_permission\(issue_photos\.hotel_id,\s*'issues\.update'\)/)
  assert.match(photoInsert, /i\.id\s*=\s*issue_photos\.issue_id/)
  assert.match(photoInsert, /i\.hotel_id\s*=\s*issue_photos\.hotel_id/)
  assert.doesNotMatch(photoInsert, /i\.hotel_id\s*=\s*hotel_id\b/)
  assert.match(harden, /sale_bookings_active_slot_uidx/)
})

test('0034: policy foto riapplicata da migrazione incrementale e vincolata allo stesso hotel', () => {
  const fix = readFileSync(join(dir, '0034_issue_photos_hotel_guard.sql'), 'utf8')
  assert.match(fix, /drop policy if exists issue_photos_insert on randapp\.issue_photos/)
  assert.match(fix, /create policy issue_photos_insert on randapp\.issue_photos/)
  assert.match(fix, /randapp\.has_permission\(issue_photos\.hotel_id,\s*'issues\.update'\)/)
  assert.match(fix, /i\.id\s*=\s*issue_photos\.issue_id/)
  assert.match(fix, /i\.hotel_id\s*=\s*issue_photos\.hotel_id/)
  assert.doesNotMatch(fix, /i\.hotel_id\s*=\s*hotel_id\b/)
})

test('0035: solo admin di tutti gli hotel attivi puo cambiare permessi globali', () => {
  const harden = readFileSync(join(dir, '0035_global_role_admin_guard.sql'), 'utf8')
  assert.match(harden, /function randapp\.can_manage_global_roles\(p_hotel text\)/)
  assert.match(harden, /randapp\.has_permission\(p_hotel,\s*'admin\.access'\)/)
  assert.match(harden, /m\.auth_user_id\s*=\s*auth\.uid\(\)/)
  assert.match(harden, /m\.hotel_id\s*=\s*h\.id/)
  assert.match(harden, /h\.active/)
  assert.match(harden, /m\.active/)
  assert.match(harden, /m\.role\s*=\s*'admin'/)
  assert.match(harden, /function randapp\.admin_role_set\(/)
  assert.match(harden, /if not randapp\.can_manage_global_roles\(p_hotel\) then/)
  assert.match(harden, /revoke all on function randapp\.admin_role_set\(text, text, text, boolean\) from public, anon/)
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
