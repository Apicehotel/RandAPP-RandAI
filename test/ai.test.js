import test from 'node:test'
import assert from 'node:assert/strict'
import { scrubText, queryFrom, shouldSearch, chooseProvider, localShare, toJsonl, PROVIDER_ORDER } from '../src/lib/ai.js'

test('il testo registrato non contiene numeri né email', () => {
  assert.equal(scrubText('Chiama 340 1234567 o mario@x.it per la 204'), 'Chiama [numero] o [email] per la 204')
  assert.equal(scrubText('camera 4402 piano 2'), 'camera 4402 piano 2')
})

test('testo di ricerca e soglia minima', () => {
  assert.equal(queryFrom({ title: ' Perde ', description: 'acqua', category: 'Idraulica' }), 'Perde acqua Idraulica')
  assert.ok(!shouldSearch('ab'))
  assert.ok(shouldSearch('perdita acqua'))
})

test('percorso: prima lo storico, il modello solo se serve e abilitato', () => {
  assert.deepEqual(PROVIDER_ORDER, ['rules', 'history', 'local', 'cloud'])
  assert.equal(chooseProvider({ confidence: 0.9, localReady: true, cloudAllowed: true }), 'history')
  assert.equal(chooseProvider({ confidence: 0.2, localReady: true, cloudAllowed: true }), 'local')
  assert.equal(chooseProvider({ confidence: 0.2, localReady: false, cloudAllowed: true }), 'cloud')
  assert.equal(chooseProvider({ confidence: 0.2 }), 'history')
})

test('quota locale e formato di esportazione', () => {
  assert.equal(localShare({}), null)
  assert.equal(localShare({ local: 3, cloud: 1 }), 0.75)
  const out = toJsonl([{ kind: 'storico', feature: 'classify', input: { title: 'a' }, output: { category: 'b' }, verdict: 'up', correction: null, at: '2026-01-01' }])
  assert.equal(out.split('\n').length, 1)
  assert.equal(JSON.parse(out).output.category, 'b')
})
