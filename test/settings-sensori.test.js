import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { deviceAssignments, orphanSensors } from '../src/lib/sensors.js'

const dev = (k, name) => ({ device_key: k, name })
const row = (k, hotel_id, active = true) => ({ id: `${k}-${hotel_id}`, device_key: k, hotel_id, active, name: k })

test('i dispositivi non assegnati vengono prima, poi per nome', () => {
  const out = deviceAssignments([dev('a', 'Zeta'), dev('b', 'Alfa'), dev('c', 'Beta')], [row('b', 'hotelgio')])
  assert.deepEqual(out.map((x) => x.device.device_key), ['c', 'a', 'b'])
  assert.equal(out[2].hotelId, 'hotelgio')
})

test('un sensore disattivato conta come non assegnato', () => {
  const [x] = deviceAssignments([dev('a', 'A')], [row('a', 'hotelgio', false)])
  assert.equal(x.hotelId, null)
  assert.equal(x.rows.length, 1)
})

test('sensori attivi che eWeLink non restituisce più', () => {
  const o = orphanSensors([dev('a', 'A')], [row('a', 'hotelgio'), row('z', 'chocohotel'), row('y', 'chocohotel', false)])
  assert.deepEqual(o.map((s) => s.device_key), ['z'])
})

test('Impostazioni ha la scheda Sensori con Sincronizza e scelta hotel, senza cancellazioni', () => {
  const s = readFileSync(new URL('../src/screens/Settings.jsx', import.meta.url), 'utf8')
  assert.match(s, /Sincronizza con eWeLink/)
  assert.match(s, /Hotel di /)
  const d = readFileSync(new URL('../src/data/sensors.js', import.meta.url), 'utf8')
  assert.doesNotMatch(d, /\.delete\(/)
})
