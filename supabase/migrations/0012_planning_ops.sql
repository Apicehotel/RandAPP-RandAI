-- Planning allineato alla vecchia app: stato PER GIORNO nei lavori, stato operativo e check Audio/Video
-- nelle prenotazioni sale, sale con famiglie e combinazioni.
-- Le scritture sensibili (stati, chi/quando) passano solo da funzioni del server; nessuna policy di DELETE.

insert into public.role_permissions (role, permission) values
  ('admin','planning_sale.operate'), ('direzione','planning_sale.operate'),
  ('responsabile','planning_sale.operate'), ('manutentore','planning_sale.operate')
on conflict do nothing;

-- ---------------------------------------------------------------- lavori: uno stato per giorno
create table public.planning_work_days (
  id             uuid primary key default gen_random_uuid(),
  hotel_id       text not null references public.hotels (id),
  work_id        uuid not null references public.planning_works (id),
  day            date not null,
  status         text not null default 'da_fare' check (status in ('da_fare','da_finire','fatto','annullato')),
  status_by_name text check (status_by_name is null or char_length(status_by_name) <= 80),
  status_at      timestamptz,
  updated_at     timestamptz not null default now(),
  unique (work_id, day)
);
create index planning_work_days_hotel_day_idx on public.planning_work_days (hotel_id, day);
create trigger planning_work_days_touch before update on public.planning_work_days
  for each row execute function public.touch_updated_at();

alter table public.planning_work_days enable row level security;
create policy planning_work_days_select on public.planning_work_days
  for select to authenticated using (public.has_permission(hotel_id, 'planning_work.view'));
-- Nessuna policy di insert/update/delete: i giorni nascono dal trigger e cambiano con la funzione sotto.
revoke all on public.planning_work_days from anon;
revoke all on public.planning_work_days from authenticated;
grant select on public.planning_work_days to authenticated;

-- Ogni lavoro crea le sue righe-giorno (stesso hotel_id).
create or replace function public.planning_work_make_days()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.planning_work_days (hotel_id, work_id, day)
  select new.hotel_id, new.id, d from unnest(new.days) as d
  on conflict do nothing;
  return new;
end;
$$;
revoke all on function public.planning_work_make_days() from public, anon, authenticated;
create trigger planning_works_make_days after insert on public.planning_works
  for each row execute function public.planning_work_make_days();

-- Lavori già presenti: una riga per ogni giorno.
insert into public.planning_work_days (hotel_id, work_id, day, status)
select w.hotel_id, w.id, d, case when w.status = 'fatto' then 'fatto' else 'da_fare' end
from public.planning_works w, unnest(w.days) as d
on conflict do nothing;

create or replace function public.planning_work_day_set(p_day uuid, p_status text)
returns public.planning_work_days
language plpgsql security definer set search_path = public as $$
declare
  v_row  public.planning_work_days;
  v_name text;
  v_open integer;
begin
  if p_status not in ('da_fare','da_finire','fatto','annullato') then
    raise exception using errcode = '22023', message = 'stato non valido';
  end if;
  select * into v_row from public.planning_work_days where id = p_day;
  if not found or not public.has_permission(v_row.hotel_id, 'planning_work.update') then
    raise exception using errcode = '42501', message = 'non autorizzato';
  end if;
  select display_name into v_name from public.profiles where auth_user_id = auth.uid();
  update public.planning_work_days
     set status = p_status,
         status_by_name = case when p_status = 'da_fare' then null else v_name end,
         status_at      = case when p_status = 'da_fare' then null else now() end
   where id = p_day returning * into v_row;
  -- Il lavoro è "fatto" quando non resta nessun giorno da fare o da finire.
  select count(*) into v_open from public.planning_work_days
   where work_id = v_row.work_id and status in ('da_fare','da_finire');
  update public.planning_works
     set status = case when v_open = 0 then 'fatto' else 'da_fare' end,
         completed_at = case when v_open = 0 then now() else null end
   where id = v_row.work_id;
  return v_row;
end;
$$;
revoke all on function public.planning_work_day_set(uuid, text) from public, anon;
grant execute on function public.planning_work_day_set(uuid, text) to authenticated;

-- Lo stato del lavoro intero non si scrive più dal browser (lo gestisce la funzione).
revoke update on public.planning_works from authenticated;
grant update (description, category, assignee_ids) on public.planning_works to authenticated;

-- ---------------------------------------------------------------- sale: famiglie e combinazioni
alter table public.sale_rooms
  add column family text check (family is null or char_length(family) <= 60),
  add column parts  text[] not null default '{}' check (cardinality(parts) <= 20);
-- parts vuoto = sala singola (la sua parte è il suo id); una combinazione elenca le parti che occupa.

