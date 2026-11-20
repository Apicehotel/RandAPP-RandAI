// Pagina del tecnico (link personale, senza accesso all'app). Nessun JWT: il codice nel link è la credenziale.
// Il codice è lungo e casuale; nel database c'è solo la sua impronta. Le funzioni SQL portal_* non sono
// eseguibili da anon/authenticated: si arriva ai dati solo da qui. Risposte generiche, mai dettagli interni.
import postgres from "npm:postgres@3.4.7";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 2, connect_timeout: 5, idle_timeout: 10 });
// Email alla reception per ogni appuntamento fissato o cambiato (stessi segreti Gmail del recupero PIN, mai nel repo).
const gmailUser = Deno.env.get("GMAIL_USER") || "";
const gmailPass = (Deno.env.get("GMAIL_APP_PASSWORD") || "").replace(/\s+/g, "");
const oneLine = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);

async function notifyReception(token: string) {
  if (!gmailUser || !gmailPass) return;
  const [r] = await sql`
    select h.name as hotel, i.room, i.title, i.appointment_at, t.name as tech,
           (select count(*) from randapp.technician_events e where e.issue_id = l.issue_id and e.kind = 'arrival_set') as sets,
           coalesce((select array_agg(distinct p.email) from randapp.hotel_memberships m
                      join randapp.profiles p on p.auth_user_id = m.auth_user_id
                     where m.hotel_id = l.hotel_id and m.role = 'reception' and m.active and p.active and p.email is not null), '{}') as emails
      from randapp.technician_links l
      join randapp.issues i on i.id = l.issue_id
      join randapp.hotels h on h.id = l.hotel_id
      left join randapp.external_technicians t on t.id = l.technician_id
     where l.token_hash = encode(sha256(convert_to(${token}, 'UTF8')), 'hex')`;
  const to = ((r?.emails as string[]) || []).filter((e) => /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(e));
  if (!r?.appointment_at || to.length === 0) return;
  const when = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })
    .format(new Date(r.appointment_at as string));
  const changed = Number(r.sets) > 1;
  const where = r.room ? `camera/zona ${oneLine(r.room, 60)}` : "in struttura";
  const client = new SMTPClient({ connection: { hostname: "smtp.gmail.com", port: 465, tls: true, auth: { username: gmailUser, password: gmailPass } } });
  try {
    await client.send({
      from: `RandApp <${gmailUser}>`,
      to,
      subject: `RandApp · Appuntamento ${changed ? "modificato" : "fissato"}: ${oneLine(r.hotel, 40)} ${oneLine(r.room, 30)}`.trim(),
      content: `${oneLine(r.tech, 80) || "Il tecnico"} ha ${changed ? "cambiato" : "fissato"} l'appuntamento.\n\nStruttura: ${oneLine(r.hotel, 60)}\nDove: ${where}\nLavoro: ${oneLine(r.title, 140)}\nQuando: ${when}\n\nMessaggio automatico di RandApp.`,
    });
  } finally {
    await client.close();
  }
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "Metodo non consentito" }, 405);
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return json({ ok: false, error: "Richiesta non valida" }, 400); }
  const token = typeof body.token === "string" ? body.token : "";
  if (!/^[0-9a-f]{64}$/.test(token)) return json({ ok: false, error: "Link non valido o scaduto" }, 404);
  try {
    if (body.action === "get") {
      const [row] = await sql`select randapp.portal_get(${token}) as data`;
      if (!row?.data) return json({ ok: false, error: "Link non valido o scaduto" }, 404);
      return json({ ok: true, job: row.data });
    }
    if (body.action === "event") {
      const kind = String(body.kind || "");
      const note = typeof body.note === "string" ? body.note : "";
      const arrival = typeof body.arrival_at === "string" && !Number.isNaN(Date.parse(body.arrival_at)) ? new Date(body.arrival_at).toISOString() : null;
      const [row] = await sql`select randapp.portal_event(${token}, ${kind}, ${note}, ${arrival}::timestamptz) as ok`;
      if (!row?.ok) return json({ ok: false, error: "Non è stato possibile registrarlo (link scaduto, lavoro già chiuso, nota vuota o data non valida)" }, 409);
      // Best effort: un errore di posta non deve far perdere l'appuntamento.
      if (kind === "arrival_set") { try { await notifyReception(token); } catch (e) { console.error("technician-portal mail", (e as Error)?.message); } }
      const [again] = await sql`select randapp.portal_get(${token}) as data`;
      return json({ ok: true, job: again?.data ?? null });
    }
    return json({ ok: false, error: "Richiesta non valida" }, 400);
  } catch (e) {
    console.error("technician-portal", (e as Error)?.message);
    return json({ ok: false, error: "Errore temporaneo. Riprova." }, 500);
  }
});
