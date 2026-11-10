import test from 'node:test'
import assert from 'node:assert/strict'
import {
  RING_EVERY_MS, openAlerts, isPresent, canRing, shouldRing, hasNewAlert, applyPendingAlerts, issueFromAlert, sirenNotes,
} from '../src/lib/urgent.js'
import { enqueue, listOutbox, dropPending } from '../src/lib/outbox.js'

const memory = () => {
  const m = new Map()
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), key: (i) => [...m.keys()][i] ?? null, get length() { return m.size } }
}
const A = (id, status, created_at = '2026-11-10T08:00:00Z') => ({ id, status, created_at, note: `nota ${id}` })
const NOW = Date.parse('2026-11-10T10:00:00Z')

test('openAlerts: solo quelli da prendere, il più vecchio per primo', () => {
  const out = openAlerts([A('b', 'aperto', '2026-11-10T09:00:00Z'), A('c', 'in_carico'), A('a', 'aperto', '2026-11-10T07:00:00Z'), A('d', 'risolto')])
  assert.deepEqual(out.map((x) => x.id), ['a', 'b'])
  assert.deepEqual(openAlerts(null), [])
})

test('isPresent: presenza accesa e non scaduta (7 h 20); illeggibile = si suona lo stesso', () => {
  const row = (present, since) => [{ user_id: 'u1', present, since }]
  assert.equal(isPresent(row(true, '2026-11-10T08:00:00Z'), 'u1', NOW), true)
  assert.equal(isPresent(row(false, '2026-11-10T08:00:00Z'), 'u1', NOW), false)
  assert.equal(isPresent(row(true, '2026-11-10T02:00:00Z'), 'u1', NOW), false) // 8 ore fa: scaduta
  assert.equal(isPresent([], 'u1', NOW), false)
  assert.equal(isPresent(row(true, '2026-11-10T08:00:00Z'), 'u2', NOW), false)
  assert.equal(isPresent(null, 'u1', NOW), true) // lettura fallita: meglio un suono in più che un'urgenza persa
})

test('canRing: serve il permesso di prendere in carico E essere in struttura', () => {
  assert.equal(canRing({ canUpdate: true, present: true }), true)
  assert.equal(canRing({ canUpdate: true, present: false }), false)
  assert.equal(canRing({ canUpdate: false, present: true }), false)
})

test('shouldRing: subito per un avviso nuovo, poi ogni 30 secondi; mai se silenziato o senza avvisi', () => {
  const open = [A('a', 'aperto')]
  const base = { open, silenced: new Set(), ringAllowed: true, lastRingAt: NOW, now: NOW, hasNew: false }
  assert.equal(shouldRing({ ...base, now: NOW + 5000 }), false)
  assert.equal(shouldRing({ ...base, now: NOW + RING_EVERY_MS }), true)
  assert.equal(shouldRing({ ...base, hasNew: true }), true) // nuovo: non aspetta l'intervallo
  assert.equal(shouldRing({ ...base, now: NOW + RING_EVERY_MS, silenced: new Set(['a']) }), false)
  assert.equal(shouldRing({ ...base, now: NOW + RING_EVERY_MS, ringAllowed: false }), false)
  assert.equal(shouldRing({ ...base, now: NOW + RING_EVERY_MS, open: [] }), false)
  // silenziato A ma ne arriva B: suona
  assert.equal(shouldRing({ ...base, hasNew: true, open: [A('a', 'aperto'), A('b', 'aperto')], silenced: new Set(['a']) }), true)
})

test('hasNewAlert riconosce solo gli id mai visti', () => {
  assert.equal(hasNewAlert(new Set(['a']), [A('a', 'aperto')]), false)
  assert.equal(hasNewAlert(new Set(['a']), [A('a', 'aperto'), A('b', 'aperto')]), true)
})

test('applyPendingAlerts: chi ha preso in carico offline vede subito il nuovo stato; le «non inviate» no', () => {
  const alerts = [A('a', 'aperto'), A('b', 'aperto')]
  const entries = [
    { status: 'pending', kind: 'alert.status', payload: { alertId: 'a', status: 'in_carico' } },
    { status: 'failed', kind: 'alert.status', payload: { alertId: 'b', status: 'risolto' } },
    { status: 'pending', kind: 'hk.status', payload: { roomId: 'r1', status: 'fatto' } },
  ]
  const out = applyPendingAlerts(alerts, entries)
  assert.deepEqual([out[0].status, out[0].pending, out[1].status], ['in_carico', true, 'aperto'])
  assert.equal(applyPendingAlerts(alerts, []), alerts)
})

test('coda: avvisi diversi NON si fondono; lo stesso avviso sì (vince l\'ultima); una modifica in diretta toglie le vecchie', () => {
  const storage = memory()
  const e = (alertId, status) => ({ kind: 'alert.status', hotelId: 'h1', userId: 'u1', payload: { alertId, status } })
  enqueue(e('a', 'in_carico'), { storage }); enqueue(e('b', 'in_carico'), { storage }); enqueue(e('a', 'risolto'), { storage })
  const list = listOutbox({ userId: 'u1' }, { storage })
  assert.deepEqual(list.map((x) => `${x.payload.alertId}:${x.payload.status}`).sort(), ['a:risolto', 'b:in_carico'])
  dropPending({ kind: 'alert.status', hotelId: 'h1', userId: 'u1', alertId: 'a' }, { storage })
  assert.deepEqual(listOutbox({}, { storage }).map((x) => x.payload.alertId), ['b'])
})

test('issueFromAlert: titolo max 140, testo lungo nei dettagli, alta urgenza', () => {
  const short = issueFromAlert({ note: '  Allagamento al piano 2  ' })
  assert.deepEqual([short.title, short.urgency, short.category], ['Allagamento al piano 2', 'alta', 'Altro'])
  const long = issueFromAlert({ note: 'x'.repeat(250) })
  assert.equal(long.title.length, 140)
  assert.match(long.description, /x{250}/)
})

test('sirenNotes: due toni alternati, in ordine di tempo', () => {
  const n = sirenNotes(3)
  assert.equal(n.length, 6)
  assert.deepEqual([...new Set(n.map((x) => x.freq))], [880, 660])
  assert.ok(n.every((x, i) => i === 0 || x.at > n[i - 1].at))
})
