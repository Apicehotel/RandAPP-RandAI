-- Rifornimento: la governante chiede prodotti (minibar / consumo), il manutentore li consegna o li segna mancanti.
-- Richieste e righe si scrivono solo con le funzioni del server; il catalogo prodotti lo gestisce chi ha supplies.manage.

insert into randapp.role_permissions (role, permission) values
  ('admin','supplies.view'), ('admin','supplies.create'), ('admin','supplies.complete'), ('admin','supplies.manage'),
  ('direzione','supplies.view'), ('direzione','supplies.create'), ('direzione','supplies.complete'), ('direzione','supplies.manage'),
  ('responsabile','supplies.view'), ('responsabile','supplies.create'), ('responsabile','supplies.complete'), ('responsabile','supplies.manage'),
  ('manutentore','supplies.view'), ('manutentore','supplies.complete'),
  ('governante','supplies.view'), ('governante','supplies.create'),
  ('reception','supplies.view')
on conflict do nothing;

create table randapp.supply_products (
  id         uuid primary key default gen_random_uuid(),
  hotel_id   text not null references randapp.hotels (id),
  category   text not null check (category in ('minibar','consumo')),
  name       text not null check (char_length(btrim(name)) between 1 and 120),
  active     boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hotel_id, id)
);
create unique index supply_products_name_uq on randapp.supply_products (hotel_id, lower(name));
create index supply_products_hotel_idx on randapp.supply_products (hotel_id, active, category, sort_order, name);
create trigger supply_products_touch before update on randapp.supply_products
  for each row execute function randapp.touch_updated_at();

create table randapp.supply_requests (
  id                uuid primary key default gen_random_uuid(),
  hotel_id          text not null references randapp.hotels (id),
  requested_by      uuid not null references auth.users (id),
  requested_by_name text not null default 'Governante',
  note              text check (note is null or char_length(note) <= 300),
  created_at        timestamptz not null default now(),
  completed_at      timestamptz,
  unique (hotel_id, id)
);
create index supply_requests_hotel_idx on randapp.supply_requests (hotel_id, created_at desc);

create table randapp.supply_request_items (
  id               uuid primary key default gen_random_uuid(),
  hotel_id         text not null,
  request_id       uuid not null,
  product_id       uuid not null,
  product_name     text not null,
  category         text not null check (category in ('minibar','consumo')),
  status           text not null default 'pending' check (status in ('pending','delivered','missing')),
  resolved_by      uuid references auth.users (id),
  resolved_by_name text,
  resolved_at      timestamptz,
  created_at       timestamptz not null default now(),
  foreign key (hotel_id, request_id) references randapp.supply_requests (hotel_id, id) on delete cascade,
  foreign key (hotel_id, product_id) references randapp.supply_products (hotel_id, id),
  unique (request_id, product_id)
);
create index supply_request_items_idx on randapp.supply_request_items (hotel_id, status, created_at desc);

alter table randapp.supply_products      enable row level security;
alter table randapp.supply_requests      enable row level security;
alter table randapp.supply_request_items enable row level security;

create policy supply_products_select on randapp.supply_products
  for select to authenticated using (randapp.has_permission(hotel_id, 'supplies.view'));
create policy supply_products_insert on randapp.supply_products
  for insert to authenticated
  with check (randapp.has_permission(hotel_id, 'supplies.manage') and created_by = auth.uid());
create policy supply_products_update on randapp.supply_products
  for update to authenticated
  using (randapp.has_permission(hotel_id, 'supplies.manage'))
  with check (randapp.has_permission(hotel_id, 'supplies.manage'));
create policy supply_requests_select on randapp.supply_requests
  for select to authenticated using (randapp.has_permission(hotel_id, 'supplies.view'));
create policy supply_request_items_select on randapp.supply_request_items
  for select to authenticated using (randapp.has_permission(hotel_id, 'supplies.view'));

-- Nessun DELETE. Richieste e righe: solo lettura dal browser.
revoke all on randapp.supply_products, randapp.supply_requests, randapp.supply_request_items from anon, authenticated;
grant select on randapp.supply_products, randapp.supply_requests, randapp.supply_request_items to authenticated;
grant insert (hotel_id, category, name, sort_order, created_by) on randapp.supply_products to authenticated;
grant update (category, name, active, sort_order) on randapp.supply_products to authenticated;

create or replace function randapp.supply_create_request(p_hotel text, p_product_ids uuid[], p_note text default null)
returns uuid
language plpgsql security definer set search_path = randapp
as $$
declare
  v_request uuid;
  v_name    text;
  v_wanted  int;
  v_found   int;
begin
  if auth.uid() is null or not randapp.has_permission(p_hotel, 'supplies.create') then
    raise exception 'non autorizzato' using errcode = '42501';
  end if;
  select count(distinct x) into v_wanted from unnest(coalesce(p_product_ids, '{}')) x;
  if v_wanted = 0 then raise exception 'scegli almeno un prodotto'; end if;
  select count(*) into v_found from randapp.supply_products
   where hotel_id = p_hotel and active and id in (select distinct x from unnest(p_product_ids) x);
  if v_found <> v_wanted then raise exception 'prodotto non valido'; end if;

  select display_name into v_name from randapp.profiles where auth_user_id = auth.uid();
  insert into randapp.supply_requests (hotel_id, requested_by, requested_by_name, note)
  values (p_hotel, auth.uid(), coalesce(v_name, 'Governante'), nullif(btrim(p_note), ''))
  returning id into v_request;

  insert into randapp.supply_request_items (hotel_id, request_id, product_id, product_name, category)
  select p_hotel, v_request, p.id, p.name, p.category from randapp.supply_products p
   where p.hotel_id = p_hotel and p.active and p.id in (select distinct x from unnest(p_product_ids) x);
  return v_request;
end;
$$;

create or replace function randapp.supply_resolve_item(p_item uuid, p_status text)
returns void
language plpgsql security definer set search_path = randapp
as $$
declare
  v_hotel   text;
  v_request uuid;
  v_name    text;
begin
  if auth.uid() is null then raise exception 'non autorizzato' using errcode = '42501'; end if;
  if p_status not in ('delivered','missing') then raise exception 'stato non valido'; end if;
  select hotel_id, request_id into v_hotel, v_request from randapp.supply_request_items where id = p_item for update;
  if v_hotel is null or not randapp.has_permission(v_hotel, 'supplies.complete') then
    raise exception 'non autorizzato' using errcode = '42501';
  end if;
  select display_name into v_name from randapp.profiles where auth_user_id = auth.uid();
  update randapp.supply_request_items
     set status = p_status, resolved_by = auth.uid(), resolved_by_name = coalesce(v_name, 'Manutentore'), resolved_at = now()
   where id = p_item;
  update randapp.supply_requests r
     set completed_at = case
       when exists (select 1 from randapp.supply_request_items i where i.request_id = v_request and i.status = 'pending') then null
       else coalesce(r.completed_at, now()) end
   where r.id = v_request;
end;
$$;

revoke all on function randapp.supply_create_request(text, uuid[], text) from public, anon;
revoke all on function randapp.supply_resolve_item(uuid, text) from public, anon;
grant execute on function randapp.supply_create_request(text, uuid[], text) to authenticated;
grant execute on function randapp.supply_resolve_item(uuid, text) to authenticated;
