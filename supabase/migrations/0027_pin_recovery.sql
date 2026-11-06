-- Recupero PIN via email. Ognuno salva la propria email dal Profilo (o dalla scheda in Home); "PIN dimenticato?" nel login
-- manda un link valido 15 minuti, una sola volta. L'email non si legge dal browser (solo get_my_email/set_my_email, della persona stessa).
-- Le richieste di recupero stanno in tabelle solo-server (nessun grant al browser): nel database c'è solo l'hash del link, mai il link.

alter table randapp.profiles add column email text
  check (email is null or (char_length(email) <= 120 and email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$'));
create unique index profiles_email_uidx on randapp.profiles (email) where email is not null;

create or replace function randapp.get_my_email()
returns text language sql stable security definer set search_path = randapp, pg_temp as $$
  select email from randapp.profiles where auth_user_id = auth.uid();
$$;

create or replace function randapp.set_my_email(p_email text)
returns text language plpgsql security definer set search_path = randapp, pg_temp as $$
declare v text := lower(trim(coalesce(p_email, '')));
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'non autorizzato';
  end if;
  if v = '' then
    update randapp.profiles set email = null where auth_user_id = auth.uid();
    return null;
  end if;
  if char_length(v) > 120 or v !~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' then
    raise exception using errcode = '22023', message = 'Email non valida';
  end if;
  if exists (select 1 from randapp.profiles where email = v and auth_user_id <> auth.uid()) then
    raise exception using errcode = '23505', message = 'Questa email è già usata da un altro utente';
  end if;
  update randapp.profiles set email = v where auth_user_id = auth.uid();
  return v;
end;
$$;

create table randapp.pin_recovery_requests (
  id           uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users (id) on delete cascade,
  token_hash   text not null unique,
  expires_at   timestamptz not null,
  used_at      timestamptz,
  created_at   timestamptz not null default now()
);
create index pin_recovery_user_idx on randapp.pin_recovery_requests (auth_user_id, created_at desc);
alter table randapp.pin_recovery_requests enable row level security;
revoke all on randapp.pin_recovery_requests from anon, authenticated;

-- Limite di richieste per origine (hash di IP) e per persona: solo server.
create table randapp.pin_recovery_limits (
  key        text primary key,
  count      integer not null default 0,
  window_at  timestamptz not null default now()
);
alter table randapp.pin_recovery_limits enable row level security;
revoke all on randapp.pin_recovery_limits from anon, authenticated;

revoke all on function randapp.get_my_email(), randapp.set_my_email(text) from public, anon;
grant execute on function randapp.get_my_email(), randapp.set_my_email(text) to authenticated;
