// Legge i dispositivi eWeLink e aggiorna la tabella `sensors` di UNA struttura.
// Si chiama a intervalli (vedi README, pg_cron) con l'intestazione x-sync-secret.
//   ?dry=1  -> mostra cosa leggerebbe, senza scrivere nulla (per provare)
// Segreti da impostare nel pannello Supabase (mai nel repo né in chat):
//   EWELINK_APP_ID, EWELINK_APP_SECRET, EWELINK_EMAIL, EWELINK_PASSWORD,
//   EWELINK_REGION (eu), EWELINK_COUNTRY_CODE (+39), EWELINK_HOTEL_ID (es. hotelgio), SYNC_SECRET
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY li fornisce Supabase.
import { createClient } from "npm:@supabase/supabase-js@2";
import { listThings, login, sensorPatch, toReadings } from "../_shared/ewelink.js";

const need = (name: string) => {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Segreto mancante: ${name}`);
  return v;
};

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

// La sessione eWeLink dura a lungo: la teniamo finché l'istanza resta calda, così non si rifà il login a ogni giro.
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
    if (!sameSecret(req.headers.get("x-sync-secret") ?? "", need("SYNC_SECRET"))) {
      return json({ ok: false, error: "Non autorizzato" }, 401);
    }
    const dry = new URL(req.url).searchParams.get("dry") === "1";
    const hotelId = need("EWELINK_HOTEL_ID");

    const things = await readThings({
      appId: need("EWELINK_APP_ID"),
      appSecret: need("EWELINK_APP_SECRET"),
      email: need("EWELINK_EMAIL"),
      password: need("EWELINK_PASSWORD"),
      region: Deno.env.get("EWELINK_REGION") ?? "eu",
      countryCode: Deno.env.get("EWELINK_COUNTRY_CODE") ?? "+39",
    });
    const readings = toReadings(things);

    const admin = createClient(need("SUPABASE_URL"), need("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: known, error } = await admin.from("sensors").select("id, device_key").eq("hotel_id", hotelId);
    if (error) throw new Error("Impossibile leggere i sensori");
    const byKey = new Map((known ?? []).map((s: { id: string; device_key: string }) => [s.device_key, s.id]));

    const matched = readings.filter((r) => byKey.has(r.device_key));
    // Dispositivi eWeLink che non hanno ancora un sensore nell'app: servono per scegliere il "codice dispositivo".
    const unmatched = readings.filter((r) => !byKey.has(r.device_key)).map((r) => ({ device_key: r.device_key, name: r.name }));

    let updated = 0;
    if (!dry) {
      for (const r of matched) {
        const { error: upError } = await admin.from("sensors").update(sensorPatch(r)).eq("id", byKey.get(r.device_key)!);
        if (!upError) updated += 1;
      }
    }
    return json({ ok: true, dry, found: readings.length, matched: matched.length, updated, unmatched,
      ...(dry ? { preview: matched.map((r) => ({ ...r })) } : {}) });
  } catch (e) {
    console.error("ewelink-sync", (e as Error).message);
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
