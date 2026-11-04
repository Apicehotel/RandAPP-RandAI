// Legge i dispositivi eWeLink e aggiorna la tabella `sensors` di UNA struttura.
// Stesso schema della vecchia app (sync-sensori-temperatura): sola lettura, Postgres diretto.
// Si chiama a intervalli (vedi README, pg_cron) con l'intestazione x-sync-secret,
// oppure dal tasto "Aggiorna" dell'app con la sessione dell'utente (permesso sensors.view).
//   ?dry=1  -> mostra cosa leggerebbe, senza scrivere nulla (per provare)
//
// Credenziali: prima i segreti della funzione, poi (come la vecchia app) la tabella
// `edge_function_secrets` dello stesso progetto, chiavi ewelink_app_id, ewelink_app_secret,
// ewelink_email, ewelink_password, sensor_sync_secret. Mai nel repo né in chat.
//   Segreti opzionali: EWELINK_REGION (eu), EWELINK_COUNTRY_CODE (+39), EWELINK_HOTEL_ID (es. hotelgio)
// SUPABASE_DB_URL lo fornisce Supabase. NON si usa la chiave service_role via PostgREST:
// dal 1 ottobre 2026 risponde 401 alle Edge Function (lo stesso problema della vecchia app).
import postgres from "npm:postgres@3.4.7";
import { listThings, login, toReadings } from "../_shared/ewelink.js";

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 2, connect_timeout: 5, idle_timeout: 10 });

async function secret(envName: string, tableKey: string): Promise<string> {
  const fromEnv = Deno.env.get(envName);
  if (fromEnv) return fromEnv;
  try {
    const rows = await sql`select value from public.edge_function_secrets where key = ${tableKey} limit 1`;
    if (rows[0]?.value) return String(rows[0].value);
  } catch {
    /* tabella assente: si passa all'errore sotto */
  }
  throw new Error(`Segreto mancante: ${envName}`);
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

// Confronto a tempo costante del segreto di chiamata.
function sameSecret(a: string, b: string) {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

// La sessione eWeLink dura a lungo: la teniamo finché l'istanza resta calda.
let session: { token: string; region: string } | null = null;

async function readThings(cfg: Record<string, string>) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (!session) session = await login(cfg);
    try {
      return await listThings(session, cfg.appId);
    } catch (e) {
      if ((e as { code?: string }).code === "expired") { session = null; continue; }
      throw e;
    }
  }
  throw new Error("Sessione eWeLink non valida");
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return json({ ok: false, error: "Metodo non consentito" }, 405);
    const dry = new URL(req.url).searchParams.get("dry") === "1";
    let hotelId = Deno.env.get("EWELINK_HOTEL_ID") ?? "hotelgio";
    let byUser = false;

    const provided = req.headers.get("x-sync-secret");
    if (provided !== null) {
      // Chiamata programmata (pg_cron): segreto di sincronizzazione.
      const expected = await secret("SYNC_SECRET", "sensor_sync_secret");
      if (!sameSecret(provided, expected)) return json({ ok: false, error: "Non autorizzato" }, 401);
    } else {
      // Tasto "Aggiorna" dell'app: utente con sessione valida e permesso sensors.view nella struttura.
      const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
      if (!token) return json({ ok: false, error: "Non autorizzato" }, 401);
      const who = await fetch(`${Deno.env.get("SUPABASE_URL")}/auth/v1/user`, {
        headers: { Authorization: `Bearer ${token}`, apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "" },
      });
      const uid = who.ok ? (await who.json())?.id : null;
      if (!uid) return json({ ok: false, error: "Non autorizzato" }, 401);
      const body = await req.json().catch(() => ({}));
      if (typeof body.hotel_id === "string" && body.hotel_id) hotelId = body.hotel_id;
      const allowed = await sql`
        select 1 from public.hotel_memberships m
        join public.role_permissions rp on rp.role = m.role
        where m.auth_user_id = ${uid} and m.hotel_id = ${hotelId} and m.active and rp.permission = 'sensors.view' limit 1`;
      if (allowed.length === 0) return json({ ok: false, error: "Non autorizzato" }, 403);
      byUser = true;
      // Freno: se i dati sono già di meno di 60 secondi fa non si richiama eWeLink.
      const [recent] = await sql`select max(last_seen) > now() - interval '60 seconds' as fresh from public.sensors where hotel_id = ${hotelId}`;
      if (recent?.fresh) return json({ ok: true, throttled: true });
    }

    const [appId, appSecret, email, password] = await Promise.all([
      secret("EWELINK_APP_ID", "ewelink_app_id"),
      secret("EWELINK_APP_SECRET", "ewelink_app_secret"),
      secret("EWELINK_EMAIL", "ewelink_email"),
      secret("EWELINK_PASSWORD", "ewelink_password"),
    ]);
    const things = await readThings({
      appId, appSecret, email, password,
      region: Deno.env.get("EWELINK_REGION") ?? "eu",
      countryCode: Deno.env.get("EWELINK_COUNTRY_CODE") ?? "+39",
    });
    const readings = toReadings(things);

    const known = await sql`select device_key, name, last_seen from public.sensors where hotel_id = ${hotelId} and active`;
    const knownKeys = new Set(known.map((s) => s.device_key));
    const seenKeys = new Set(readings.map((r) => r.device_key));
    const matched = readings.filter((r) => knownKeys.has(r.device_key));
    // Dispositivi eWeLink senza sensore nell'app: servono per scegliere il "codice dispositivo".
    const unmatched = readings.filter((r) => !knownKeys.has(r.device_key)).map((r) => ({ device_key: r.device_key, name: r.name }));
    // Sensori dell'app che eWeLink NON restituisce più (tolti dall'account, condivisione revocata...).
    const missing = known.filter((s) => !seenKeys.has(s.device_key)).map((s) => ({ device_key: s.device_key, name: s.name, last_seen: s.last_seen }));

    let updated = 0;
    if (!dry && matched.length) {
      // Solo i campi che il dispositivo ha davvero: un relay non azzera una temperatura che non ha.
      const res = await sql`
        update public.sensors s set
          online = r.online,
          last_seen = r.last_seen,
          temperature = coalesce(r.temperature, s.temperature),
          humidity = coalesce(r.humidity, s.humidity),
          switch_state = coalesce(r.switch_state, s.switch_state)
        from jsonb_to_recordset(${sql.json(matched as any)}::jsonb)
          as r(device_key text, online boolean, last_seen timestamptz, temperature numeric, humidity numeric, switch_state text)
        where s.hotel_id = ${hotelId} and s.device_key = r.device_key
      `;
      updated = res.count;
    }
    return json({ ok: true, dry, by_user: byUser, found: readings.length, matched: matched.length, updated, unmatched, missing });
  } catch (e) {
    console.error("ewelink-sync", (e as Error).message);
    return json({ ok: false, error: "temporary_error" }, 500);
  }
});
