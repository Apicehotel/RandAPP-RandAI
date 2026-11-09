import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { switchGroupOf, groupSwitches, switchLabel } from '../src/lib/sensors.js'

const now = new Date('2026-11-09T16:45:00Z').getTime()
const recent = new Date(now - 5 * 60_000).toISOString()
const old = new Date(now - 2 * 60 * 60_000).toISOString()
const device = (id, state, last_seen = recent, online = true) =>
  ({ id, kind: 'relay', switch_state: state, last_seen, online, active: true, name: id })

test('Sonoff MINI R2 / R4: relay acceso, spento, non raggiungibile', () => {
  assert.equal(switchGroupOf(device('mini-r2', 'on'), now), 'on')
  assert.equal(switchGroupOf(device('mini-r4', 'off'), now), 'off')
  assert.equal(switchGroupOf(device('mini-r4', 'on', old), now), 'unreachable')
  assert.equal(switchGroupOf(device('mini-r2', 'on', recent, false), now), 'unreachable')
  assert.equal(switchLabel('on'), 'Acceso')
  assert.equal(switchLabel('off'), 'Spento')
})

test('Vista Sonoff raggruppa tutti gli interruttori senza mostrarli come comandi', () => {
  const grouped = groupSwitches([device('mini-r2', 'on'), device('mini-r4', 'off')], now)
  assert.deepEqual(grouped.map(x => [x.id, x.items.length]), [['on', 1], ['off', 1]])
  const screen = readFileSync(new URL('../src/screens/Sensors.jsx', import.meta.url), 'utf8')
  assert.match(screen, /Stato rilevato da eWeLink \(sola lettura\)/)
  assert.match(screen, /Ultima lettura/)
  assert.match(screen, /Non aggiornato/)
  assert.match(screen, /Nessuna lettura disponibile per questa struttura/)
  assert.match(screen, /Aggiornati .* dispositivi su/)
  assert.doesNotMatch(screen, /sendSwitchCommand|toggleRelay|switchDevice\(/)
})
