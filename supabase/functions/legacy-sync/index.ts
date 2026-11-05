// Sincronizza le segnalazioni dalla vecchia app (progetto Supabase "HotelGio") verso `randapp`.
// SOLO LETTURA sulla vecchia: si collega con un utente che può soltanto fare select (randapp_reader).
// Si chiama ogni 24 ore (pg_cron, vedi README) con l'intestazione x-sync-secret.
// Idempotente: ogni segnalazione ha `legacy_id` (id nella vecchia app); rilanciarla aggiorna, non duplica.
// Fino alla dismissione la vecchia app è la fonte: le modifiche fatte nella nuova su righe importate vengono riallineate.
// Segreti (variabili della funzione o tabella `edge_function_secrets`): legacy_db_password, legacy_db_host, legacy_project_ref, sensor_sync_secret.
// Di proposito NON si copiano i numeri di telefono di chi ha scritto su WhatsApp.
import postgres from "npm:postgres@3.4.7";

const HOTEL = "hotelgio";
const local = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 2, connect_timeout: 5, idle_timeout: 10 });

async function secret(name: string): Promise<string | null> {
  const v = Deno.env.get(name.toUpperCase());
  if (v) return v;
  try {
    const rows = await local`select value from public.edge_function_secrets where key = ${name} limit 1`;
    return rows[0]?.value ? String(rows[0].value) : null;
  } catch {
    return null;
  }
}

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

function sameSecret(a: string, b: string) {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let d = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) d |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return d === 0;
}

const clean = (v: unknown, max: number) => {
  const s = String(v ?? "").replace(/\s+/g, " ").trim();
  return s ? s.slice(0, max) : null;
};

// "WhatsApp +39..." → fonte whatsapp, nessun numero. Altri nomi restano com'erano.
function author(raw: unknown) {
  const s = String(raw ?? "").trim();
  if (/^whatsapp/i.test(s)) return { name: "WhatsApp", source: "whatsapp" };
  return { name: clean(s, 80), source: "import" };
}

function toRow(r: Record<string, unknown>) {
  const note = String(r.note ?? "").trim();
  const firstLine = note.split(/\r?\n/)[0].trim();
  const title = (firstLine || (r.camera ? `Segnalazione ${r.camera}` : "Segnalazione")).slice(0, 140);
  const description = note.length > title.length ? note.slice(0, 2000) : null;
  const a = author(r.creato_da);
  const done = r.stato === "done";
  const extra = [clean(r.nota_completamento, 1000), clean(r.tecnico_nota_extra, 900)].filter(Boolean).join(" · ");
  return {
    legacy_id: String(r.id),
    title,
    description,
    category: String(r.categoria ?? ""),
    urgency: String(r.urgenza ?? ""),
    stato: String(r.stato ?? ""),
    tecnico: !done && !!clean(r.tecnico_nome, 80),
    room: clean(r.camera, 40),
    created_at: r.creato_il ? new Date(r.creato_il as string).toISOString() : null,
    completed_at: done && r.completato_il ? new Date(r.completato_il as string).toISOString() : null,
    source: a.source,
    created_by_name: a.name,
    completed_by_name: done ? clean(r.completato_da, 80) : null,
    completion_note: extra ? extra.slice(0, 2000) : null,
    technician_name: clean(r.tecnico_nome, 80),
    part_replaced: clean(r.pezzo_sostituito ?? r.pezzo_nome, 200),
  };
}

