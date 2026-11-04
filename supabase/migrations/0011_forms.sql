-- Moduli di inserimento migliorati: luoghi per struttura, assegnatari, più camere,
-- sale/clienti/allestimenti, giorno di preparazione.
-- Tutte le tabelle nuove: hotel_id + RLS; nessuna policy di DELETE.

-- ---------------------------------------------------------------- permessi nuovi
insert into randapp.role_permissions (role, permission) values
  ('admin','planning_sale.manage'), ('direzione','planning_sale.manage'), ('responsabile','planning_sale.manage'),
  ('admin','locations.manage'),     ('direzione','locations.manage'),     ('responsabile','locations.manage')
on conflict do nothing;

-- ---------------------------------------------------------------- luoghi (camere e zone)
create table randapp.hotel_locations (
  id         uuid primary key default gen_random_uuid(),
  hotel_id   text not null references randapp.hotels (id),
  kind       text not null check (kind in ('room','zone')),
  name       text not null check (char_length(name) between 1 and 40),
  group_name text check (group_name is null or char_length(group_name) <= 40),
  aliases    text[] not null default '{}' check (cardinality(aliases) <= 12),
  sort_order integer not null default 0,
  active     boolean not null default true,
  unique (hotel_id, kind, name)
);
create index hotel_locations_hotel_idx on randapp.hotel_locations (hotel_id, kind, sort_order);

alter table randapp.hotel_locations enable row level security;
create policy hotel_locations_select on randapp.hotel_locations
  for select to authenticated using (randapp.is_hotel_member(hotel_id));
create policy hotel_locations_insert on randapp.hotel_locations
  for insert to authenticated with check (randapp.has_permission(hotel_id, 'locations.manage'));
create policy hotel_locations_update on randapp.hotel_locations
  for update to authenticated
  using (randapp.has_permission(hotel_id, 'locations.manage'))
  with check (randapp.has_permission(hotel_id, 'locations.manage'));
revoke all on randapp.hotel_locations from anon;
grant select, insert, update on randapp.hotel_locations to authenticated;

-- ---------------------------------------------------------------- persone assegnabili
-- Il browser non può leggere i profili degli altri: questa funzione restituisce solo
-- nome e ruolo dei colleghi attivi della STESSA struttura, e solo a chi ne fa parte.
create or replace function randapp.hotel_staff(p_hotel text)
returns table (user_id uuid, display_name text, role text)
language sql stable security definer set search_path = randapp
as $$
  select m.auth_user_id, p.display_name, m.role
  from randapp.hotel_memberships m
  join randapp.profiles p on p.auth_user_id = m.auth_user_id
  where m.hotel_id = p_hotel and m.active and p.active
    and randapp.is_hotel_member(p_hotel)
  order by p.display_name;
$$;
revoke all on function randapp.hotel_staff(text) from public, anon;
grant execute on function randapp.hotel_staff(text) to authenticated;

-- ---------------------------------------------------------------- interventi
alter table randapp.interventions
  add column category        text check (category is null or char_length(category) <= 40),
  add column scheduled_until timestamptz,
  add column rooms           text[] not null default '{}' check (cardinality(rooms) <= 60),
  add column assignee_ids    uuid[] not null default '{}' check (cardinality(assignee_ids) <= 20),
  add constraint interventions_range_ok check (scheduled_until is null or scheduled_at is null or scheduled_until >= scheduled_at);

-- ---------------------------------------------------------------- planning lavori
alter table randapp.planning_works
  add column category     text check (category is null or char_length(category) <= 40),
  add column assignee_ids uuid[] not null default '{}' check (cardinality(assignee_ids) <= 20);

-- ---------------------------------------------------------------- planning sale
create table randapp.sale_rooms (
  id         uuid primary key default gen_random_uuid(),
  hotel_id   text not null references randapp.hotels (id),
  name       text not null check (char_length(name) between 1 and 60),
  capacity   integer check (capacity is null or capacity between 1 and 5000),
  sort_order integer not null default 0,
  active     boolean not null default true,
  unique (hotel_id, name)
);
create table randapp.sale_layouts (
  id         uuid primary key default gen_random_uuid(),
  hotel_id   text not null references randapp.hotels (id),
  name       text not null check (char_length(name) between 1 and 60),
  sort_order integer not null default 0,
  unique (hotel_id, name)
);
create table randapp.sale_clients (
  id               uuid primary key default gen_random_uuid(),
  hotel_id         text not null references randapp.hotels (id),
  name             text not null check (char_length(name) between 1 and 80),
  preferred_room   text check (preferred_room is null or char_length(preferred_room) <= 60),
  preferred_layout text check (preferred_layout is null or char_length(preferred_layout) <= 60),
  preferred_pax    integer check (preferred_pax is null or preferred_pax between 1 and 5000),
  notes            text check (notes is null or char_length(notes) <= 2000),
  updated_at       timestamptz not null default now(),
  unique (hotel_id, name)
);
create trigger sale_clients_touch before update on randapp.sale_clients
  for each row execute function randapp.touch_updated_at();

alter table randapp.sale_bookings
  add column layout         text check (layout is null or char_length(layout) <= 60),
  add column prep_date      date,
  add column audio_required boolean not null default false,
  add column video_required boolean not null default false,
  add constraint sale_bookings_prep_ok check (prep_date is null or prep_date <= date_from);

alter table randapp.sale_rooms   enable row level security;
alter table randapp.sale_layouts enable row level security;
alter table randapp.sale_clients enable row level security;

create policy sale_rooms_select on randapp.sale_rooms
  for select to authenticated using (randapp.has_permission(hotel_id, 'planning_sale.view'));
create policy sale_rooms_insert on randapp.sale_rooms
  for insert to authenticated with check (randapp.has_permission(hotel_id, 'planning_sale.manage'));
create policy sale_rooms_update on randapp.sale_rooms
  for update to authenticated
  using (randapp.has_permission(hotel_id, 'planning_sale.manage'))
  with check (randapp.has_permission(hotel_id, 'planning_sale.manage'));

create policy sale_layouts_select on randapp.sale_layouts
  for select to authenticated using (randapp.has_permission(hotel_id, 'planning_sale.view'));
create policy sale_layouts_insert on randapp.sale_layouts
  for insert to authenticated with check (randapp.has_permission(hotel_id, 'planning_sale.create'));

create policy sale_clients_select on randapp.sale_clients
  for select to authenticated using (randapp.has_permission(hotel_id, 'planning_sale.view'));
create policy sale_clients_insert on randapp.sale_clients
  for insert to authenticated with check (randapp.has_permission(hotel_id, 'planning_sale.create'));
create policy sale_clients_update on randapp.sale_clients
  for update to authenticated
  using (randapp.has_permission(hotel_id, 'planning_sale.create'))
  with check (randapp.has_permission(hotel_id, 'planning_sale.create'));

revoke all on randapp.sale_rooms, randapp.sale_layouts, randapp.sale_clients from anon;
grant select, insert, update on randapp.sale_rooms to authenticated;
grant select, insert on randapp.sale_layouts to authenticated;
grant select, insert, update on randapp.sale_clients to authenticated;
