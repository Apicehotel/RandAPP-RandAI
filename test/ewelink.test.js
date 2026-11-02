import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { login, listThings, sensorPatch, signBody, switchState, toReading, toReadings } from '../supabase/functions/_shared/ewelink.js'

const NOW = new Date('2026-11-02T20:00:00Z')
const thing = (params, extra = {}) => ({ itemType: 1, itemData: { deviceid: '1000abc', name: 'Cella', online: true, params, ...extra } })

test('firma del login = HMAC-SHA256 base64 del corpo', async () => {
  const body = '{"email":"a@b.it","password":"x","countryCode":"+39"}'
  assert.equal(await signBody(body, 'segreto'), createHmac('sha256', 'segreto').update(body).digest('base64'))
})

test('relay: un canale, più canali, misto, nessuno', () => {
  assert.equal(switchState({ switch: 'on' }), 'on')
  assert.equal(switchState({ switch: 'off' }), 'off')
  assert.equal(switchState({ switches: [{ switch: 'on' }, { switch: 'on' }] }), 'on')
  assert.equal(switchState({ switches: [{ switch: 'on' }, { switch: 'off' }] }), 'mixed')
  assert.equal(switchState({}), null)
})

test('sensore temperatura: numeri anche se arrivano come testo', () => {
  const r = toReading(thing({ currentTemperature: '4.5', currentHumidity: '61', switch: 'on' }), NOW)
  assert.equal(r.device_key, '1000abc')
  assert.equal(r.temperature, 4.5)
  assert.equal(r.humidity, 61)
  assert.equal(r.online, true)
  assert.equal(r.last_seen, NOW.toISOString())
})

test('valori assenti o non validi diventano null, umidità fuori scala scartata', () => {
  const r = toReading(thing({ currentTemperature: 'abc', currentHumidity: '250' }), NOW)
  assert.equal(r.temperature, null)
  assert.equal(r.humidity, null)
  assert.equal(r.switch_state, null)
  assert.equal(toReading({ itemData: {} }, NOW), null)
  assert.equal(toReading(null, NOW), null)
  assert.equal(toReading(thing({}, { online: undefined }), NOW).online, false)
})

test('toReadings salta gli elementi senza id', () => {
  assert.equal(toReadings([thing({}), { itemData: {} }], NOW).length, 1)
})

test('sensorPatch scrive solo quello che il dispositivo ha (un relay non azzera la temperatura)', () => {
  const relay = sensorPatch(toReading(thing({ switch: 'off' }), NOW))
  assert.deepEqual(relay, { online: true, last_seen: NOW.toISOString(), switch_state: 'off' })
  const temp = sensorPatch(toReading(thing({ currentTemperature: 3, currentHumidity: 50 }), NOW))
  assert.deepEqual(Object.keys(temp).sort(), ['humidity', 'last_seen', 'online', 'temperature'])
})

const reply = (obj, status = 200) => ({ status, json: async () => obj })

test('login: firma, intestazioni e cambio regione indicato dall\'API', async () => {
  const calls = []
  const fetchImpl = async (url, opts) => {
    calls.push({ url, opts })
    return calls.length === 1 ? reply({ error: 10004, data: { region: 'as' } }) : reply({ error: 0, data: { at: 'TOKEN', region: 'as' } })
  }
  const s = await login({ appId: 'APP', appSecret: 'SEC', email: 'a@b.it', password: 'p', region: 'eu' }, fetchImpl)
  assert.deepEqual(s, { token: 'TOKEN', region: 'as' })
  assert.match(calls[0].url, /^https:\/\/eu-apia\.coolkit\.cc\/v2\/user\/login$/)
  assert.match(calls[1].url, /^https:\/\/as-apia\.coolkit\.cc\//)
  assert.equal(calls[0].opts.headers['X-CK-Appid'], 'APP')
  assert.match(calls[0].opts.headers.Authorization, /^Sign /)
})

test('login fallito: errore chiaro, senza password nel messaggio', async () => {
  await assert.rejects(
    () => login({ appId: 'A', appSecret: 'S', email: 'a@b.it', password: 'MiaPassword', region: 'eu' }, async () => reply({ error: 401 })),
    (e) => /codice 401/.test(e.message) && !/MiaPassword/.test(e.message),
  )
})

test('elenco dispositivi: sessione scaduta riconoscibile, altrimenti la lista', async () => {
  await assert.rejects(() => listThings({ token: 't', region: 'eu' }, 'A', async () => reply({}, 401)), (e) => e.code === 'expired')
  await assert.rejects(() => listThings({ token: 't', region: 'eu' }, 'A', async () => reply({ error: 401 })), (e) => e.code === 'expired')
  const list = await listThings({ token: 't', region: 'eu' }, 'A', async () => reply({ error: 0, data: { thingList: [thing({})] } }))
  assert.equal(list.length, 1)
})

test('la funzione sync protegge la chiamata e non scrive in modalità prova', () => {
  const src = readFileSync(new URL('../supabase/functions/ewelink-sync/index.ts', import.meta.url), 'utf8')
  assert.match(src, /x-sync-secret/)
  assert.match(src, /sameSecret\(/)
  assert.match(src, /if \(!dry\)/)
  assert.doesNotMatch(src, /console\.(log|error)\([^)]*(password|secret|token)/i)
})
