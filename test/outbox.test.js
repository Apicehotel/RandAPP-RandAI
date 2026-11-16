import test from 'node:test'
import assert from 'node:assert/strict'
import {
  enqueue, listOutbox, removeEntry, dropPending, flushQueue, isNetworkError, isAuthError, fail, withTimeout, newId, OUTBOX_MAX, _resetForTests,
} from '../src/lib/outbox.js'
import { readThrough, purgeCache, claimCache, saveContext, cachedContext, storedSessionUserId } from '../src/lib/offline-cache.js'
import { applyPendingRooms } from '../src/lib/housekeeping.js'

const memory = () => {
  const m = new Map()
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k),
    key: (i) => [...m.keys()][i] ?? null, get length() { return m.size },
  }
}
const issue = (userId = 'u1', hotelId = 'h1', title = 'Rubinetto') => ({ kind: 'issue.create', hotelId, userId, payload: { row: { id: newId(), title } } })
const hk = (kind, roomId, extra, userId = 'u1') => ({ kind, hotelId: 'h1', userId, payload: { roomId, ...extra } })

test('isNetworkError: riconosce la rete assente, non i rifiuti del server', () => {
  assert.equal(isNetworkError(new TypeError('Failed to fetch'), true), true)
  assert.equal(isNetworkError({ message: 'TypeError: Load failed' }, true), true)
  assert.equal(isNetworkError({ name: 'AuthRetryableFetchError', message: 'x' }, true), true)
  assert.equal(isNetworkError({ message: 'qualunque', code: '' }, false), true) // telefono offline e nessun codice dal server
  assert.equal(isNetworkError({ message: 'permission denied', code: '42501' }, false), false)
  assert.equal(isNetworkError({ message: 'duplicate key', code: '23505' }, true), false)
  assert.equal(isNetworkError(null), false)
  assert.equal(fail('Impossibile', new TypeError('Failed to fetch')).network, true)
  assert.equal(fail('Impossibile', { code: '42501', message: 'rls' }).network, false)
})

test('withTimeout: una richiesta appesa diventa un errore di rete', async () => {
  await assert.rejects(withTimeout(new Promise(() => {}), 10), (e) => e.network === true)
  assert.equal(await withTimeout(Promise.resolve('ok'), 50), 'ok')
})

test('enqueue/listOutbox: salva, filtra per utente e struttura, scarta', () => {
  const storage = memory()
  const a = enqueue(issue('u1'), { storage }); enqueue(issue('u2'), { storage }); enqueue(issue('u1', 'h2'), { storage })
  assert.equal(listOutbox({ userId: 'u1' }, { storage }).length, 2)
  assert.equal(listOutbox({ userId: 'u1', hotelId: 'h1' }, { storage }).length, 1)
  removeEntry(a.id, { storage })
  assert.equal(listOutbox({ userId: 'u1', hotelId: 'h1' }, { storage }).length, 0)
})

test('enqueue: senza archivio o con coda piena NON finge di aver salvato', () => {
  assert.equal(enqueue(issue(), { storage: null }), null)
  const storage = memory()
  for (let i = 0; i < OUTBOX_MAX; i += 1) assert.ok(enqueue(issue('u1', 'h1', `t${i}`), { storage }))
  assert.equal(enqueue(issue(), { storage }), null)
  const broken = { getItem: () => '[]', setItem: () => { throw new Error('quota') } }
  assert.equal(enqueue(issue(), { storage: broken }), null)
})

test('camere: più tocchi sulla stessa camera diventano una voce, l\'ultima vince', () => {
  const storage = memory()
  enqueue(hk('hk.status', 'r1', { status: 'in_corso' }), { storage })
  enqueue(hk('hk.status', 'r1', { status: 'fatto' }), { storage })
  enqueue(hk('hk.status', 'r2', { status: 'fatto' }), { storage })
  enqueue(hk('hk.note', 'r1', { note: 'ok' }), { storage }) // la nota non cancella lo stato
  const list = listOutbox({ userId: 'u1' }, { storage })
  assert.equal(list.length, 3)
  assert.equal(list.find((e) => e.kind === 'hk.status' && e.payload.roomId === 'r1').payload.status, 'fatto')
})

test('dropPending: una scrittura riuscita in diretta toglie le vecchie voci della camera', () => {
  const storage = memory()
  enqueue(hk('hk.status', 'r1', { status: 'in_corso' }), { storage })
  enqueue(hk('hk.status', 'r2', { status: 'fatto' }), { storage })
  dropPending({ kind: 'hk.status', hotelId: 'h1', userId: 'u1', roomId: 'r1' }, { storage })
  assert.deepEqual(listOutbox({}, { storage }).map((e) => e.payload.roomId), ['r2'])
})

