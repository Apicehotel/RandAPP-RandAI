-- Copia dalla vecchia app anche di interventi, planning lavori e prenotazioni sale (vedi funzione legacy-sync).
-- Ogni riga importata ha legacy_id (id nella vecchia app) e il nome di chi l'ha creata; created_by diventa facoltativo
-- (dall'app resta obbligatorio: le policy di insert richiedono created_by = auth.uid()).
-- Le righe importate NON generano notifiche (storico).

alter table randapp.interventions
  add column legacy_id uuid unique,
  add column created_by_name   text check (created_by_name is null or char_length(created_by_name) <= 80),
  add column completed_by_name text check (completed_by_name is null or char_length(completed_by_name) <= 80),
  add column rooms_done jsonb not null default '{}'::jsonb,
  alter column created_by drop not null;

alter table randapp.planning_works
  add column legacy_id uuid unique,
  add column created_by_name text check (created_by_name is null or char_length(created_by_name) <= 80),
  alter column created_by drop not null;

alter table randapp.sale_bookings
  add column legacy_id uuid unique,
  add column created_by_name text check (created_by_name is null or char_length(created_by_name) <= 80),
  alter column created_by drop not null;

grant select (legacy_id, created_by_name, completed_by_name, rooms_done) on randapp.interventions to authenticated;
grant select (legacy_id, created_by_name) on randapp.planning_works to authenticated;
grant select (legacy_id, created_by_name) on randapp.sale_bookings to authenticated;

create or replace function randapp.trg_notify_intervention()
returns trigger language plpgsql security definer set search_path = randapp as $$
declare added uuid[];
begin
  if new.legacy_id is not null then return new; end if;
  select coalesce(array_agg(x), '{}') into added
    from unnest(new.assignee_ids) x
    where tg_op = 'INSERT' or not (x = any (old.assignee_ids));
  if cardinality(added) > 0 then
    perform randapp.notify(new.hotel_id, null, added, 'intervention_assigned', 'Intervento assegnato a te',
      new.title || coalesce(' · ' || new.location, ''), '/interventions/' || new.id, 'normal', new.id, new.created_by);
  end if;
  return new;
end;
$$;

create or replace function randapp.trg_notify_work()
returns trigger language plpgsql security definer set search_path = randapp as $$
declare added uuid[];
begin
  if new.legacy_id is not null then return new; end if;
  select coalesce(array_agg(x), '{}') into added
    from unnest(new.assignee_ids) x
    where tg_op = 'INSERT' or not (x = any (old.assignee_ids));
  if cardinality(added) > 0 then
    perform randapp.notify(new.hotel_id, null, added, 'work_assigned', 'Lavoro assegnato a te',
      new.description, '/planning/work', 'normal', new.id, new.created_by);
  end if;
  return new;
end;
$$;
