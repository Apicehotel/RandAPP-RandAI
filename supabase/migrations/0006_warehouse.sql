-- Magazzino: articoli e movimenti. La quantità cambia SOLO con inventory_move() (carico, scarico, rettifica),
-- così ogni variazione lascia un movimento. Dal browser non si scrive né si cancella la quantità.

insert into public.role_permissions (role, permission) values
  ('admin','warehouse.view'), ('admin','warehouse.create'), ('admin','warehouse.move'), ('admin','warehouse.manage'),
  ('direzione','warehouse.view'), ('direzione','warehouse.create'), ('direzione','warehouse.move'), ('direzione','warehouse.manage'),
  ('responsabile','warehouse.view'), ('responsabile','warehouse.create'), ('responsabile','warehouse.move'), ('responsabile','warehouse.manage'),
  ('manutentore','warehouse.view'), ('manutentore','warehouse.create'), ('manutentore','warehouse.move'),
  ('governante','warehouse.view'), ('governante','warehouse.move'),
  ('reception','warehouse.view')
on conflict do nothing;

create table public.inventory_items (
  id           uuid primary key default gen_random_uuid(),
  hotel_id     text not null references public.hotels (id),
  name         text not null check (char_length(btrim(name)) between 1 and 120),
  category     text check (category is null or char_length(category) <= 60),
  unit         text not null default 'pz' check (char_length(unit) between 1 and 12),
  quantity     numeric(12,3) not null default 0 check (quantity >= 0),
  min_quantity numeric(12,3) not null default 0 check (min_quantity >= 0),
  location     text check (location is null or char_length(location) <= 80),
  notes        text check (notes is null or char_length(notes) <= 500),
  active       boolean not null default true,
  created_by   uuid not null references auth.users (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index inventory_items_name_uq on public.inventory_items (hotel_id, lower(name));
create index inventory_items_hotel_idx on public.inventory_items (hotel_id, active, name);
create trigger inventory_items_touch before update on public.inventory_items
  for each row execute function public.touch_updated_at();

create table public.inventory_movements (
  id             uuid primary key default gen_random_uuid(),
  hotel_id       text not null references public.hotels (id),
  item_id        uuid not null references public.inventory_items (id),
  kind           text not null check (kind in ('carico','scarico','rettifica')),
  delta          numeric(12,3) not null,
  quantity_after numeric(12,3) not null check (quantity_after >= 0),
  note           text check (note is null or char_length(note) <= 300),
  created_by     uuid not null references auth.users (id),
  created_at     timestamptz not null default now()
);
create index inventory_movements_item_idx on public.inventory_movements (hotel_id, item_id, created_at desc);

alter table public.inventory_items     enable row level security;
alter table public.inventory_movements enable row level security;

create policy inventory_items_select on public.inventory_items
  for select to authenticated using (public.has_permission(hotel_id, 'warehouse.view'));
create policy inventory_items_insert on public.inventory_items
  for insert to authenticated
  with check (public.has_permission(hotel_id, 'warehouse.create') and created_by = auth.uid());
create policy inventory_items_update on public.inventory_items
  for update to authenticated
  using (public.has_permission(hotel_id, 'warehouse.manage'))
  with check (public.has_permission(hotel_id, 'warehouse.manage'));
create policy inventory_movements_select on public.inventory_movements
  for select to authenticated using (public.has_permission(hotel_id, 'warehouse.view'));

-- Nessun DELETE. La quantità non è scrivibile dal browser (grant a colonne): solo inventory_move().
revoke all on public.inventory_items, public.inventory_movements from anon, authenticated;
grant select on public.inventory_items, public.inventory_movements to authenticated;
grant insert (hotel_id, name, category, unit, min_quantity, location, notes, created_by)
  on public.inventory_items to authenticated;
grant update (name, category, unit, min_quantity, location, notes, active)
  on public.inventory_items to authenticated;

create or replace function public.inventory_move(p_item uuid, p_kind text, p_amount numeric, p_note text default null)
returns public.inventory_items
language plpgsql security definer set search_path = public
as $$
declare
  v_item  public.inventory_items;
  v_delta numeric;
  v_after numeric;
begin
  if auth.uid() is null then raise exception 'non autorizzato' using errcode = '42501'; end if;
  if p_kind not in ('carico','scarico','rettifica') then raise exception 'tipo movimento non valido'; end if;
  if p_amount is null or p_amount < 0 or (p_kind <> 'rettifica' and p_amount = 0) then
    raise exception 'quantità non valida';
  end if;

  select * into v_item from public.inventory_items where id = p_item for update;
  if not found or not public.has_permission(v_item.hotel_id, 'warehouse.move') then
    raise exception 'non autorizzato' using errcode = '42501';
  end if;

  v_delta := case p_kind when 'carico' then p_amount when 'scarico' then -p_amount else p_amount - v_item.quantity end;
  v_after := v_item.quantity + v_delta;
  if v_after < 0 then raise exception 'giacenza insufficiente'; end if;

  update public.inventory_items set quantity = v_after where id = p_item returning * into v_item;
  insert into public.inventory_movements (hotel_id, item_id, kind, delta, quantity_after, note, created_by)
  values (v_item.hotel_id, p_item, p_kind, v_delta, v_after, nullif(btrim(p_note), ''), auth.uid());
  return v_item;
end;
$$;

revoke all on function public.inventory_move(uuid, text, numeric, text) from public, anon;
grant execute on function public.inventory_move(uuid, text, numeric, text) to authenticated;
