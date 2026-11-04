// Login con PIN, tutto lato server. Il browser non vede mai hash né confronta il PIN.
// Azioni: "directory" (cerca nome, solo se almeno 2 lettere) e "login" (id utente + PIN).
// Nome pubblicato: "randapp-pin-auth" (nel progetto condiviso "pin-auth" è della vecchia app: NON va toccato).
// Le tabelle stanno nello schema `randapp`. Postgres diretto (SUPABASE_DB_URL): la chiave service_role via PostgREST
// risponde 401 alle Edge Function dal 1 ottobre 2026. Solo la sessione passa dall'Auth admin API.
// Variabili fornite da Supabase: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL.
import { createClient } from "npm:@supabase/supabase-js@2";
import postgres from "npm:postgres@3.4.7";
import bcrypt from "npm:bcryptjs@2.4.3";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(URL_, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 2, connect_timeout: 5, idle_timeout: 10 });
const anon = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const MAX_FAILED = 5;
const LOCK_MS = 10 * 60 * 1000;
const MIN_QUERY = 2;
const MAX_RESULTS = 12;
const BAD_LOGIN = "Utente o PIN non validi";

// Limite semplice per IP sulla ricerca nomi (per istanza della funzione).
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;
const rate = new Map<string, { count: number; resetAt: number }>();
function allowDirectory(req: Request, hotelId: string) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  const key = `${ip}:${hotelId}`;
  const now = Date.now();
  const row = rate.get(key);
  if (!row || now >= row.resetAt) {
    rate.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (row.count >= RATE_LIMIT) return false;
  row.count += 1;
  return true;
}

async function hotelExists(hotelId: string) {
  const rows = await sql`select 1 from randapp.hotels where id = ${hotelId} and active limit 1`;
  return rows.length > 0;
}

async function directory(req: Request, hotelId: string, rawQuery: string) {
  const q = rawQuery.trim().replace(/[%_\\]/g, "");
  if (q.length < MIN_QUERY) return json({ ok: true, users: [], query_required: true, min_query: MIN_QUERY });
  if (!allowDirectory(req, hotelId)) return json({ ok: false, error: "Troppe richieste. Riprova tra un minuto." }, 429);

  const rows = await sql`
    select m.auth_user_id, p.display_name
    from randapp.hotel_memberships m
    join randapp.profiles p on p.auth_user_id = m.auth_user_id
    where m.hotel_id = ${hotelId} and m.active and p.active
      and p.display_name ilike ${q + "%"}
    order by p.display_name limit ${MAX_RESULTS}`;
  const users = rows.map((row) => ({ id: String(row.auth_user_id), name: String(row.display_name || "") }));
  return json({ ok: true, users });
}

async function login(hotelId: string, userId: string, pin: string) {
  // Controlli di base: l'utente deve essere attivo e membro attivo della struttura.
  const [[profile], [membership], [credential]] = await Promise.all([
    sql`select active from randapp.profiles where auth_user_id = ${userId}`,
    sql`select active from randapp.hotel_memberships where auth_user_id = ${userId} and hotel_id = ${hotelId}`,
    sql`select pin_hash, failed_attempts, locked_until from randapp.auth_pin_credentials where auth_user_id = ${userId}`,
  ]);

  if (!profile || !membership || !credential) return json({ ok: false, error: BAD_LOGIN }, 401);
  if (!profile.active) return json({ ok: false, error: "Utente disattivato" }, 403);
  if (!membership.active) return json({ ok: false, error: "Accesso alla struttura non consentito" }, 403);

  if (credential.locked_until && new Date(credential.locked_until).getTime() > Date.now()) {
    return json({ ok: false, error: "Troppi tentativi. Riprova più tardi." }, 429);
  }

  const valid = await bcrypt.compare(pin, String(credential.pin_hash));
  if (!valid) {
    const failures = Number(credential.failed_attempts || 0) + 1;
    if (failures >= MAX_FAILED) {
      await sql`update randapp.auth_pin_credentials set failed_attempts = 0, locked_until = ${new Date(Date.now() + LOCK_MS)}, updated_at = now() where auth_user_id = ${userId}`;
    } else {
      await sql`update randapp.auth_pin_credentials set failed_attempts = ${failures}, updated_at = now() where auth_user_id = ${userId}`;
    }
    return json({ ok: false, error: BAD_LOGIN }, 401);
  }

  await sql`update randapp.auth_pin_credentials set failed_attempts = 0, locked_until = null where auth_user_id = ${userId}`;

  // Sessione: password casuale usa-e-getta, mai nota a nessuno, ruotata a ogni login.
  const { data: authUser, error: userError } = await admin.auth.admin.getUserById(userId);
  const email = authUser?.user?.email;
  if (userError || !email) throw new Error("Identità non disponibile");

  const password = crypto.randomUUID() + crypto.randomUUID();
  const { error: updateError } = await admin.auth.admin.updateUserById(userId, { password });
  if (updateError) throw new Error("Sessione non disponibile");

  const { data: signed, error: signError } = await anon.auth.signInWithPassword({ email, password });
  if (signError || !signed?.session) throw new Error("Sessione non disponibile");

  const s = signed.session;
  return json({
    ok: true,
    session: { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at ?? null },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "Metodo non consentito" }, 405);

  try {
    const body = await req.json().catch(() => null);
    const action = String(body?.action || "login");
    const hotelId = String(body?.hotel_id || "").trim();
    if (!hotelId || !(await hotelExists(hotelId))) return json({ ok: false, error: "Struttura non valida" }, 400);

    if (action === "directory") return await directory(req, hotelId, String(body?.q || ""));

    const userId = String(body?.user_id || "").trim();
    const pin = String(body?.pin || "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(userId) || !/^\d{4}$/.test(pin)) {
      return json({ ok: false, error: "Dati login non validi" }, 400);
    }
    return await login(hotelId, userId, pin);
  } catch (error) {
    console.error("pin-auth", error instanceof Error ? error.message : "errore");
    return json({ ok: false, error: "Errore temporaneo di accesso" }, 500);
  }
});
