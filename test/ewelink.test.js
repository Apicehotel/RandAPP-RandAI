import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { login, listThings, listThingsByIds, sensorPatch, signBody, switchState, toReading, toReadings } from '../supabase/functions/_shared/ewelink.js'

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
  const list = await listThings({ token: 't', region: 'eu' }, 'A', async () => reply({ error: 0, data: { thingList: [thing({})], total: 1 } }))
  assert.equal(list.length, 1)
})

test('elenco dispositivi: paginazione oltre i 30 (beginIndex = index dell\'ultimo)', async () => {
  const page1 = Array.from({ length: 30 }, (_, i) => ({
    index: i + 1,
    itemType: 1,
    itemData: { deviceid: `d${i}`, name: `S${i}`, online: true, params: {} },
  }))
  const page2 = Array.from({ length: 15 }, (_, i) => ({
    index: 31 + i,
    itemType: 1,
    itemData: { deviceid: `d${30 + i}`, name: `S${30 + i}`, online: true, params: {} },
  }))
  const urls = []
  const fetchImpl = async (url) => {
    urls.push(url)
    const u = new URL(url)
    assert.equal(u.searchParams.get('num'), '30')
    const begin = Number(u.searchParams.get('beginIndex'))
    if (begin === -9999999) return reply({ error: 0, data: { thingList: page1, total: 45 } })
    if (begin === 30) return reply({ error: 0, data: { thingList: page2, total: 45 } })
    throw new Error(`beginIndex inatteso: ${begin}`)
  }
  const list = await listThings({ token: 't', region: 'eu' }, 'APP', fetchImpl)
  assert.equal(list.length, 45)
  assert.equal(urls.length, 2)
  assert.match(urls[0], /beginIndex=-9999999/)
  assert.match(urls[1], /beginIndex=30/)
  assert.equal(list[0].itemData.deviceid, 'd0')
  assert.equal(list[44].itemData.deviceid, 'd44')
})

test('recupero per id: POST a lotti di 10, poi itemType 2 se ancora assenti', async () => {
  const calls = []
  const fetchImpl = async (url, opts = {}) => {
    calls.push({ url, method: opts.method || 'GET', body: opts.body ? JSON.parse(opts.body) : null })
    assert.equal(opts.method, 'POST')
    const ids = (calls[calls.length - 1].body.thingList || []).map((t) => t.id)
    const type = calls[calls.length - 1].body.thingList[0].itemType
    // Prima passata (tipo 1): restituisce solo i primi 2; seconda (tipo 2): il terzo.
    if (type === 1) {
      return reply({
        error: 0,
        data: {
          thingList: ids.slice(0, 2).map((id) => ({ itemType: 1, itemData: { deviceid: id, name: id, online: true, params: {} } })),
        },
      })
    }
    return reply({
      error: 0,
      data: {
        thingList: ids.map((id) => ({ itemType: 2, itemData: { deviceid: id, name: id, online: true, params: { currentTemperature: 12 } } })),
      },
    })
  }
  const ids = Array.from({ length: 12 }, (_, i) => `id${i}`)
  const list = await listThingsByIds({ token: 't', region: 'eu' }, 'APP', ids, fetchImpl)
  // 10 + 2 tip1, poi i mancanti tip2: id2..id9 dalla prima batch tip2 + id10,id11 dalla seconda tip1 già parziale…
  // Batch1 tip1 (id0-9): torna id0,id1 → mancano id2-9
  // Batch2 tip1 (id10-11): torna id10 → manca id11 (slice 0,2 di 2 elementi = entrambi? ids.slice(0,2) of [id10,id11] = both)
  // Wait: for batch of 2, slice(0,2) returns both. So tip1 returns all from batch2.
  // still after tip1: id2..id9 (8 ids)
  // tip2 batches: id2-9 → all returned
  assert.equal(list.length, 12)
  assert.ok(calls.length >= 3)
  assert.equal(calls[0].body.thingList.length, 10)
  assert.equal(calls[0].body.thingList[0].itemType, 1)
  assert.ok(calls.some((c) => c.body.thingList[0].itemType === 2))
})

test('la funzione sync protegge la chiamata e non scrive in modalità prova', () => {
  const src = readFileSync(new URL('../supabase/functions/ewelink-sync/index.ts', import.meta.url), 'utf8')
  assert.match(src, /x-sync-secret/)
  assert.match(src, /sameSecret\(/)
  assert.match(src, /if \(!dry/)
  assert.doesNotMatch(src, /console\.(log|error)\([^)]*(password|secret|token)/i)
})

import { missingSensors, syncHealth, agoText } from '../src/lib/sensors.js'

// L'account eWeLink è condiviso e SOLO LETTURA: il codice non deve mai poter comandare un dispositivo.
test('eWeLink: solo lettura (login + elenco/recupero dispositivi, nessun comando)', () => {
  const src = ['supabase/functions/_shared/ewelink.js', 'supabase/functions/ewelink-sync/index.ts'].map((f) => readFileSync(f, 'utf8')).join('\n')
  const paths = [...src.matchAll(/\/v2\/[A-Za-z0-9/_-]+/g)].map((m) => m[0])
  assert.deepEqual([...new Set(paths)].sort(), ['/v2/device/thing', '/v2/user/login'])
  // POST: login + recupero specificato (GET elenco). Niente /status di comando né switch on/off.
  assert.ok(!/\/v2\/device\/thing\/status/.test(src))
  assert.ok(!/(control|switch)['"`]?\s*:\s*['"]on['"]/.test(src.replace(/switch_state|\.switch\b/g, '')))
  assert.match(src, /listThingsByIds/)
})

test('eWeLink: la funzione non usa la chiave service_role via API', () => {
  const fn = readFileSync('supabase/functions/ewelink-sync/index.ts', 'utf8')
  assert.ok(!/createClient\(|Deno\.env\.get\(["']SUPABASE_SERVICE_ROLE_KEY/.test(fn))
  assert.ok(/SUPABASE_DB_URL/.test(fn))
})

test('sensori mancanti e sincronizzazione ferma', () => {
  const now = new Date('2026-11-04T10:00:00Z').getTime()
  const at = (h) => new Date(now - h * 3600000).toISOString()
  const list = [
    { id: 'a', last_seen: at(0.2) }, { id: 'b', last_seen: at(30) },
    { id: 'c', last_seen: at(2000) }, { id: 'd', last_seen: null }, { id: 'e', last_seen: at(50), active: false },
  ]
  assert.deepEqual(missingSensors(list, now).map((s) => s.id), ['d', 'c', 'b'])
  assert.equal(syncHealth(list, now).stopped, false)
  assert.equal(syncHealth([{ last_seen: at(3) }], now).stopped, true)
  assert.deepEqual(syncHealth([], now), { stopped: false, minutes: null })
  assert.equal(agoText(at(5), now), '5 ore fa')
  assert.equal(agoText(at(100), now), '4 giorni fa')
})
