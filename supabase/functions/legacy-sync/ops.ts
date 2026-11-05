// Interventi, planning lavori e prenotazioni sale dalla vecchia app (sola lettura). Usato da index.ts.
// Idempotente: ogni riga ha legacy_id. Le righe importate non generano notifiche (vedi migrazione 0019).
import type postgres from "npm:postgres@3.4.7";

type Sql = ReturnType<typeof postgres>;
const HOTEL = "hotelgio";

const clean = (v: unknown, max: number) => {
  const s = String(v ?? "").replace(/\s+/g, " ").trim();
  return s ? s.slice(0, max) : null;
};
const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
const day = (v: unknown) => (v ? new Date(v as string).toISOString().slice(0, 10) : null);
const firstLine = (note: string) => note.split(/\r?\n/)[0].trim();

// ------------------------------------------------------------------ interventi
const CAT: Record<string, string> = {
  filtri: "Filtri", varie: "Altro", idromassaggio: "Idromassaggio", edilizio: "Edilizio", extrapiani: "Extrapiani", arredo: "Arredi",
};

function toIntervention(r: Record<string, any>) {
  const note = String(r.note ?? "").trim();
  const title = (firstLine(note) || `Intervento ${r.camera ?? ""}`.trim()).slice(0, 140);
  const done = r.stato === "done";
  const at = iso(r.programmato_dal ?? r.programmato_il);
  let until = iso(r.programmato_al);
  if (until && at && until < at) until = null;
  const rooms = (Array.isArray(r.camere) ? r.camere : []).map((x: unknown) => String(x).slice(0, 20)).slice(0, 60);
  const roomsDone: Record<string, { at: string | null; by: string | null }> = {};
  for (const [room, v] of Object.entries((r.camere_fatte ?? {}) as Record<string, any>)) {
    roomsDone[room] = { at: v?.at ? new Date(Number(v.at)).toISOString() : null, by: clean(v?.by, 80) };
  }
  const names = (Array.isArray(r.assegnatari) ? r.assegnatari : []).filter((a: any) => !a?.isExt).map((a: any) => String(a?.name ?? "").toLowerCase()).filter(Boolean);
  return {
    legacy_id: String(r.id),
    title,
    notes: note.length > title.length ? note.slice(0, 2000) : null,
    location: clean(r.camera, 40),
    category: CAT[String(r.categoria ?? "")] ?? "Altro",
    status: done ? "fatto" : "da_fare",
    scheduled_at: at,
    scheduled_until: until,
    rooms,
    rooms_done: roomsDone,
    assignee_names: names,
    created_by_name: clean(r.creato_da, 80),
    created_at: iso(r.creato_il),
    completed_at: done ? iso(r.completato_il) : null,
    completed_by_name: done ? clean(r.completato_da, 80) : null,
  };
}

export async function syncInterventions(legacy: Sql, local: Sql) {
  const rows = await legacy`
    select id, camera, categoria, note, programmato_il, assegnatari, stato, creato_da, creato_il, completato_da, completato_il,
           camere, camere_fatte, programmato_dal, programmato_al from public.interventi order by creato_il`;
  const payload = JSON.stringify(rows.map(toIntervention));
  const res = await local`
    with src as (
      select * from jsonb_to_recordset(${payload}::text::jsonb) as r(
        legacy_id uuid, title text, notes text, location text, category text, status text, scheduled_at timestamptz,
        scheduled_until timestamptz, rooms text[], rooms_done jsonb, assignee_names text[], created_by_name text,
        created_at timestamptz, completed_at timestamptz, completed_by_name text)
    ), prep as (
      select s.*, coalesce((select array_agg(distinct p.auth_user_id) from randapp.profiles p
                              join randapp.hotel_memberships m on m.auth_user_id = p.auth_user_id and m.hotel_id = ${HOTEL}
                             where lower(p.display_name) = any (s.assignee_names)), '{}'::uuid[]) as ids,
             (select p.auth_user_id from randapp.profiles p
                join randapp.hotel_memberships m on m.auth_user_id = p.auth_user_id and m.hotel_id = ${HOTEL}
               where lower(p.display_name) = lower(s.created_by_name) limit 1) as creator
      from src s
    ), up as (
      insert into randapp.interventions (hotel_id, legacy_id, title, notes, location, category, status, scheduled_at, scheduled_until,
                                         rooms, rooms_done, assignee_ids, assigned_to, created_by, created_by_name, created_at,
                                         completed_at, completed_by_name)
      select ${HOTEL}, legacy_id, title, notes, location, category, status, scheduled_at, scheduled_until, coalesce(rooms, '{}'),
             coalesce(rooms_done, '{}'::jsonb), ids, ids[1], creator, created_by_name, coalesce(created_at, now()), completed_at, completed_by_name
      from prep
      on conflict (legacy_id) do update set
        title = excluded.title, notes = excluded.notes, location = excluded.location, category = excluded.category,
        status = excluded.status, scheduled_at = excluded.scheduled_at, scheduled_until = excluded.scheduled_until,
        rooms = excluded.rooms, rooms_done = excluded.rooms_done, assignee_ids = excluded.assignee_ids,
        assigned_to = excluded.assigned_to, completed_at = excluded.completed_at, completed_by_name = excluded.completed_by_name
      where (randapp.interventions.title, randapp.interventions.notes, randapp.interventions.location, randapp.interventions.category,
             randapp.interventions.status, randapp.interventions.scheduled_at, randapp.interventions.scheduled_until,
             randapp.interventions.rooms, randapp.interventions.rooms_done::text, randapp.interventions.assignee_ids,
             randapp.interventions.completed_at, randapp.interventions.completed_by_name)
        is distinct from
            (excluded.title, excluded.notes, excluded.location, excluded.category, excluded.status, excluded.scheduled_at,
             excluded.scheduled_until, excluded.rooms, excluded.rooms_done::text, excluded.assignee_ids,
             excluded.completed_at, excluded.completed_by_name)
      returning (xmax = 0) as inserted
    )
    select count(*) filter (where inserted) as inserted, count(*) filter (where not inserted) as updated from up`;
  return { read: rows.length, inserted: Number(res[0].inserted), updated: Number(res[0].updated) };
}