-- ---------------------------------------------------------------- prenotazioni: stato operativo e check
alter table public.sale_bookings
  add column op_status      text not null default 'da_fare' check (op_status in ('da_fare','da_finire','fatto')),
  add column op_by_name     text check (op_by_name is null or char_length(op_by_name) <= 80),
  add column op_at          timestamptz,
  add column audio_status   text not null default 'non_richiesto' check (audio_status in ('non_richiesto','da_verificare','ok','problema')),
  add column audio_by_name  text check (audio_by_name is null or char_length(audio_by_name) <= 80),
  add column audio_at       timestamptz,
  add column video_status   text not null default 'non_richiesto' check (video_status in ('non_richiesto','da_verificare','ok','problema')),
  add column video_by_name  text check (video_by_name is null or char_length(video_by_name) <= 80),
  add column video_at       timestamptz;

-- Alla creazione e quando cambia "richiesto" dal modulo i check si riallineano da soli
-- (se cambia anche lo stato, è la funzione sale_booking_set_check a decidere).
create or replace function public.sale_booking_sync_checks()
returns trigger language plpgsql as $$
declare
  v_audio boolean := true;
  v_video boolean := true;
begin
  if tg_op = 'UPDATE' then
    v_audio := new.audio_required is distinct from old.audio_required and new.audio_status is not distinct from old.audio_status;
    v_video := new.video_required is distinct from old.video_required and new.video_status is not distinct from old.video_status;
  end if;
  if v_audio then
    new.audio_status  := case when new.audio_required then 'da_verificare' else 'non_richiesto' end;
    new.audio_by_name := null; new.audio_at := null;
  end if;
  if v_video then
    new.video_status  := case when new.video_required then 'da_verificare' else 'non_richiesto' end;
    new.video_by_name := null; new.video_at := null;
  end if;
  return new;
end;
$$;
create trigger sale_bookings_sync_checks before insert or update on public.sale_bookings
  for each row execute function public.sale_booking_sync_checks();

-- Dal browser si scrivono solo i dati della prenotazione; stati e check passano dalle funzioni.
revoke insert, update on public.sale_bookings from authenticated;
grant insert (hotel_id, room, client, date_from, date_to, shift, pax, notes, layout, prep_date,
              audio_required, video_required, created_by)
  on public.sale_bookings to authenticated;
grant update (room, client, date_from, date_to, shift, pax, notes, layout, prep_date,
              audio_required, video_required, status)
  on public.sale_bookings to authenticated;

create or replace function public.sale_booking_set_op(p_id uuid, p_status text)
returns public.sale_bookings
language plpgsql security definer set search_path = public as $$
declare
  v_row  public.sale_bookings;
  v_name text;
begin
  if p_status not in ('da_fare','da_finire','fatto') then
    raise exception using errcode = '22023', message = 'stato non valido';
  end if;
  select * into v_row from public.sale_bookings where id = p_id;
  if not found or not public.has_permission(v_row.hotel_id, 'planning_sale.operate') then
    raise exception using errcode = '42501', message = 'non autorizzato';
  end if;
  if p_status = 'fatto' and (v_row.audio_status not in ('non_richiesto','ok') or v_row.video_status not in ('non_richiesto','ok')) then
    raise exception using errcode = '22023', message = 'Completa prima i controlli Audio/Video richiesti o impostali come non richiesti';
  end if;
  select display_name into v_name from public.profiles where auth_user_id = auth.uid();
  update public.sale_bookings
     set op_status = p_status,
         op_by_name = case when p_status = 'da_fare' then null else v_name end,
         op_at      = case when p_status = 'da_fare' then null else now() end
   where id = p_id returning * into v_row;
  return v_row;
end;
$$;
revoke all on function public.sale_booking_set_op(uuid, text) from public, anon;
grant execute on function public.sale_booking_set_op(uuid, text) to authenticated;

create or replace function public.sale_booking_set_check(p_id uuid, p_kind text, p_state text)
returns public.sale_bookings
language plpgsql security definer set search_path = public as $$
declare
  v_row  public.sale_bookings;
  v_name text;
  v_by   text;
  v_at   timestamptz;
begin
  if p_kind not in ('audio','video') or p_state not in ('non_richiesto','da_verificare','ok','problema') then
    raise exception using errcode = '22023', message = 'valore non valido';
  end if;
  select * into v_row from public.sale_bookings where id = p_id;
  if not found or not public.has_permission(v_row.hotel_id, 'planning_sale.operate') then
    raise exception using errcode = '42501', message = 'non autorizzato';
  end if;
  select display_name into v_name from public.profiles where auth_user_id = auth.uid();
  v_by := case when p_state in ('ok','problema') then v_name end;
  v_at := case when p_state in ('ok','problema') then now() end;
  if p_kind = 'audio' then
    update public.sale_bookings
       set audio_required = (p_state <> 'non_richiesto'), audio_status = p_state, audio_by_name = v_by, audio_at = v_at
     where id = p_id returning * into v_row;
  else
    update public.sale_bookings
       set video_required = (p_state <> 'non_richiesto'), video_status = p_state, video_by_name = v_by, video_at = v_at
     where id = p_id returning * into v_row;
  end if;
  return v_row;
end;
$$;
revoke all on function public.sale_booking_set_check(uuid, text, text) from public, anon;
grant execute on function public.sale_booking_set_check(uuid, text, text) to authenticated;
