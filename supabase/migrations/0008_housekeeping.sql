-- Housekeeping: camere per piano con stato di lavoro (da fare / in corso / fatto).
-- L'import dello stato camere da Slope NON c'è ancora: per ora le camere si aggiungono a mano (housekeeping.manage).

insert into public.role_permissions (role, permission) values
  ('admin','housekeeping.view'), ('admin','housekeeping.update'), ('admin','housekeeping.manage'),
  ('direzione','housekeeping.view'), ('direzione','housekeeping.update'), ('direzione','housekeeping.manage'),
  ('responsabile','housekeeping.view'), ('responsabile','housekeeping.update'), ('responsabile','housekeeping.manage'),
  ('manutentore','housekeeping.view'),
  ('governante','housekeeping.view'), ('governante','housekeeping.update'),
  ('reception','housekeeping.view')
on conflict do nothing;

create table public.hk_rooms (
  id         uuid primary key default gen_random_uuid(),
  hotel_id   text not null references public.hotels (id),
  room       text not null check (char_length(btrim(room)) between 1 and 12),
  floor      integer not null default 0 check (floor between -3 and 20),
  kind       text check (kind is null or char_length(kind) <= 40),
  status     text not null default 'dafare' check (status in ('dafare','in_corso','fatto')),
  note       text check (note is null or char_length(note) <= 200),
  active     boolean not null default true,
  created_by uuid not null references auth.users (id),
  updated_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hotel_id, room)
);
create index hk_rooms_hotel_idx on public.hk_rooms (hotel_id, active, floor, room);
create trigger hk_rooms_touch before update on public.hk_rooms
  for each row execute function public.touch_updated_at();

alter table public.hk_rooms enable row level security;

create policy hk_rooms_select on public.hk_rooms
  for select to authenticated using (public.has_permission(hotel_id, 'housekeeping.view'));
create policy hk_rooms_insert on public.hk_rooms
  for insert to authenticated
  with check (public.has_permission(hotel_id, 'housekeeping.manage') and created_by = auth.uid());
create policy hk_rooms_update on public.hk_rooms
  for update to authenticated
  using (public.has_permission(hotel_id, 'housekeeping.update'))
  with check (public.has_permission(hotel_id, 'housekeeping.update') and updated_by = auth.uid());

-- Nessun DELETE. Dal browser si cambiano solo stato e nota; struttura e "attiva" passano da funzioni con manage.
revoke all on public.hk_rooms from anon, authenticated;
grant select on public.hk_rooms to authenticated;
grant insert (hotel_id, room, floor, kind, created_by) on public.hk_rooms to authenticated;
grant update (status, note, updated_by) on public.hk_rooms to authenticated;

create or replace function public.hk_set_room_active(p_room uuid, p_active boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_hotel text;
begin
  select hotel_id into v_hotel from public.hk_rooms where id = p_room;
  if auth.uid() is null or v_hotel is null or not public.has_permission(v_hotel, 'housekeeping.manage') then
    raise exception 'non autorizzato' using errcode = '42501';
  end if;
  update public.hk_rooms set active = p_active, updated_by = auth.uid() where id = p_room;
end;
$$;

-- Nuova giornata: tutte le camere attive tornano "da fare".
create or replace function public.hk_reset_day(p_hotel text)
returns integer
language plpgsql security definer set search_path = public
as $$
declare v_n integer;
begin
  if auth.uid() is null or not public.has_permission(p_hotel, 'housekeeping.manage') then
    raise exception 'non autorizzato' using errcode = '42501';
  end if;
  update public.hk_rooms set status = 'dafare', updated_by = auth.uid()
   where hotel_id = p_hotel and active and status <> 'dafare';
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function public.hk_set_room_active(uuid, boolean) from public, anon;
revoke all on function public.hk_reset_day(text) from public, anon;
grant execute on function public.hk_set_room_active(uuid, boolean) to authenticated;
grant execute on function public.hk_reset_day(text) to authenticated;