// ------------------------------------------------------------------ planning lavori (un lavoro = più giorni)
const DAY_STATUS: Record<string, string> = { fatto: "fatto", da_finire: "da_finire" };

export async function syncWorks(legacy: Sql, local: Sql) {
  const works = await legacy`select id, descrizione, creato_da, creato_il from public.planning_lavori order by creato_il`;
  const days = await legacy`select lavoro_id, data, stato, fatto, fatto_da, fatto_il from public.planning_lavori_giorni order by data`;
  const byWork = new Map<string, Record<string, any>[]>();
  for (const d of days) {
    const k = String(d.lavoro_id);
    if (!byWork.has(k)) byWork.set(k, []);
    byWork.get(k)!.push(d);
  }
  const items = works.flatMap((w) => {
    const ds = (byWork.get(String(w.id)) ?? []).slice(0, 31);
    const description = clean(w.descrizione, 200);
    if (!ds.length || !description) return [];
    return [{
      legacy_id: String(w.id),
      description,
      created_by_name: clean(w.creato_da, 80),
      created_at: iso(w.creato_il),
      days: ds.map((d) => ({
        day: day(d.data),
        status: d.fatto ? "fatto" : (DAY_STATUS[String(d.stato ?? "")] ?? "da_fare"),
        by: d.fatto || d.stato === "fatto" || d.stato === "da_finire" ? clean(d.fatto_da, 80) : null,
        at: d.fatto || d.stato === "fatto" || d.stato === "da_finire" ? iso(d.fatto_il) : null,
      })),
    }];
  });
  const payload = JSON.stringify(items);

  const res = await local`
    with src as (
      select * from jsonb_to_recordset(${payload}::text::jsonb) as r(
        legacy_id uuid, description text, created_by_name text, created_at timestamptz, days jsonb)
    ), up as (
      insert into randapp.planning_works (hotel_id, legacy_id, description, days, created_by, created_by_name, created_at)
      select ${HOTEL}, s.legacy_id, s.description,
             (select array_agg(distinct (d->>'day')::date order by (d->>'day')::date) from jsonb_array_elements(s.days) d),
             (select p.auth_user_id from randapp.profiles p
                join randapp.hotel_memberships m on m.auth_user_id = p.auth_user_id and m.hotel_id = ${HOTEL}
               where lower(p.display_name) = lower(s.created_by_name) limit 1),
             s.created_by_name, coalesce(s.created_at, now())
      from src s
      on conflict (legacy_id) do update set description = excluded.description, days = excluded.days
      where (randapp.planning_works.description, randapp.planning_works.days) is distinct from (excluded.description, excluded.days)
      returning (xmax = 0) as inserted
    )
    select count(*) filter (where inserted) as inserted, count(*) filter (where not inserted) as updated from up`;

  // Giorni: stato e chi/quando, riallineati. I giorni nuovi nascono qui se il lavoro esisteva già.
  const dres = await local`
    with src as (
      select s.legacy_id, d->>'day' as day, d->>'status' as status, d->>'by' as by, nullif(d->>'at', '')::timestamptz as at
      from jsonb_to_recordset(${payload}::text::jsonb) as s(legacy_id uuid, days jsonb), jsonb_array_elements(s.days) d
    ), up as (
      insert into randapp.planning_work_days (hotel_id, work_id, day, status, status_by_name, status_at)
      select ${HOTEL}, w.id, s.day::date, s.status, case when s.status = 'da_fare' then null else s.by end,
             case when s.status = 'da_fare' then null else s.at end
      from src s join randapp.planning_works w on w.legacy_id = s.legacy_id
      on conflict (work_id, day) do update set
        status = excluded.status, status_by_name = excluded.status_by_name, status_at = excluded.status_at
      where (randapp.planning_work_days.status, randapp.planning_work_days.status_by_name, randapp.planning_work_days.status_at)
        is distinct from (excluded.status, excluded.status_by_name, excluded.status_at)
      returning 1
    )
    select count(*) as n from up`;

  // Il lavoro è "fatto" quando nessun giorno è da fare o da finire (stessa regola di planning_work_day_set).
  await local`
    update randapp.planning_works w
       set status = case when o.open = 0 then 'fatto' else 'da_fare' end,
           completed_at = case when o.open = 0 then o.last_at else null end
      from (select work_id, count(*) filter (where status in ('da_fare','da_finire')) as open, max(status_at) as last_at
              from randapp.planning_work_days group by work_id) o
     where w.id = o.work_id and w.legacy_id is not null
       and (w.status is distinct from case when o.open = 0 then 'fatto' else 'da_fare' end)`;
  return { read: works.length, inserted: Number(res[0].inserted), updated: Number(res[0].updated), days_changed: Number(dres[0].n) };
}