test('flushQueue: invia in ordine e svuota; solo le voci dell\'utente collegato', async () => {
  _resetForTests()
  const storage = memory()
  enqueue(issue('u1', 'h1', 'prima'), { storage }); enqueue(issue('u2', 'h1', 'altro utente'), { storage }); enqueue(issue('u1', 'h1', 'seconda'), { storage })
  const sent = []
  const res = await flushQueue(async (e) => { sent.push(e.payload.row.title) }, { userId: 'u1', storage })
  assert.deepEqual(sent, ['prima', 'seconda'])
  assert.deepEqual([res.sent, res.failed, res.remaining, res.stopped], [2, 0, 0, null])
  assert.equal(listOutbox({ userId: 'u2' }, { storage }).length, 1) // intatta
})

test('flushQueue: senza rete si ferma, conserva l\'ordine e riprova dopo', async () => {
  _resetForTests()
  const storage = memory()
  enqueue(issue('u1', 'h1', 'a'), { storage }); enqueue(issue('u1', 'h1', 'b'), { storage })
  let calls = 0
  const down = async () => { calls += 1; throw fail('x', new TypeError('Failed to fetch')) }
  const r1 = await flushQueue(down, { userId: 'u1', storage })
  assert.deepEqual([r1.sent, r1.remaining, r1.stopped, calls], [0, 2, 'network', 1]) // non martella le altre voci
  const sent = []
  const r2 = await flushQueue(async (e) => { sent.push(e.payload.row.title) }, { userId: 'u1', storage })
  assert.deepEqual([sent, r2.remaining], [['a', 'b'], 0])
})

test('flushQueue: sessione da rinnovare = si ferma senza perdere nulla', async () => {
  _resetForTests()
  const storage = memory()
  enqueue(issue('u1'), { storage })
  const r = await flushQueue(async () => { throw Object.assign(new Error('JWT expired'), { status: 401 }) }, { userId: 'u1', storage })
  assert.deepEqual([r.stopped, r.remaining, r.failed], ['auth', 1, 0])
  assert.equal(isAuthError(Object.assign(new Error('x'), { cause: { status: 401 } })), true)
})

test('flushQueue: errore del server = «non inviata» visibile, non si ripete, le altre proseguono', async () => {
  _resetForTests()
  const storage = memory()
  enqueue(issue('u1', 'h1', 'rifiutata'), { storage }); enqueue(issue('u1', 'h1', 'buona'), { storage })
  const sent = []
  const r = await flushQueue(async (e) => {
    if (e.payload.row.title === 'rifiutata') throw fail('Impossibile', { code: '42501', message: 'permission denied' })
    sent.push(e.payload.row.title)
  }, { userId: 'u1', storage })
  assert.deepEqual([r.sent, r.failed, r.remaining, sent], [1, 1, 0, ['buona']])
  const left = listOutbox({ userId: 'u1' }, { storage })
  assert.equal(left.length, 1)
  assert.equal(left[0].status, 'failed')
  assert.match(left[0].error, /permission denied/)
  const again = await flushQueue(async () => { throw new Error('non deve rientrare') }, { userId: 'u1', storage })
  assert.equal(again.sent + again.failed, 0) // le «non inviate» non si ritentano da sole
})

test('flushQueue: due chiamate insieme non inviano due volte', async () => {
  _resetForTests()
  const storage = memory()
  enqueue(issue('u1'), { storage })
  let calls = 0
  const run = async () => { calls += 1; await new Promise((r) => setTimeout(r, 20)) }
  await Promise.all([flushQueue(run, { userId: 'u1', storage }), flushQueue(run, { userId: 'u1', storage })])
  assert.equal(calls, 1)
})

test('readThrough: tiene la copia, la ridà solo senza rete, gli altri errori passano', async () => {
  const storage = memory()
  assert.deepEqual(await readThrough('rooms:h1', async () => [{ id: 1 }], { storage }), [{ id: 1 }])
  assert.deepEqual(await readThrough('rooms:h1', async () => { throw fail('x', new TypeError('Failed to fetch')) }, { storage }), [{ id: 1 }])
  await assert.rejects(readThrough('rooms:h1', async () => { throw fail('permessi', { code: '42501' }) }, { storage }), { message: 'permessi' })
  await assert.rejects(readThrough('mai-visto', async () => { throw fail('x', new TypeError('Failed to fetch')) }, { storage }), { message: 'x' })
  await readThrough('lunga', async () => [1, 2, 3, 4], { storage, limit: 2 })
  assert.deepEqual(await readThrough('lunga', async () => { throw fail('x', new TypeError('Failed to fetch')) }, { storage }), [1, 2])
})

