import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// auth.js importa supabase (variabili Vite): qui si prova solo la regola, copiata dal sorgente e controllata.
const src = readFileSync(fileURLToPath(new URL('../src/lib/auth.js', import.meta.url)), 'utf8')
const m = src.match(/export const isSessionLost = (.+)\n/)
const isSessionLost = new Function(`return ${m[1]}`)()

test('isSessionLost: solo SIGNED_OUT senza sessione', () => {
  assert.equal(isSessionLost('SIGNED_OUT', null), true)
  assert.equal(isSessionLost('SIGNED_OUT', { access_token: 'x' }), false)
  for (const e of ['SIGNED_IN', 'TOKEN_REFRESHED', 'INITIAL_SESSION', 'USER_UPDATED']) assert.equal(isSessionLost(e, null), false, e)
})

test('verifySession non butta fuori chi è solo offline', () => {
  assert.match(src, /rete assente o errore temporaneo: non si butta fuori nessuno/)
  assert.match(src, /signOut\(\{ scope: 'local' \}\)/)
})

test('App: avviso di sessione scaduta e controllo al ritorno sull\'app', () => {
  const app = readFileSync(fileURLToPath(new URL('../src/app/App.jsx', import.meta.url)), 'utf8')
  assert.match(app, /onSessionLost\(lost\)/)
  assert.match(app, /visibilitychange/)
  assert.match(app, /Sessione scaduta/)
})