// ------------------------------------------------------------------ prenotazioni sale
const SHIFT: Record<string, string> = { tutto_giorno: "giornata", mattina: "mattina", pomeriggio: "pomeriggio", sera: "sera" };

export async function syncBookings(legacy: Sql, local: Sql) {
  const rows = await legacy`select id, sala, data, turno, cliente, note, creato_da, creato_il from public.prenotazioni_sale order by data`;
  const payload = JSON.stringify(rows.flatMap((r) => {
    const room = clean(r.sala, 60);
    const d = day(r.data);
    if (!room || !d) return [];
    return [{
      legacy_id: String(r.id), room, client: clean(r.cliente, 80) ?? "—", day: d,
      shift: SHIFT[String(r.turno ?? "")] ?? "giornata", notes: String(r.note ?? "").trim().slice(0, 2000) || null,
      created_by_name: clean(r.creato_da, 80), created_at: iso(r.creato_il),
    }];
  }));
  const res = await local`
    with src as (
      select * from jsonb_to_recordset(${payload}::text::jsonb) as r(
        legacy_id uuid, room text, client text, day date, shift text, notes text, created_by_name text, created_at timestamptz)
    ), up as (
      insert into randapp.sale_bookings (hotel_id, legacy_id, room, client, date_from, date_to, shift, notes, created_by,
                                         created_by_name, created_at, op_status)
      select ${HOTEL}, s.legacy_id, s.room, s.client, s.day, s.day, s.shift, s.notes,
             (select p.auth_user_id from randapp.profiles p
                join randapp.hotel_memberships m on m.auth_user_id = p.auth_user_id and m.hotel_id = ${HOTEL}
               where lower(p.display_name) = lower(s.created_by_name) limit 1),
             s.created_by_name, coalesce(s.created_at, now()),
             case when s.day < current_date then 'fatto' else 'da_fare' end
      from src s
      on conflict (legacy_id) do update set
        room = excluded.room, client = excluded.client, date_from = excluded.date_from, date_to = excluded.date_to,
        shift = excluded.shift, notes = excluded.notes
      where (randapp.sale_bookings.room, randapp.sale_bookings.client, randapp.sale_bookings.date_from, randapp.sale_bookings.shift,
             randapp.sale_bookings.notes)
        is distinct from (excluded.room, excluded.client, excluded.date_from, excluded.shift, excluded.notes)
      returning (xmax = 0) as inserted
    )
    select count(*) filter (where inserted) as inserted, count(*) filter (where not inserted) as updated from up`;
  return { read: rows.length, inserted: Number(res[0].inserted), updated: Number(res[0].updated) };
}