test('readThrough: offline mostra subito la copia senza nemmeno provare il server', async () => {
  const storage = memory()
  await readThrough('rooms:h1', async () => ['dal server'], { storage })
  let called = false
  const data = await readThrough('rooms:h1', async () => { called = true; return ['nuovo'] }, { storage, online: false })
  assert.deepEqual([data, called], [['dal server'], false])
  // offline ma senza copia: si prova comunque
  assert.deepEqual(await readThrough('altra', async () => ['x'], { storage, online: false }), ['x'])
})

test('copia locale: appartiene a un utente, si svuota se ne entra un altro o all\'uscita', async () => {
  const storage = memory()
  claimCache('u1', storage)
  await readThrough('issues:h1', async () => [{ id: 'segreta' }], { storage })
  claimCache('u1', storage) // stesso utente: resta
  assert.equal(storage.getItem('randapp.cache.issues:h1') !== null, true)
  claimCache('u2', storage) // altro utente: sparisce
  assert.equal(storage.getItem('randapp.cache.issues:h1'), null)
  storage.setItem('randapp.outbox.v1', '[1]'); storage.setItem('altro', 'x')
  purgeCache(storage)
  assert.equal(storage.getItem('randapp.outbox.v1'), '[1]') // la coda non si tocca
  assert.equal(storage.getItem('altro'), 'x')
})

test('contesto offline: solo stessa struttura e stesso utente della sessione salvata', () => {
  const storage = memory()
  saveContext({ userId: 'u1', name: 'Anna', hotelId: 'h1', role: 'reception', permissions: new Set(['issues.view']) }, storage)
  const ok = cachedContext('h1', 'u1', storage)
  assert.equal(ok.name, 'Anna'); assert.equal(ok.offline, true); assert.equal(ok.permissions.has('issues.view'), true)
  assert.equal(cachedContext('h2', 'u1', storage), null)
  assert.equal(cachedContext('h1', 'u2', storage), null)
  assert.equal(cachedContext('h1', null, storage), null)
})

test('storedSessionUserId legge la sessione salvata da supabase-js, anche scaduta', () => {
  const storage = memory()
  assert.equal(storedSessionUserId(storage), null)
  storage.setItem('sb-abc-auth-token', JSON.stringify({ access_token: 'x', refresh_token: 'r', expires_at: 1, user: { id: 'u9' } }))
  assert.equal(storedSessionUserId(storage), 'u9')
  storage.setItem('sb-abc-auth-token', JSON.stringify({ user: { id: 'u9' } })) // senza refresh token non è recuperabile
  assert.equal(storedSessionUserId(storage), null)
})

test('applyPendingRooms mostra subito le modifiche in coda e le segna', () => {
  const rooms = [{ id: 'r1', status: 'dafare', note: null }, { id: 'r2', status: 'dafare' }]
  const entries = [
    { status: 'pending', kind: 'hk.status', payload: { roomId: 'r1', status: 'fatto' } },
    { status: 'pending', kind: 'hk.note', payload: { roomId: 'r1', note: 'pulita' } },
    { status: 'failed', kind: 'hk.status', payload: { roomId: 'r2', status: 'fatto' } },
    { status: 'pending', kind: 'issue.create', payload: { row: {} } },
  ]
  const out = applyPendingRooms(rooms, entries)
  assert.deepEqual(out[0], { id: 'r1', status: 'fatto', note: 'pulita', pending: true })
  assert.deepEqual(out[1], { id: 'r2', status: 'dafare' }) // le «non inviate» non cambiano la vista
  assert.equal(applyPendingRooms(rooms, []), rooms)
})

import { newlyReady, wantsReadyAlerts } from '../src/lib/housekeeping.js'

test('newlyReady: solo le camere passate a «fatta» tra due letture', () => {
  const R = (id, status, extra = {}) => ({ id, room: id, status, active: true, ...extra })
  const before = [R('1', 'dafare'), R('2', 'in_corso'), R('3', 'fatto'), R('4', 'dafare')]
  const after = [R('1', 'fatto'), R('2', 'fatto'), R('3', 'fatto'), R('4', 'in_corso'), R('5', 'fatto')]
  assert.deepEqual(newlyReady(before, after).map((r) => r.id), ['1', '2']) // 3 era già pronta, 5 è nuova nell'elenco
  assert.deepEqual(newlyReady(null, after), []) // prima lettura: niente annunci
  const reset = before.map((r) => ({ ...r, status: 'dafare' }))
  assert.deepEqual(newlyReady(after, reset), []) // «Riparti da zero»
  assert.deepEqual(newlyReady(before, [R('1', 'fatto', { active: false })]), []) // camera tolta dall'elenco
})

test('wantsReadyAlerts: reception e portiere notturno, non chi pulisce', () => {
  assert.deepEqual(['reception', 'portiere_notturno', 'governante', 'manutentore', 'admin'].map(wantsReadyAlerts), [true, true, false, false, false])
})
