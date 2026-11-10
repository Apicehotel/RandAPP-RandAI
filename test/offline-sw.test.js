import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { assetPaths, isStaleBuild, checkForNewBuild } from '../src/lib/pwa.js'
import { isFutureJwtError, readWithJwtRecovery, JWT_CLOCK_USER_MESSAGE } from '../src/lib/jwt-recovery.js'

const root = new URL('../', import.meta.url)
const sw = readFileSync(new URL('public/sw.js', root), 'utf8')

const HTML_A = '<script type="module" src="/assets/index-AAAAAAAA.js"></script><link rel="stylesheet" href="/assets/index-AAAAAAAA.css">'
const HTML_B = '<script type="module" src="/assets/index-BBBBBBBB.js"></script><link rel="stylesheet" href="/assets/index-BBBBBBBB.css">'

test('assetPaths legge solo i file con /assets/ e ignora il resto', () => {
  assert.deepEqual(assetPaths(HTML_A + '<link href="/icons/icon-192.png">'), ['/assets/index-AAAAAAAA.css', '/assets/index-AAAAAAAA.js'])
  assert.deepEqual(assetPaths(''), [])
  assert.deepEqual(assetPaths(null), [])
})

test('assetPaths ignora i modulepreload (come nell\'HTML reale prodotto da Vite)', () => {
  const real = '<script type="module" crossorigin src="/assets/index-5vFqcGr9.js"></script>'
    + '<link rel="modulepreload" crossorigin href="/assets/react-vendor-KPuNr9iS.js">'
    + '<link rel="stylesheet" crossorigin href="/assets/index-YexG0i2t.css">'
  assert.deepEqual(assetPaths(real), ['/assets/index-5vFqcGr9.js', '/assets/index-YexG0i2t.css'])
  // la pagina caricata (solo script + stile) coincide con l'HTML del server: nessun ricarico
  assert.equal(isStaleBuild(assetPaths(real.replace(/<link rel="modulepreload"[^>]*>/, '')), assetPaths(real)), false)
})

test('isStaleBuild: diversa solo se ci sono file da entrambe le parti', () => {
  assert.equal(isStaleBuild(assetPaths(HTML_A), assetPaths(HTML_B)), true)
  assert.equal(isStaleBuild(assetPaths(HTML_A), assetPaths(HTML_A)), false)
  assert.equal(isStaleBuild([], assetPaths(HTML_B)), false) // sviluppo
  assert.equal(isStaleBuild(assetPaths(HTML_A), []), false) // risposta senza file
})

function fakeDoc(html, active = null) {
  const nodes = [...html.matchAll(/<(?:script|link)[^>]*>/g)].map((m) => ({ outerHTML: m[0] }))
  return { querySelectorAll: () => nodes, activeElement: active }
}
const fakeStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) } }
const htmlResponse = (html) => ({ ok: true, headers: { get: () => 'text/html; charset=utf-8' }, text: async () => html })

test('checkForNewBuild ricarica una sola volta per ogni nuova versione', async () => {
  let reloads = 0
  const args = { doc: fakeDoc(HTML_A), fetchImpl: async () => htmlResponse(HTML_B), storage: fakeStorage(), reload: () => { reloads += 1 } }
  assert.equal(await checkForNewBuild(args), true)
  assert.equal(await checkForNewBuild(args), false) // stessa versione nuova: niente ciclo di ricarichi
  assert.equal(reloads, 1)
})

test('checkForNewBuild non ricarica con versione uguale, errore di rete o mentre si scrive', async () => {
  let reloads = 0
  const reload = () => { reloads += 1 }
  assert.equal(await checkForNewBuild({ doc: fakeDoc(HTML_A), fetchImpl: async () => htmlResponse(HTML_A), storage: fakeStorage(), reload }), false)
  assert.equal(await checkForNewBuild({ doc: fakeDoc(HTML_A), fetchImpl: async () => { throw new Error('offline') }, storage: fakeStorage(), reload }), false)
  assert.equal(await checkForNewBuild({ doc: fakeDoc(HTML_A), fetchImpl: async () => ({ ok: false, headers: { get: () => '' } }), storage: fakeStorage(), reload }), false)
  const typing = { tagName: 'TEXTAREA', value: 'nota a metà' }
  assert.equal(await checkForNewBuild({ doc: fakeDoc(HTML_A, typing), fetchImpl: async () => htmlResponse(HTML_B), storage: fakeStorage(), reload }), false)
  assert.equal(reloads, 0)
})

test('isFutureJwtError riconosce solo l\'errore di orario', () => {
  assert.equal(isFutureJwtError({ message: 'JWT issued at future' }), true)
  assert.equal(isFutureJwtError({ message: 'x', details: 'JWT issued at future (iat)' }), true)
  assert.equal(isFutureJwtError(new Error('JWT expired')), false)
  assert.equal(isFutureJwtError(null), false)
})

test('readWithJwtRecovery: rinnova la sessione e rilegge una volta sola', async () => {
  let reads = 0; let refreshes = 0
  const read = async () => { reads += 1; if (reads === 1) throw { message: 'JWT issued at future' }; return 'ok' } // eslint-disable-line no-throw-literal
  assert.equal(await readWithJwtRecovery(read, async () => { refreshes += 1; return true }), 'ok')
  assert.deepEqual([reads, refreshes], [2, 1])
})

test('readWithJwtRecovery: senza sessione da rinnovare dà un messaggio chiaro; gli altri errori passano intatti', async () => {
  const future = async () => { throw { message: 'JWT issued at future' } } // eslint-disable-line no-throw-literal
  await assert.rejects(readWithJwtRecovery(future, async () => false), { message: JWT_CLOCK_USER_MESSAGE })
  await assert.rejects(readWithJwtRecovery(future, async () => { throw new Error('rete') }), { message: JWT_CLOCK_USER_MESSAGE })
  let refreshes = 0
  await assert.rejects(readWithJwtRecovery(async () => { throw new Error('boom') }, async () => { refreshes += 1; return true }), { message: 'boom' })
  assert.equal(refreshes, 0)
  // il secondo errore dopo il rinnovo non rientra in un ciclo
  let reads = 0
  await assert.rejects(readWithJwtRecovery(async () => { reads += 1; throw { message: 'JWT issued at future' } }, async () => true)) // eslint-disable-line no-throw-literal
  assert.equal(reads, 2)
})

test('sw.js: cache solo dello stesso sito, push mantenute, nessun dato Supabase', () => {
  assert.match(sw, /const VERSION = '/)
  assert.match(sw, /const BUILD = '__BUILD__'/) // sostituiti dal build (vite.config.js)
  assert.match(sw, /const PRECACHE = '__PRECACHE__'/)
  assert.match(sw, /url\.origin !== self\.location\.origin/) // l'API Supabase è un altro dominio: mai intercettata
  assert.match(sw, /request\.method !== 'GET'/)
  assert.match(sw, /addEventListener\('push'/)
  assert.match(sw, /addEventListener\('notificationclick'/)
  assert.match(sw, /request\.mode === 'navigate'/)
  assert.doesNotMatch(sw, /supabase\.co/i)
})
