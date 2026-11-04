import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  CHANNELS, KINDS, badgeText, groupByDay, hashFor, kindGroups, kindOf, newNtfyTopic, ntfyLink, normalizePhone,
  prefFor, unreadCount, urlBase64ToBytes, webPushSupported,
} from '../src/lib/notifications.js'

test('ogni tipo del database ha un nome in app, e viceversa', () => {
  const sql = readFileSync('supabase/migrations/0013_notifications.sql', 'utf8')
  const list = sql.match(/kind\s+text not null check \(kind in \(([\s\S]*?)\)\)/)[1]
  const dbKinds = [...list.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).filter((k) => k !== 'test')
  assert.deepEqual([...dbKinds].sort(), KINDS.map((k) => k.id).sort())
  assert.equal(kindOf('boh').label, 'Notifica')
  assert.deepEqual(kindGroups().map((g) => g.name), ['Task', 'Operatività', 'Planning', 'Sensori'])
})

test('i canali dell\'app sono quelli del database', () => {
  const sql = readFileSync('supabase/migrations/0013_notifications.sql', 'utf8')
  assert.match(sql, /channel\s+text not null check \(channel in \('ntfy','push','whatsapp'\)\)/)
  assert.deepEqual(CHANNELS.map((c) => c.id).sort(), ['ntfy', 'push', 'whatsapp'])
})

test('preferenze: predefiniti e scelte dell\'utente', () => {
  assert.deepEqual(prefFor([], 'reminder'), { push: true, ntfy: true, whatsapp: false })
  assert.deepEqual(prefFor([{ kind: 'reminder', push: false, ntfy: true, whatsapp: true }], 'reminder'), { push: false, ntfy: true, whatsapp: true })
  assert.equal(prefFor([{ kind: 'x', push: false }], 'reminder').push, true)
})

test('non lette e contatore', () => {
  assert.equal(unreadCount([{ read_at: null }, { read_at: 'x' }, {}]), 2)
  assert.equal(badgeText(7), '7')
  assert.equal(badgeText(120), '99+')
})

test('raggruppamento per giorno: Oggi, Ieri, data; più recenti prima', () => {
  const now = new Date(2026, 10, 4, 12, 0)
  const at = (d, h) => new Date(2026, 10, d, h, 0).toISOString()
  const g = groupByDay([{ id: 'a', created_at: at(2, 9) }, { id: 'b', created_at: at(4, 8) }, { id: 'c', created_at: at(3, 20) }, { id: 'd', created_at: at(4, 11) }], now)
  assert.deepEqual(g.map((x) => x.label), ['Oggi', 'Ieri', '02 novembre'])
  assert.deepEqual(g[0].items.map((x) => x.id), ['d', 'b'])
})

test('i link delle notifiche diventano indirizzi dell\'app, mai altro', () => {
  assert.equal(hashFor('/issues/abc-1'), '#/issues/abc-1')
  assert.equal(hashFor('https://evil.example/x'), '#/notifications')
  assert.equal(hashFor('javascript:alert(1)'), '#/notifications')
  assert.equal(hashFor(null), '#/notifications')
})

test('topic ntfy: lungo, casuale e per struttura', () => {
  const t = newNtfyTopic('hotelgio', new Uint8Array(16).fill(171))
  assert.equal(t, 'rand-hotelgio-' + 'ab'.repeat(16))
  assert.ok(t.length >= 40)
  assert.notEqual(newNtfyTopic('hotelgio'), newNtfyTopic('hotelgio'))
  assert.equal(ntfyLink(t), 'https://ntfy.sh/' + t)
})

test('numero WhatsApp', () => {
  assert.equal(normalizePhone('+39 333 111 2233'), '+393331112233')
  assert.equal(normalizePhone('333 1112233'), '+393331112233')
  assert.equal(normalizePhone('abc'), null)
  assert.equal(normalizePhone('123'), null)
})

test('web push: supporto e chiave VAPID', () => {
  assert.equal(webPushSupported({}), false)
  assert.equal(webPushSupported({ navigator: { serviceWorker: {} }, PushManager: {}, Notification: {} }), true)
  assert.deepEqual([...urlBase64ToBytes('AQID')], [1, 2, 3])
  assert.deepEqual([...urlBase64ToBytes('-_8')], [251, 255])
})

test('avvisi urgenti e promemoria vanno solo a chi è in struttura (come nel database)', async () => {
  const { readFileSync } = await import('node:fs')
  const { KINDS } = await import('../src/lib/notifications.js')
  const sql = readFileSync(new URL('../supabase/migrations/0013_notifications.sql', import.meta.url), 'utf8')
  const onlyPresent = KINDS.filter((k) => k.presentOnly).map((k) => k.id).sort()
  assert.deepEqual(onlyPresent, ['reminder', 'urgent_alert', 'urgent_reminder'])
  for (const id of onlyPresent) {
    const call = sql.split('perform randapp.notify(').slice(1).find((c) => c.includes(`'${id}',`) && !c.includes('Avviso preso in carico'))
    assert.match(call, /,\s*true\);/, `${id} deve passare p_only_present = true`)
  }
  assert.match(sql, /presence pr/)
})
