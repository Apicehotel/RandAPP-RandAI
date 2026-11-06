import test from 'node:test'
import assert from 'node:assert/strict'
import { isValidEmail, normalizeEmail, tokenFromRoute } from '../src/lib/recovery.js'

test('email: normalizzata e controllata', () => {
  assert.equal(normalizeEmail('  Mario@Esempio.IT '), 'mario@esempio.it')
  assert.ok(isValidEmail('mario@esempio.it'))
  assert.ok(!isValidEmail('mario@esempio'))
  assert.ok(!isValidEmail('mario esempio@x.it'))
  assert.ok(!isValidEmail(''))
})

test('link: legge il token solo se lungo abbastanza', () => {
  const t = 'a'.repeat(72)
  assert.equal(tokenFromRoute(`/recover?token=${t}`), t)
  assert.equal(tokenFromRoute('/recover?token=corto'), '')
  assert.equal(tokenFromRoute('/recover'), '')
})
