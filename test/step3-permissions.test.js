import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('gestione permessi globali: controllo server su tutte le strutture attive', () => {
  const sql = read('supabase/migrations/0035_global_role_admin_guard.sql')
  assert.match(sql, /auth\.uid\(\) is not null/)
  assert.match(sql, /has_permission\(p_hotel, 'admin\.access'\)/)
  assert.match(sql, /h\.active/)
  assert.match(sql, /m\.hotel_id = h\.id/)
  assert.match(sql, /m\.active/)
  assert.match(sql, /m\.role = 'admin'/)
  assert.match(sql, /if not randapp\.can_manage_global_roles\(p_hotel\) then/)
  assert.match(sql, /revoke all on function randapp\.admin_role_set\(text, text, text, boolean\) from public, anon/)
})

test('interfaccia Ruoli: blocco sia visivo sia nel gestore del click', () => {
  const ui = read('src/screens/Settings.jsx')
  assert.match(ui, /api\.canManageGlobalRoles\(ctx\.hotelId\)/)
  assert.match(ui, /if \(canEditGlobal !== true\) return/)
  assert.match(ui, /disabled=\{globalLoading \|\| canEditGlobal !== true/)
  assert.match(ui, /Sola lettura:/)
})

test('test di integrazione isolato: account sintetici e rollback obbligatorio', () => {
  const sql = read('supabase/tests/global_roles_preview.sql')
  assert.match(sql, /^BEGIN;/m)
  assert.match(sql, /^ROLLBACK;/m)
  assert.match(sql, /PERFORM randapp\.admin_role_set\('hotelgio'/)
  assert.match(sql, /WHEN insufficient_privilege THEN/)
  assert.match(sql, /IF randapp\.can_manage_global_roles\('hotelgio'\) THEN/)
  assert.match(sql, /IF randapp\.has_permission\('chocohotel', 'issues\.view'\) THEN/)
})
