import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { switchGroupOf, groupSwitches, switchLabel, splitTemperatureSensors } from '../src/lib/sensors.js'

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

test('Temperature: dati attuali davanti, sensori mai aggiornati in sezione consultabile', () => {
  const readings = [
    { ...device('legacy', 'off'), kind: 'temperatura', temperature: null, last_seen: null },
    { ...device('sanitaria', 'off'), kind: 'temperatura', temperature: 61.1 },
    { ...device('cella', 'off'), kind: 'temperatura', temperature: -11.6 },
  ]
  const result = splitTemperatureSensors(readings, now)
  assert.deepEqual(result.current.map(x => x.id).sort(), ['cella', 'sanitaria'])
  assert.deepEqual(result.outdated.map(x => x.id), ['legacy'])
  const screen = readFileSync(new URL('../src/screens/Sensors.jsx', import.meta.url), 'utf8')
  assert.match(screen, /Mostra dispositivi da verificare/)
  assert.match(screen, /Letture attuali:/)
  assert.match(screen, /outdated\.map\(renderTemperature\)/)
  const css = readFileSync(new URL('../src/ui/base.css', import.meta.url), 'utf8')
  assert.match(css, /max-width: 420px/)
  assert.match(css, /sensor-outdated-toggle/)
})
