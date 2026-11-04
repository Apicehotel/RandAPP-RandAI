-- Sensori e relay: temperatura/umidità e stato degli interruttori (impianti).
-- Le misure (temperatura, umidità, relay, online, ultimo aggiornamento) le scriverà un servizio di sincronizzazione
-- col service role (eWeLink): non ancora attivo. Dal browser si gestisce solo l'anagrafica dei sensori.

insert into randapp.role_permissions (role, permission) values
  ('admin','sensors.view'), ('admin','sensors.manage'),
  ('direzione','sensors.view'), ('direzione','sensors.manage'),
  ('responsabile','sensors.view'), ('responsabile','sensors.manage'),
  ('manutentore','sensors.view'), ('manutentore','sensors.manage'),
  ('governante','sensors.view'),
  ('reception','sensors.view')
on conflict do nothing;

create table randapp.sensors (
  id           uuid primary key default gen_random_uuid(),
  hotel_id     text not null references randapp.hotels (id),
  device_key   text not null check (char_length(btrim(device_key)) between 1 and 80),
  name         text not null check (char_length(btrim(name)) between 1 and 80),
  kind         text not null default 'temperatura' check (kind in ('temperatura','relay')),
  temperature  numeric(5,2),
  humidity     numeric(5,2) check (humidity is null or humidity between 0 and 100),
  switch_state text check (switch_state is null or switch_state in ('on','off','mixed')),
  online       boolean not null default false,
  alert_min    numeric(5,2),
  alert_max    numeric(5,2),
  last_seen    timestamptz,
  sort_order   integer not null default 0,
  active       boolean not null default true,
  created_by   uuid not null references auth.users (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (hotel_id, device_key),
  check (alert_min is null or alert_max is null or alert_min <= alert_max)
);
create index sensors_hotel_idx on randapp.sensors (hotel_id, active, sort_order, name);
create trigger sensors_touch before update on randapp.sensors
  for each row execute function randapp.touch_updated_at();

alter table randapp.sensors enable row level security;

create policy sensors_select on randapp.sensors
  for select to authenticated using (randapp.has_permission(hotel_id, 'sensors.view'));
create policy sensors_insert on randapp.sensors
  for insert to authenticated
  with check (randapp.has_permission(hotel_id, 'sensors.manage') and created_by = auth.uid());
create policy sensors_update on randapp.sensors
  for update to authenticated
  using (randapp.has_permission(hotel_id, 'sensors.manage'))
  with check (randapp.has_permission(hotel_id, 'sensors.manage'));

-- Nessun DELETE. Le misure non sono scrivibili dal browser (grant a colonne).
revoke all on randapp.sensors from anon, authenticated;
grant select on randapp.sensors to authenticated;
grant insert (hotel_id, device_key, name, kind, alert_min, alert_max, sort_order, created_by) on randapp.sensors to authenticated;
grant update (name, kind, alert_min, alert_max, sort_order, active) on randapp.sensors to authenticated;
