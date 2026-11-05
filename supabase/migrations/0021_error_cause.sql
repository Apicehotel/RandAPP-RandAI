-- Ogni errore dice di chi è la causa (app, utente, dispositivo) e cosa fare.
alter table randapp.app_errors
  add column cause text check (cause is null or cause in ('app','utente','dispositivo')),
  add column hint  text check (hint is null or char_length(hint) <= 200);

-- La versione precedente (7 parametri) non si cancella: si rinomina e si chiude agli utenti.
alter function randapp.log_client_error(text, text, text, text, text, text, text) rename to log_client_error_v1;
revoke execute on function randapp.log_client_error_v1(text, text, text, text, text, text, text) from anon, authenticated;

create or replace function randapp.log_client_error(
  p_kind text, p_message text, p_detail text default null, p_route text default null,
  p_version text default null, p_device text default null, p_hotel text default null,
  p_cause text default null, p_hint text default null)
returns void language plpgsql security definer set search_path = randapp, pg_temp as $$
begin
  if coalesce(trim(p_kind), '') = '' or coalesce(trim(p_message), '') = '' then return; end if;
  if (select count(*) from randapp.app_errors where at > now() - interval '1 minute') >= 60 then return; end if;
  insert into randapp.app_errors (hotel_id, user_id, kind, message, detail, route, app_version, device, cause, hint)
  values ((select id from randapp.hotels where id = p_hotel),
          auth.uid(),
          left(trim(p_kind), 30), left(trim(p_message), 500), left(p_detail, 2000),
          left(p_route, 120), left(p_version, 30), left(p_device, 200),
          case when p_cause in ('app','utente','dispositivo') then p_cause end, left(p_hint, 200));
end;
$$;
revoke all on function randapp.log_client_error(text, text, text, text, text, text, text, text, text) from public;
grant execute on function randapp.log_client_error(text, text, text, text, text, text, text, text, text) to anon, authenticated;
