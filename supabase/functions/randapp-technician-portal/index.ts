// Pagina del tecnico (link personale, senza accesso all'app). Nessun JWT: il codice nel link è la credenziale.
// Il codice è lungo e casuale; nel database c'è solo la sua impronta. Le funzioni SQL portal_* non sono
// eseguibili da anon/authenticated: si arriva ai dati solo da qui. Risposte generiche, mai dettagli interni.
import postgres from "npm:postgres@3.4.7";

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 2, connect_timeout: 5, idle_timeout: 10 });
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
      const [row] = await sql`select randapp.portal_event(${token}, ${kind}, ${note}) as ok`;
      if (!row?.ok) return json({ ok: false, error: "Non è stato possibile registrarlo (link scaduto, lavoro già chiuso o nota vuota)" }, 409);
      const [again] = await sql`select randapp.portal_get(${token}) as data`;
      return json({ ok: true, job: again?.data ?? null });
    }
    return json({ ok: false, error: "Richiesta non valida" }, 400);
  } catch (e) {
    console.error("technician-portal", (e as Error)?.message);
    return json({ ok: false, error: "Errore temporaneo. Riprova." }, 500);
  }
});
