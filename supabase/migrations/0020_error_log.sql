-- Registro errori dell'app. L'app (anche prima del login) manda qui cosa non va: tipo, messaggio, dettaglio, schermata, dispositivo.
-- Si scrive SOLO con log_client_error() (tronca i testi, limita a 60 righe al minuto, controlla la struttura).
-- Si legge solo da chi è admin in almeno una struttura. Nessun dato personale: niente PIN, token o chiavi (l'app li toglie prima di inviare).
-- Le righe più vecchie di 30 giorni si cancellano ogni notte (job pg_cron).

create table randapp.app_errors (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  hotel_id    text references randapp.hotels (id),
  user_id     uuid,
  kind        text not null check (char_length(kind) between 1 and 30),
  message     text not null check (char_length(message) <= 500),
  detail      text check (detail is null or char_length(detail) <= 2000),
  route       text check (route is null or char_length(route) <= 120),
  app_version text check (app_version is null or char_length(app_version) <= 30),
  device      text check (device is null or char_length(device) <= 200)
);
create index app_errors_at_idx on randapp.app_errors (at desc);

alter table randapp.app_errors enable row level security;
create policy app_errors_select on randapp.app_errors
  for select to authenticated using (
    exists (select 1 from randapp.hotel_memberships m
             where m.auth_user_id = auth.uid() and m.active and m.role = 'admin'));
revoke all on randapp.app_errors from anon;
revoke all on randapp.app_errors from authenticated;
grant select on randapp.app_errors to authenticated;

create or replace function randapp.log_client_error(
  p_kind text, p_message text, p_detail text default null, p_route text default null,
  p_version text default null, p_device text default null, p_hotel text default null)
returns void language plpgsql security definer set search_path = randapp, pg_temp as $$
begin
  if coalesce(trim(p_kind), '') = '' or coalesce(trim(p_message), '') = '' then return; end if;
  if (select count(*) from randapp.app_errors where at > now() - interval '1 minute') >= 60 then return; end if;
  insert into randapp.app_errors (hotel_id, user_id, kind, message, detail, route, app_version, device)
  values ((select id from randapp.hotels where id = p_hotel),
          auth.uid(),
          left(trim(p_kind), 30), left(trim(p_message), 500), left(p_detail, 2000),
          left(p_route, 120), left(p_version, 30), left(p_device, 200));
end;
$$;
revoke all on function randapp.log_client_error(text, text, text, text, text, text, text) from public;
grant execute on function randapp.log_client_error(text, text, text, text, text, text, text) to anon, authenticated;
