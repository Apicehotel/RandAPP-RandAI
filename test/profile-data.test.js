import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isValidUsername, normalizeName, normalizeUsername, profileError } from '../src/lib/profile.js'
import { isValidEmail } from '../src/lib/recovery.js'

test('username: minuscolo, 3-30 caratteri, vuoto ammesso', () => {
  assert.equal(normalizeUsername('  Mario.Rossi '), 'mario.rossi')
  for (const ok of ['', 'abc', 'mario.rossi', 'm-r_99', 'a'.repeat(30)]) assert.ok(isValidUsername(ok), ok)
  for (const bad of ['ab', '.mario', 'mario rossi', 'mario@x', 'a'.repeat(31), 'è12']) assert.ok(!isValidUsername(bad), bad)
})

test('nome: spazi puliti', () => {
  assert.equal(normalizeName('  Maria   Grazia '), 'Maria Grazia')
})

test('profileError: primo errore o vuoto', () => {
  const base = { username: 'mario', firstName: 'Mario', lastName: 'Rossi', email: '' }
  assert.equal(profileError(base, isValidEmail), '')
  assert.match(profileError({ ...base, username: 'a' }, isValidEmail), /Username/)
  assert.match(profileError({ ...base, email: 'non-email' }, isValidEmail), /Email/)
  assert.match(profileError({ ...base, firstName: 'x'.repeat(61) }, isValidEmail), /lungo/)
  assert.equal(profileError({ ...base, email: 'a@b.it' }, isValidEmail), '')
})

test('0029: campi non leggibili dal browser, username unico, email non più unica', () => {
  const dir = fileURLToPath(new URL('../supabase/migrations/', import.meta.url))
  const sql = readFileSync(join(dir, readdirSync(dir).find((f) => f.startsWith('0029'))), 'utf8')
  assert.match(sql, /create unique index profiles_username_uidx/)
  assert.match(sql, /drop index if exists randapp\.profiles_email_uidx/)
  assert.doesNotMatch(sql, /grant select \(/i)
  assert.match(sql, /grant execute on function randapp\.get_my_profile\(\), randapp\.set_my_profile\(text, text, text\) to authenticated/)
  assert.doesNotMatch(sql, /update randapp\.profiles[^;]*display_name\s*=/)
})

test('0029: sulle segnalazioni WhatsApp nome e cognome al posto del numero, ricollegate quando cambiano', () => {
  const dir = fileURLToPath(new URL('../supabase/migrations/', import.meta.url))
  const sql = readFileSync(join(dir, readdirSync(dir).find((f) => f.startsWith('0029'))), 'utf8')
  assert.match(sql, /concat_ws\(' ', pr\.first_name, pr\.last_name\)/)
  assert.match(sql, /update of phone, display_name, first_name, last_name, active/)
})

test('login: la ricerca trova anche per username esatto, senza elencare gli username', () => {
  const fn = readFileSync(fileURLToPath(new URL('../supabase/functions/randapp-pin-auth/index.ts', import.meta.url)), 'utf8')
  assert.match(fn, /p\.username = \$\{q\.toLowerCase\(\)\}/)
  assert.doesNotMatch(fn, /select[^`]*p\.username[^`]*from randapp\.hotel_memberships/)
})
