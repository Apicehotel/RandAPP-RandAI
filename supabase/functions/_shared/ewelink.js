// Lettore eWeLink (API cloud v2): login, elenco dispositivi, conversione in letture per la tabella `sensors`.
// JavaScript puro con fetch e WebCrypto: gira in Deno (Edge Function) e in Node (test).
// ATTENZIONE: scritto dalla documentazione dell'API v2 senza poterla provare dal vivo.
// Prima di fidarsi, lancia la funzione in modalità prova (?dry=1) e controlla l'elenco.

export const regionHost = (region) => `https://${region}-apia.coolkit.cc`

const bytesToBase64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)))

// Firma del login: HMAC-SHA256 del corpo JSON con l'app secret, in base64.
export async function signBody(body, appSecret) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(appSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return bytesToBase64(await crypto.subtle.sign('HMAC', key, enc.encode(body)))
}

// Login con email e password. Se l'account è in un'altra regione l'API lo dice e si riprova una volta.
export async function login(cfg, fetchImpl = fetch) {
  let region = cfg.region || 'eu'
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const body = JSON.stringify({ email: cfg.email, password: cfg.password, countryCode: cfg.countryCode || '+39' })
    const res = await fetchImpl(`${regionHost(region)}/v2/user/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CK-Appid': cfg.appId,
        Authorization: `Sign ${await signBody(body, cfg.appSecret)}`,
      },
      body,
    })
    const json = await res.json().catch(() => ({}))
    if (json.error === 10004 && json.data?.region && json.data.region !== region) {
      region = json.data.region
      continue
    }
    if (json.error !== 0 || !json.data?.at) throw new Error(`Login eWeLink non riuscito (codice ${json.error ?? res.status})`)
    return { token: json.data.at, region: json.data.region || region }
  }
  throw new Error('Login eWeLink non riuscito (regione)')
}

// Elenco di tutti i dispositivi dell'account.
export async function listThings(session, appId, fetchImpl = fetch) {
  const res = await fetchImpl(`${regionHost(session.region)}/v2/device/thing`, {
    headers: { Authorization: `Bearer ${session.token}`, 'X-CK-Appid': appId },
  })
  if (res.status === 401) {
    const err = new Error('Sessione eWeLink scaduta')
    err.code = 'expired'
    throw err
  }
  const json = await res.json().catch(() => ({}))
  if (json.error === 401 || json.error === 406) {
    const err = new Error('Sessione eWeLink scaduta')
    err.code = 'expired'
    throw err
  }
  if (json.error !== 0) throw new Error(`Elenco dispositivi eWeLink non riuscito (codice ${json.error ?? res.status})`)
  return json.data?.thingList || []
}

const num = (v) => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

// Relay: un solo canale -> on/off; più canali -> on/off se uguali, "mixed" se diversi.
export function switchState(params = {}) {
  const channels = Array.isArray(params.switches) ? params.switches.map((s) => s?.switch).filter(Boolean) : []
  const all = channels.length ? channels : params.switch ? [params.switch] : []
  if (!all.length) return null
  if (all.every((s) => s === 'on')) return 'on'
  if (all.every((s) => s === 'off')) return 'off'
  return 'mixed'
}

// Un elemento dell'elenco -> lettura nel formato della tabella `sensors` (device_key = id del dispositivo).
export function toReading(thing, now = new Date()) {
  const d = thing?.itemData
  if (!d?.deviceid) return null
  const p = d.params || {}
  const temperature = num(p.currentTemperature ?? p.temperature)
  const humidity = num(p.currentHumidity ?? p.humidity)
  return {
    device_key: String(d.deviceid),
    name: d.name || String(d.deviceid),
    temperature,
    humidity: humidity !== null && humidity >= 0 && humidity <= 100 ? humidity : null,
    switch_state: switchState(p),
    online: d.online === true,
    last_seen: now.toISOString(),
  }
}

export const toReadings = (things, now = new Date()) => things.map((t) => toReading(t, now)).filter(Boolean)

// Cosa scrivere in `sensors` per una lettura. Solo i campi che il dispositivo ha davvero:
// un relay non azzera una temperatura che non ha. Il tipo (temperatura/relay) resta quello scelto nell'app.
export function sensorPatch(reading) {
  const patch = { online: reading.online, last_seen: reading.last_seen }
  if (reading.temperature !== null) patch.temperature = reading.temperature
  if (reading.humidity !== null) patch.humidity = reading.humidity
  if (reading.switch_state !== null) patch.switch_state = reading.switch_state
  return patch
}
