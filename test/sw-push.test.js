import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'

const src = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8')
const ORIGIN = 'https://app.test'

// Carica sw.js con un finto ambiente da service worker e restituisce i gestori degli eventi.
function loadSw({ clients = [] } = {}) {
  const handlers = {}
  const calls = { shown: [], opened: [], waits: [] }
  const self = {
    registration: { scope: `${ORIGIN}/`, showNotification: async (title, opts) => { calls.shown.push({ title, opts }) } },
    location: { origin: ORIGIN },
    addEventListener: (name, fn) => { handlers[name] = fn },
    skipWaiting() {},
    clients: { claim() {}, matchAll: async () => clients, openWindow: async (u) => { calls.opened.push(u) } },
  }
  vm.runInNewContext(src, { self, URL, Request, Response, Promise, caches: { keys: async () => [], open: async () => ({}), match: async () => undefined }, fetch: async () => { throw new Error('rete') } })
  const run = async (name, event) => {
    event.waitUntil = (p) => calls.waits.push(Promise.resolve(p))
    handlers[name](event)
    await Promise.all(calls.waits)
  }
  return { handlers, calls, run }
}
const pushOf = (data) => ({ data: { json: () => (typeof data === 'string' ? JSON.parse(data) : data), text: () => String(data) } })

test('push: titolo, testo, tag e collegamento; l\'urgente resta finché non si tocca', async () => {
  const { calls, run } = loadSw()
  await run('push', pushOf({ title: 'Avviso urgente', body: 'Allagamento', url: `${ORIGIN}/#/task/urgent/a1`, urgent: true, tag: 'urgent_alert' }))
  const n = calls.shown[0]
  assert.deepEqual([n.title, n.opts.body, n.opts.tag, n.opts.requireInteraction], ['Avviso urgente', 'Allagamento', 'urgent_alert', true])
  assert.equal(n.opts.data.url, `${ORIGIN}/#/task/urgent/a1`)
})

test('push: senza collegamento si apre Notifiche; testo semplice non rompe; urgente solo se true', async () => {
  const { calls, run } = loadSw()
  await run('push', pushOf({ title: 'Promemoria', body: 'x', urgent: 'si' }))
  assert.equal(calls.shown[0].opts.data.url, `${ORIGIN}/#/notifications`)
  assert.equal(calls.shown[0].opts.requireInteraction, false)
  await run('push', { data: { json: () => { throw new Error('non è JSON') }, text: () => 'testo semplice' } })
  assert.deepEqual([calls.shown[1].title, calls.shown[1].opts.body], ['RandApp', 'testo semplice'])
  await run('push', { data: null })
  assert.equal(calls.shown[2].title, 'RandApp')
})

test('push: un indirizzo di un altro sito ripiega sulle Notifiche', async () => {
  const { calls, run } = loadSw()
  await run('push', pushOf({ title: 'x', url: 'https://evil.example/phish' }))
  assert.equal(calls.shown[0].opts.data.url, `${ORIGIN}/#/notifications`)
  await run('push', pushOf({ title: 'x', url: 'javascript:alert(1)' }))
  assert.equal(calls.shown[1].opts.data.url, `${ORIGIN}/#/notifications`)
})

test('tocco sulla notifica: finestra già aperta = si porta lì e la mette in primo piano', async () => {
  const seen = { nav: [], focus: 0 }
  const client = { navigate: async (u) => { seen.nav.push(u) }, focus: async () => { seen.focus += 1 } }
  const { calls, run } = loadSw({ clients: [client] })
  let closed = false
  await run('notificationclick', { notification: { close: () => { closed = true }, data: { url: `${ORIGIN}/#/task/urgent/a1` } } })
  assert.deepEqual([closed, seen.nav, seen.focus, calls.opened], [true, [`${ORIGIN}/#/task/urgent/a1`], 1, []])
})

test('tocco sulla notifica: nessuna finestra = ne apre una; indirizzo estraneo = Notifiche', async () => {
  const { calls, run } = loadSw({ clients: [] })
  await run('notificationclick', { notification: { close() {}, data: { url: `${ORIGIN}/#/issues` } } })
  await run('notificationclick', { notification: { close() {}, data: { url: 'https://evil.example/' } } })
  await run('notificationclick', { notification: { close() {}, data: null } })
  assert.deepEqual(calls.opened, [`${ORIGIN}/#/issues`, `${ORIGIN}/#/notifications`, `${ORIGIN}/#/notifications`])
})

test('fetch: non intercetta Supabase (altro dominio) né le scritture', () => {
  const { handlers } = loadSw()
  let responded = 0
  const ev = (url, method = 'GET', extra = {}) => ({ request: { url, method, mode: 'cors', headers: { has: () => false }, ...extra }, respondWith: () => { responded += 1 }, waitUntil() {} })
  handlers.fetch(ev('https://abc.supabase.co/rest/v1/issues'))
  handlers.fetch(ev(`${ORIGIN}/assets/x.js`, 'POST'))
  assert.equal(responded, 0)
  handlers.fetch(ev(`${ORIGIN}/assets/index-ABCDEFGH.js`, 'GET', { destination: 'script' }))
  assert.equal(responded, 1) // un file dell'app invece sì
})
