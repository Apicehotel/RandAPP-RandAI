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
