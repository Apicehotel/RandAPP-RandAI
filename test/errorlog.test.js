import test from 'node:test'
import assert from 'node:assert/strict'

// localStorage finto, prima di caricare il modulo
const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
}
const { clean, logError, readLog, clearLog, formatLog, setSink, resetForTests } = await import('../src/lib/errorlog.js')

test('clean toglie token, PIN e chiavi dai testi', () => {
  const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijk'
  assert.ok(!clean(`Authorization: Bearer ${jwt}`).includes('eyJ'))
  assert.ok(!clean(`token ${jwt}`).includes('eyJ'))
  assert.ok(!clean('{"pin":"1234","x":1}').includes('1234'))
  assert.ok(!clean('GET /rest/v1/x?apikey=SEGRETO&a=1').includes('SEGRETO'))
  assert.ok(!clean('password=abc123').includes('abc123'))
})

test('clean accorcia i testi lunghi', () => {
  assert.ok(clean('x'.repeat(900), 100).length <= 101)
})

test('logError salva, mette il più recente per primo e non ripete lo stesso errore subito', () => {
  clearLog(); resetForTests()
  logError('rete', 'GET /a → 500', 'dettaglio')
  logError('rete', 'GET /a → 500', 'dettaglio')
  logError('script', new Error('rotto'))
  const rows = readLog()
  assert.equal(rows.length, 2)
  assert.equal(rows[0].kind, 'script')
  assert.match(formatLog(rows), /\[rete\].*GET \/a → 500/)
})

test('il registro tiene al massimo 50 errori', () => {
  clearLog(); resetForTests()
  for (let i = 0; i < 70; i += 1) logError('x', `errore ${i}`)
  assert.equal(readLog().length, 50)
  assert.equal(readLog()[0].message, 'errore 69')
})

test('invia al server e un errore del server non rompe nulla', async () => {
  clearLog(); resetForTests()
  const sent = []
  setSink((row) => { sent.push(row); throw new Error('server giù') })
  logError('accesso', 'directory → 500')
  assert.equal(sent.length, 1)
  assert.equal(sent[0].kind, 'accesso')
  assert.equal(readLog().length, 1)
})

const { classify } = await import('../src/lib/errorlog.js')
const c = (o) => classify({ online: true, ...o })

test('classify: di chi è la causa', () => {
  assert.equal(classify({ kind: 'rete', message: 'GET /x: Failed to fetch', online: false }).cause, 'dispositivo')
  assert.equal(c({ kind: 'accesso', message: 'login → 401: Utente o PIN non validi', status: 401 }).cause, 'utente')
  assert.equal(c({ kind: 'accesso', message: 'login → 429: Troppi tentativi. Riprova più tardi.', status: 429 }).cause, 'utente')
  assert.equal(c({ kind: 'rete', message: 'POST /rest/v1/issues → 403', detail: '{"code":"42501","message":"permission denied"}', status: 403 }).cause, 'utente')
  assert.equal(c({ kind: 'rete', message: 'GET /rest/v1/issues → 401', detail: '{"message":"JWT expired"}', status: 401 }).cause, 'utente')
  assert.equal(c({ kind: 'rete', message: 'POST /rest/v1/issues → 409', detail: '{"code":"23505"}', status: 409 }).cause, 'utente')
  assert.equal(c({ kind: 'rete', message: 'GET /rest/v1/x → 500', status: 500 }).cause, 'app')
  assert.equal(c({ kind: 'rete', message: 'GET /rest/v1/x → 400', detail: '{"code":"42703","message":"column x does not exist"}', status: 400 }).cause, 'app')
  assert.equal(c({ kind: 'accesso', message: 'directory → 404', status: 404 }).cause, 'app')
  assert.equal(c({ kind: 'config', message: 'Mancano le variabili: VITE_SUPABASE_URL' }).cause, 'app')
  assert.equal(c({ kind: 'script', message: 'x is not a function' }).cause, 'app')
  assert.equal(c({ kind: 'promessa', message: 'Failed to fetch dynamically imported module: /assets/a.js' }).cause, 'dispositivo')
  assert.equal(c({ kind: 'script', message: 'QuotaExceededError: setItem' }).cause, 'dispositivo')
})

test('classify: rete che cade con il dispositivo online è "probabile" dispositivo; ogni verdetto ha un consiglio', () => {
  const v = c({ kind: 'rete', message: 'GET /rest/v1/issues: Failed to fetch' })
  assert.equal(v.cause, 'dispositivo')
  assert.equal(v.probable, true)
  for (const o of [{ kind: 'x', message: 'boh' }, { kind: 'rete', message: 'a → 500', status: 500 }, { kind: 'accesso', message: 'login → 401: Utente o PIN non validi', status: 401 }]) {
    assert.ok(c(o).hint.length > 10)
  }
})
