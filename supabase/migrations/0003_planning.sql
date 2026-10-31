-- Planning: lavori per giorno (Planning Lavori) e prenotazioni sale (Planning Sale).

insert into public.role_permissions (role, permission) values
  ('admin','planning_work.view'), ('admin','planning_work.create'), ('admin','planning_work.update'),
  ('admin','planning_sale.view'), ('admin','planning_sale.create'), ('admin','planning_sale.update'),
  ('direzione','planning_work.view'), ('direzione','planning_work.create'), ('direzione','planning_work.update'),
  ('direzione','planning_sale.view'), ('direzione','planning_sale.create'), ('direzione','planning_sale.update'),
  ('responsabile','planning_work.view'), ('responsabile','planning_work.create'), ('responsabile','planning_work.update'),
  ('responsabile','planning_sale.view'), ('responsabile','planning_sale.create'), ('responsabile','planning_sale.update'),
  ('manutentore','planning_work.view'), ('manutentore','planning_work.create'), ('manutentore','planning_work.update'),
  ('manutentore','planning_sale.view'),
  ('governante','planning_work.view'), ('governante','planning_sale.view'),
  ('reception','planning_work.view'),
  ('reception','planning_sale.view'), ('reception','planning_sale.create'), ('reception','planning_sale.update')
on conflict do nothing;

-- ---------------------------------------------------------------- Planning Lavori
create table public.planning_works (
  id           uuid primary key default gen_random_uuid(),
  hotel_id     text not null references public.hotels (id),
  description  text not null check (char_length(description) between 1 and 200),
  days         date[] not null check (cardinality(days) between 1 and 31),
  status       text not null default 'da_fare' check (status in ('da_fare','fatto')),
  created_by   uuid not null references auth.users (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  completed_at timestamptz
);
create index planning_works_hotel_idx on public.planning_works (hotel_id, created_at);
create trigger planning_works_touch before update on public.planning_works
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- Planning Sale
create table public.sale_bookings (
  id           uuid primary key default gen_random_uuid(),
  hotel_id     text not null references public.hotels (id),
  room         text not null check (char_length(room) between 1 and 60),
  client       text not null check (char_length(client) between 1 and 80),
  date_from    date not null,
  date_to      date not null,
  shift        text not null check (shift in ('mattina','pomeriggio','sera','giornata')),
  pax          integer check (pax is null or pax between 1 and 5000),
  notes        text check (notes is null or char_length(notes) <= 2000),
  status       text not null default 'attiva' check (status in ('attiva','annullata')),
  created_by   uuid not null references auth.users (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (date_to >= date_from)
);
create index sale_bookings_hotel_idx on public.sale_bookings (hotel_id, date_to, date_from);
create trigger sale_bookings_touch before update on public.sale_bookings
  for each row execute function public.touch_updated_at();

alter table public.planning_works enable row level security;
alter table public.sale_bookings  enable row level security;

create policy planning_works_select on public.planning_works
  for select to authenticated using (public.has_permission(hotel_id, 'planning_work.view'));
create policy planning_works_insert on public.planning_works
  for insert to authenticated
  with check (public.has_permission(hotel_id, 'planning_work.create') and created_by = auth.uid());
create policy planning_works_update on public.planning_works
  for update to authenticated
  using (public.has_permission(hotel_id, 'planning_work.update'))
  with check (public.has_permission(hotel_id, 'planning_work.update'));

create policy sale_bookings_select on public.sale_bookings
  for select to authenticated using (public.has_permission(hotel_id, 'planning_sale.view'));
create policy sale_bookings_insert on public.sale_bookings
  for insert to authenticated
  with check (public.has_permission(hotel_id, 'planning_sale.create') and created_by = auth.uid());
create policy sale_bookings_update on public.sale_bookings
  for update to authenticated
  using (public.has_permission(hotel_id, 'planning_sale.update'))
  with check (public.has_permission(hotel_id, 'planning_sale.update'));

-- Nessuna policy di DELETE: lavori e prenotazioni non si cancellano dal browser (le prenotazioni si annullano).

revoke all on public.planning_works, public.sale_bookings from anon;
grant select, insert, update on public.planning_works, public.sale_bookings to authenticated;
