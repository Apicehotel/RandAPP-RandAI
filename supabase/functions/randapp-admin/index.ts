// Azioni admin che richiedono l'Auth admin API: creare un utente e cambiare un PIN.
// Chi chiama deve avere una sessione valida E il permesso admin.access nella struttura (controllato qui sul database).
// Il PIN arriva solo qui, viene trasformato in hash (bcrypt) e non viene mai scritto nei log né restituito.
// Nome pubblicato: "randapp-admin". Variabili fornite da Supabase: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL.
import { createClient } from "npm:@supabase/supabase-js@2";
import postgres from "npm:postgres@3.4.7";
import bcrypt from "npm:bcryptjs@2.4.3";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 2, connect_timeout: 5, idle_timeout: 10 });

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

const ROLES = ["admin", "direzione", "responsabile", "manutentore", "governante", "reception", "capo_governante", "portiere_notturno", "direttore_congressi", "tecnico_esterno", "supremo", "randai"];

async function caller(req: Request, hotelId: string) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  const id = data?.user?.id;
  if (error || !id) return null;
  const rows = await sql`
    select 1 from randapp.hotel_memberships m
      join randapp.role_permissions rp on rp.role = m.role
     where m.auth_user_id = ${id} and m.hotel_id = ${hotelId} and m.active and rp.permission = 'admin.access' limit 1`;
  return rows.length ? id : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "Metodo non consentito" }, 405);
  try {
    const body = await req.json().catch(() => null);
    const action = String(body?.action || "");
    const hotelId = String(body?.hotel_id || "").trim();
    if (!hotelId) return json({ ok: false, error: "Struttura non valida" }, 400);
    if (!(await caller(req, hotelId))) return json({ ok: false, error: "Non autorizzato" }, 403);

    const pin = String(body?.pin || "").trim();
    if (!/^\d{4}$/.test(pin)) return json({ ok: false, error: "Il PIN deve avere 4 cifre" }, 400);

    if (action === "reset_pin") {
      const userId = String(body?.user_id || "");
      if (!/^[0-9a-f-]{36}$/i.test(userId)) return json({ ok: false, error: "Utente non valido" }, 400);
      const member = await sql`select 1 from randapp.hotel_memberships where hotel_id = ${hotelId} and auth_user_id = ${userId}`;
      if (!member.length) return json({ ok: false, error: "Persona non trovata in questa struttura" }, 404);
      const hash = await bcrypt.hash(pin, 10);
      await sql`
        insert into randapp.auth_pin_credentials (auth_user_id, pin_hash, failed_attempts, locked_until, must_change_pin, updated_at)
        values (${userId}, ${hash}, 0, null, false, now())
        on conflict (auth_user_id) do update
          set pin_hash = excluded.pin_hash, failed_attempts = 0, locked_until = null, must_change_pin = false, updated_at = now()`;
      return json({ ok: true });
    }

    if (action === "create_user") {
      const name = String(body?.name || "").trim();
      const role = String(body?.role || "");
      if (name.length < 2 || name.length > 60) return json({ ok: false, error: "Nome non valido (2-60 caratteri)" }, 400);
      if (!ROLES.includes(role)) return json({ ok: false, error: "Ruolo non valido" }, 400);
      const same = await sql`
        select 1 from randapp.hotel_memberships m join randapp.profiles p on p.auth_user_id = m.auth_user_id
         where m.hotel_id = ${hotelId} and lower(p.display_name) = lower(${name}) limit 1`;
      if (same.length) return json({ ok: false, error: "C'è già una persona con questo nome" }, 409);

      const { data, error } = await admin.auth.admin.createUser({
        email: `${crypto.randomUUID()}@randapp.invalid`,
        password: crypto.randomUUID() + crypto.randomUUID(),
        email_confirm: true,
      });
      const id = data?.user?.id;
      if (error || !id) throw new Error("Creazione identità non riuscita");
      try {
        const hash = await bcrypt.hash(pin, 10);
        await sql.begin(async (tx) => {
          await tx`insert into randapp.profiles (auth_user_id, display_name) values (${id}, ${name})`;
          await tx`insert into randapp.hotel_memberships (auth_user_id, hotel_id, role) values (${id}, ${hotelId}, ${role})`;
          await tx`insert into randapp.auth_pin_credentials (auth_user_id, pin_hash) values (${id}, ${hash})`;
        });
      } catch (e) {
        await admin.auth.admin.deleteUser(id);
        throw e;
      }
      return json({ ok: true, user_id: id });
    }

    return json({ ok: false, error: "Azione non valida" }, 400);
  } catch (error) {
    console.error("randapp-admin", error instanceof Error ? error.message : "errore");
    return json({ ok: false, error: "Errore temporaneo" }, 500);
  }
});
