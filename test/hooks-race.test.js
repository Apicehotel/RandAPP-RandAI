import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const hooks = readFileSync(fileURLToPath(new URL('../src/lib/hooks.js', import.meta.url)), 'utf8')
const interventions = readFileSync(fileURLToPath(new URL('../src/data/interventions.js', import.meta.url)), 'utf8')
const issues = readFileSync(fileURLToPath(new URL('../src/data/issues.js', import.meta.url)), 'utf8')
const notifications = readFileSync(fileURLToPath(new URL('../src/data/notifications.js', import.meta.url)), 'utf8')
const pinAuth = readFileSync(fileURLToPath(new URL('../supabase/functions/randapp-pin-auth/index.ts', import.meta.url)), 'utf8')

test('useAsync invalida le risposte vecchie con un contatore di generazione', () => {
  assert.match(hooks, /const gen = useRef\(0\)/)
  assert.match(hooks, /mine === gen\.current/)
  assert.match(hooks, /gen\.current \+= 1/)
})

test('chiusura intervento/segnalazione salva completed_by_name', () => {
  assert.match(interventions, /completed_by_name:\s*done \? \(name \|\| null\) : null/)
  assert.match(issues, /completed_by_name:\s*done \? \(name \|\| null\) : null/)
})

test('notifiche: markRead e setDeviceActive filtrano hotel_id', () => {
  assert.match(notifications, /export async function markRead\(hotelId, userId, ids\)/)
  assert.match(notifications, /\.eq\('hotel_id', hotelId\)\.eq\('user_id', userId\)\.in\('id', ids\)/)
  assert.match(notifications, /export async function setDeviceActive\(hotelId, id, active\)/)
  assert.match(notifications, /\.eq\('hotel_id', hotelId\)\.eq\('id', id\)/)
})

test('pin-auth: rate-limit anche su login e admin_login', () => {
  assert.match(pinAuth, /function allowLogin/)
  assert.match(pinAuth, /function allowAdminLogin/)
  assert.match(pinAuth, /if \(!allowLogin\(req\)\)/)
  assert.match(pinAuth, /if \(!allowAdminLogin\(req\)\)/)
})
