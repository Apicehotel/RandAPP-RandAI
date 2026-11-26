import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { autoFocusOnDesktop } from '../src/lib/autofocus.js'
import { formatTemp } from '../src/lib/sensors.js'

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('autoFocus solo su desktop: senza finestra (o senza mouse) resta spento', () => {
  assert.equal(autoFocusOnDesktop, false)
})

test('le temperature usano Intl con lo stesso aspetto di prima', () => {
  assert.equal(formatTemp(4.56), '4,6°C')
  assert.equal(formatTemp(-18), '-18,0°C')
})

test('nessun autoFocus fisso nei moduli e nessun window.confirm', () => {
  for (const f of ['IssueNew', 'InterventionNew', 'WarehouseNew', 'SensorNew', 'TaskUrgentNew', 'TaskReminderNew', 'PlanningWorkNew', 'PlanningSaleNew']) {
    assert.doesNotMatch(src(`src/screens/${f}.jsx`), /\bautoFocus\b(?!=\{autoFocusOnDesktop\})/, f)
  }
  assert.doesNotMatch(src('src/screens/Housekeeping.jsx'), /window\.confirm/)
})

test('link «Vai al contenuto» presente e il login non spegne il gestore password', () => {
  assert.match(src('src/ui/Shell.jsx'), /className="skip-link"/)
  assert.doesNotMatch(src('src/screens/Login.jsx'), /<form[^>]*autoComplete="off"/)
})

test('il colore della barra del browser segue il tema', () => {
  assert.match(src('src/lib/ui-prefs.js'), /syncThemeColor/)
})

test('un solo ascoltatore visibilitychange: l\'app usa onBecameVisible', () => {
  for (const f of ['src/app/App.jsx', 'src/ui/RoomReadyAlert.jsx', 'src/ui/OutboxBanner.jsx', 'src/ui/UrgentAlert.jsx']) {
    assert.match(src(f), /onBecameVisible/, f)
    assert.doesNotMatch(src(f), /addEventListener\('visibilitychange'/, f)
  }
  assert.equal((src('src/lib/visibility.js').match(/addEventListener\('visibilitychange'/g) || []).length, 1)
})

test('onBecameVisible chiama le iscrizioni solo con la scheda visibile e si può annullare', async () => {
  const listeners = {}
  globalThis.document = {
    visibilityState: 'hidden',
    addEventListener: (t, f) => { listeners[t] = f },
    removeEventListener: (t) => { delete listeners[t] },
  }
  const { onBecameVisible } = await import('../src/lib/visibility.js')
  let n = 0
  const stop = onBecameVisible(() => { n += 1 })
  const stop2 = onBecameVisible(() => { throw new Error('non deve fermare le altre') })
  listeners.visibilitychange()
  assert.equal(n, 0)
  document.visibilityState = 'visible'
  listeners.visibilitychange()
  assert.equal(n, 1)
  stop(); stop2()
  assert.equal(listeners.visibilitychange, undefined)
  delete globalThis.document
})

test('campi di Nuova segnalazione con name', () => {
  assert.match(src('src/ui/forms.jsx'), /<input id=\{id\} name=\{id\}/)
  assert.match(src('src/screens/IssueNew.jsx'), /<textarea id="description" name="description"/)
})

test('ewelink-sync risponde alla richiesta OPTIONS del browser con le intestazioni CORS', () => {
  const fn = src('supabase/functions/ewelink-sync/index.ts')
  assert.match(fn, /req\.method === "OPTIONS"/)
  assert.match(fn, /Access-Control-Allow-Origin/)
  assert.match(fn, /Access-Control-Allow-Headers[^\n]*authorization[^\n]*x-sync-secret/)
  assert.match(fn, /headers: \{ \.\.\.cors,/)
})
