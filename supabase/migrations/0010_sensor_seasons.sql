-- Sensori: ruolo del sensore e stagione Inverno/Estate (come nella vecchia app).
--   ambiente = solo soglie manuali (alert_min / alert_max)
--   motore   = inverno: allerta se SOTTO la soglia invernale; estate: allerta se SOPRA la soglia estiva
--   frigo    = allerta se SOPRA la soglia frigo
-- La stagione e le soglie sono per struttura (tabella sensor_settings), le cambia chi ha sensors.manage.

alter table randapp.sensors
  add column role text not null default 'ambiente' check (role in ('ambiente','motore','frigo'));
grant insert (role) on randapp.sensors to authenticated;
grant update (role) on randapp.sensors to authenticated;

create table randapp.sensor_settings (
  hotel_id    text primary key references randapp.hotels (id),
  season      text not null default 'inverno' check (season in ('inverno','estate')),
  winter_min  numeric(5,2) not null default 20,
  summer_max  numeric(5,2) not null default 18,
  fridge_max  numeric(5,2) not null default 0,
  updated_by  uuid references auth.users (id),
  updated_at  timestamptz not null default now()
);
create trigger sensor_settings_touch before update on randapp.sensor_settings
  for each row execute function randapp.touch_updated_at();

alter table randapp.sensor_settings enable row level security;

create policy sensor_settings_select on randapp.sensor_settings
  for select to authenticated using (randapp.has_permission(hotel_id, 'sensors.view'));
create policy sensor_settings_insert on randapp.sensor_settings
  for insert to authenticated with check (randapp.has_permission(hotel_id, 'sensors.manage'));
create policy sensor_settings_update on randapp.sensor_settings
  for update to authenticated
  using (randapp.has_permission(hotel_id, 'sensors.manage'))
  with check (randapp.has_permission(hotel_id, 'sensors.manage'));

-- Nessun DELETE.
revoke all on randapp.sensor_settings from anon, authenticated;
grant select on randapp.sensor_settings to authenticated;
grant insert (hotel_id, season, winter_min, summer_max, fridge_max, updated_by) on randapp.sensor_settings to authenticated;
grant update (season, winter_min, summer_max, fridge_max, updated_by) on randapp.sensor_settings to authenticated;

-- Una riga di impostazioni (valori della vecchia app) per ogni struttura esistente.
insert into randapp.sensor_settings (hotel_id) select id from randapp.hotels on conflict do nothing;