async function syncIssues(legacy: ReturnType<typeof postgres>) {
  const rows = await legacy`
    select id, camera, urgenza, categoria, stato, note, creato_da, creato_il, completato_da, completato_il,
           nota_completamento, tecnico_nome, tecnico_nota_extra, pezzo_nome, pezzo_sostituito
    from public.segnalazioni order by creato_il`;
  const payload = JSON.stringify(rows.map(toRow));

  const res = await local`
    with src as (
      select * from jsonb_to_recordset(${payload}::text::jsonb) as r(
        legacy_id uuid, title text, description text, category text, urgency text, stato text, tecnico boolean, room text,
        created_at timestamptz, completed_at timestamptz, source text, created_by_name text, completed_by_name text,
        completion_note text, technician_name text, part_replaced text)
    ), up as (
      insert into randapp.issues (hotel_id, legacy_id, title, description, category, urgency, status, room, created_by,
                                  created_at, completed_at, source, created_by_name, completed_by_name,
                                  completion_note, technician_name, part_replaced)
      select ${HOTEL}, s.legacy_id, s.title, s.description, randapp.legacy_category(s.category),
             randapp.legacy_urgency(s.urgency), randapp.legacy_status(s.stato, s.tecnico), s.room,
             (select p.auth_user_id from randapp.profiles p
                join randapp.hotel_memberships m on m.auth_user_id = p.auth_user_id and m.hotel_id = ${HOTEL}
               where s.source = 'import' and lower(p.display_name) = lower(s.created_by_name) limit 1),
             coalesce(s.created_at, now()), s.completed_at, s.source, s.created_by_name, s.completed_by_name,
             s.completion_note, s.technician_name, s.part_replaced
      from src s
      on conflict (legacy_id) do update set
        title = excluded.title, description = excluded.description, category = excluded.category,
        urgency = excluded.urgency, status = excluded.status, room = excluded.room,
        completed_at = excluded.completed_at, completed_by_name = excluded.completed_by_name,
        completion_note = excluded.completion_note, technician_name = excluded.technician_name,
        part_replaced = excluded.part_replaced
      where (randapp.issues.title, randapp.issues.description, randapp.issues.category, randapp.issues.urgency,
             randapp.issues.status, randapp.issues.room, randapp.issues.completed_at, randapp.issues.completed_by_name,
             randapp.issues.completion_note, randapp.issues.technician_name, randapp.issues.part_replaced)
        is distinct from
            (excluded.title, excluded.description, excluded.category, excluded.urgency, excluded.status, excluded.room,
             excluded.completed_at, excluded.completed_by_name, excluded.completion_note, excluded.technician_name,
             excluded.part_replaced)
      returning (xmax = 0) as inserted
    )
    select count(*) filter (where inserted) as inserted, count(*) filter (where not inserted) as updated from up`;
  return { read: rows.length, inserted: Number(res[0].inserted), updated: Number(res[0].updated) };
}

// Foto: si copiano solo quelle che mancano (prima/dopo), a piccoli gruppi.
async function syncPhotos(legacy: ReturnType<typeof postgres>) {
  const have = await local`
    select i.legacy_id, array_agg(p.kind) as kinds
    from randapp.issues i left join randapp.issue_photos p on p.issue_id = i.id
    where i.hotel_id = ${HOTEL} and i.legacy_id is not null group by i.legacy_id`;
  const known = new Map(have.map((r) => [String(r.legacy_id), new Set((r.kinds as (string | null)[]).filter(Boolean) as string[])]));

  const cand = await legacy`
    select id, (foto_prima is not null and foto_prima <> '') as p, (foto_dopo is not null and foto_dopo <> '') as d
    from public.segnalazioni where (foto_prima is not null and foto_prima <> '') or (foto_dopo is not null and foto_dopo <> '')`;
  const todo = cand.filter((c) => {
    const k = known.get(String(c.id));
    return k && ((c.p && !k.has("prima")) || (c.d && !k.has("dopo")));
  }).map((c) => String(c.id));

  let copied = 0, skipped = 0;
  for (let i = 0; i < todo.length; i += 10) {
    const ids = todo.slice(i, i + 10);
    const photos = await legacy`select id, foto_prima, foto_dopo from public.segnalazioni where id = any(${ids}::uuid[])`;
    for (const ph of photos) {
      for (const [kind, data] of [["prima", ph.foto_prima], ["dopo", ph.foto_dopo]] as const) {
        const s = typeof data === "string" ? data : "";
        if (!s) continue;
        if (!s.startsWith("data:image/") || s.length > 2_000_000) { skipped += 1; continue; }
        const r = await local`
          insert into randapp.issue_photos (hotel_id, issue_id, kind, data_url)
          select ${HOTEL}, i.id, ${kind}, ${s} from randapp.issues i where i.legacy_id = ${String(ph.id)}::uuid
          on conflict (issue_id, kind) do nothing returning 1`;
        copied += r.length;
      }
    }
  }
  return { missing: todo.length, copied, skipped };
}

Deno.serve(async (req) => {
  let legacy: ReturnType<typeof postgres> | null = null;
  try {
    if (req.method !== "POST") return json({ ok: false, error: "Metodo non consentito" }, 405);
    const provided = req.headers.get("x-sync-secret");
    const expected = await secret("sensor_sync_secret");
    if (!provided || !expected || !sameSecret(provided, expected)) return json({ ok: false, error: "Non autorizzato" }, 401);

    const [pwd, host, ref] = await Promise.all([secret("legacy_db_password"), secret("legacy_db_host"), secret("legacy_project_ref")]);
    if (!pwd || !host || !ref) return json({ ok: false, error: "Collegamento alla vecchia app non configurato" }, 500);

    legacy = postgres({
      host, port: 5432, database: "postgres", username: `randapp_reader.${ref}`, password: pwd,
      ssl: "require", prepare: false, max: 1, connect_timeout: 10, idle_timeout: 10,
    });
    const issues = await syncIssues(legacy);
    const photos = await syncPhotos(legacy);
    return json({ ok: true, issues, photos });
  } catch (e) {
    return json({ ok: false, error: String((e as Error)?.message ?? e).slice(0, 200) }, 500);
  } finally {
    if (legacy) await legacy.end({ timeout: 2 }).catch(() => {});
  }
});
