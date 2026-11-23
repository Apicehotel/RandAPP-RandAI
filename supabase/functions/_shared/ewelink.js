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
// L'API v2 restituisce al massimo `num` (default 30) per richiesta: senza paginazione
// i dispositivi oltre la prima pagina non arrivano (sintomo tipico: ~30 su ~45).
const THING_PAGE = 30
const THING_MAX_PAGES = 20 // tetto di sicurezza (600 dispositivi)

export async function listThings(session, appId, fetchImpl = fetch) {
  const headers = { Authorization: `Bearer ${session.token}`, 'X-CK-Appid': appId }
  const base = `${regionHost(session.region)}/v2/device/thing`
  const all = []
  let beginIndex = -9999999
  let total = null

  for (let page = 0; page < THING_MAX_PAGES; page += 1) {
    const url = `${base}?lang=en&num=${THING_PAGE}&beginIndex=${beginIndex}`
    const res = await fetchImpl(url, { headers })
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

    const batch = Array.isArray(json.data?.thingList) ? json.data.thingList : []
    if (typeof json.data?.total === 'number') total = json.data.total
    all.push(...batch)

    // Fine: pagina vuota, meno di una pagina piena, oppure raggiunto il totale dichiarato.
    if (batch.length === 0 || batch.length < THING_PAGE || (total !== null && all.length >= total)) break

    const lastIndex = batch[batch.length - 1]?.index
    if (typeof lastIndex !== 'number') break
    beginIndex = lastIndex
  }

  return all
}

// Recupero per id (come HotelGio): POST /v2/device/thing con fino a 10 id per richiesta.
// Serve quando l'elenco paginato non restituisce un dispositivo già in app (brand/autorizzazione,
// famiglia diversa, oppure ancora oltre le pagine). itemType 1 = proprio, 2 = condiviso.
const THING_BY_ID_BATCH = 10

export async function listThingsByIds(session, appId, ids, fetchImpl = fetch) {
  const unique = [...new Set((ids || []).map((id) => String(id || '').trim()).filter(Boolean))]
  if (!unique.length) return []

  const headers = {
    Authorization: `Bearer ${session.token}`,
    'X-CK-Appid': appId,
    'Content-Type': 'application/json',
  }
  const url = `${regionHost(session.region)}/v2/device/thing`
  const found = []
  const seen = new Set()

  const pull = async (batch, itemType) => {
    const body = JSON.stringify({
      thingList: batch.map((id) => ({ itemType, id })),
    })
    const res = await fetchImpl(url, { method: 'POST', headers, body })
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
    if (json.error !== 0) throw new Error(`Recupero dispositivi eWeLink non riuscito (codice ${json.error ?? res.status})`)
    for (const t of json.data?.thingList || []) {
      const id = t?.itemData?.deviceid
      if (!id || seen.has(String(id))) continue
      seen.add(String(id))
      found.push(t)
    }
  }

  for (let i = 0; i < unique.length; i += THING_BY_ID_BATCH) {
    const batch = unique.slice(i, i + THING_BY_ID_BATCH)
    await pull(batch, 1)
  }
  // Quelli ancora assenti: riprova come dispositivi condivisi (itemType 2).
  const still = unique.filter((id) => !seen.has(id))
  for (let i = 0; i < still.length; i += THING_BY_ID_BATCH) {
    await pull(still.slice(i, i + THING_BY_ID_BATCH), 2)
  }

  return found
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
