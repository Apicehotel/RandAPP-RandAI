import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clearShared, shared } from '../src/lib/shared-requests.js'

test('due richieste ravvicinate con la stessa chiave fanno una sola chiamata', async () => {
  clearShared()
  let calls = 0
  const load = async () => { calls += 1; return [1, 2] }
  const [a, b] = await Promise.all([shared('k', load), shared('k', load)])
  assert.equal(calls, 1)
  assert.deepEqual(a, b)
})

test('chiavi diverse non si condividono', async () => {
  clearShared()
  let calls = 0
  const load = async () => { calls += 1; return calls }
  await shared('a', load)
  await shared('b', load)
  assert.equal(calls, 2)
})

test('dopo clearShared si rilegge dal server', async () => {
  clearShared()
  let calls = 0
  const load = async () => { calls += 1 }
  await shared('k', load)
  clearShared()
  await shared('k', load)
  assert.equal(calls, 2)
})

test('un errore non resta in memoria', async () => {
  clearShared()
  let calls = 0
  const load = async () => { calls += 1; if (calls === 1) throw new Error('x'); return 'ok' }
  await assert.rejects(shared('k', load))
  await new Promise((r) => setImmediate(r))
  assert.equal(await shared('k', load), 'ok')
  assert.equal(calls, 2)
})
