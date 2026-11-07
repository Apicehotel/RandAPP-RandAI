-- Dati personali nel Profilo: username, nome, cognome (con numero WhatsApp ed email già esistenti).
-- display_name NON cambia: è il nome con cui si fa l'accesso e con cui si collegano segnalazioni e dati della vecchia app.
-- I nuovi campi non hanno grant al browser: si leggono e scrivono solo con le funzioni qui sotto, della persona stessa.

alter table randapp.profiles
  add column username   text check (username is null or username ~ '^[a-z0-9][a-z0-9._-]{2,29}$'),
  add column first_name text check (first_name is null or char_length(first_name) between 1 and 60),
  add column last_name  text check (last_name  is null or char_length(last_name)  between 1 and 60);
create unique index profiles_username_uidx on randapp.profiles (username) where username is not null;

-- Anche l'email può stare su più utenti (stessa persona con due ruoli). Il recupero PIN parte dall'utente scelto, non dall'email.
drop index if exists randapp.profiles_email_uidx;
create index if not exists profiles_email_idx on randapp.profiles (email) where email is not null;

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
  update randapp.profiles set email = v where auth_user_id = auth.uid();
  return v;
end;
$$;

create or replace function randapp.get_my_profile()
returns table (display_name text, username text, first_name text, last_name text)
language sql stable security definer set search_path = randapp, pg_temp as $$
  select p.display_name, p.username, p.first_name, p.last_name
    from randapp.profiles p where p.auth_user_id = auth.uid();
$$;

-- Vuoto = toglie il campo. Lo username è in minuscolo, 3-30 caratteri (lettere, numeri, . _ -), unico.
create or replace function randapp.set_my_profile(p_username text, p_first_name text, p_last_name text)
returns table (display_name text, username text, first_name text, last_name text)
language plpgsql security definer set search_path = randapp, pg_temp as $$
declare
  v_user  text := nullif(lower(trim(coalesce(p_username, ''))), '');
  v_first text := nullif(regexp_replace(trim(coalesce(p_first_name, '')), '\s+', ' ', 'g'), '');
  v_last  text := nullif(regexp_replace(trim(coalesce(p_last_name, '')), '\s+', ' ', 'g'), '');
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'non autorizzato';
  end if;
  if v_user is not null and v_user !~ '^[a-z0-9][a-z0-9._-]{2,29}$' then
    raise exception using errcode = '22023', message = 'Username non valido: 3-30 caratteri tra lettere, numeri, punto, trattino';
  end if;
  if char_length(coalesce(v_first, '')) > 60 or char_length(coalesce(v_last, '')) > 60 then
    raise exception using errcode = '22023', message = 'Nome o cognome troppo lungo';
  end if;
  if v_user is not null and exists (select 1 from randapp.profiles x where x.username = v_user and x.auth_user_id <> auth.uid()) then
    raise exception using errcode = '23505', message = 'Questo username è già usato';
  end if;
  update randapp.profiles p set username = v_user, first_name = v_first, last_name = v_last where p.auth_user_id = auth.uid();
  return query select p.display_name, p.username, p.first_name, p.last_name from randapp.profiles p where p.auth_user_id = auth.uid();
end;
$$;

revoke all on function randapp.get_my_profile(), randapp.set_my_profile(text, text, text) from public, anon;
grant execute on function randapp.get_my_profile(), randapp.set_my_profile(text, text, text) to authenticated;

-- Sulle segnalazioni WhatsApp compare "Nome Cognome" (se la persona li ha messi) al posto del numero; altrimenti il nome di accesso.
-- Il collegamento riparte anche quando cambiano nome o cognome.
create or replace function randapp.link_issue_senders()
returns integer language plpgsql security definer set search_path = randapp, pg_temp as $$
declare n integer;
begin
  update randapp.issues i
     set created_by      = p.auth_user_id,
         created_by_name = coalesce(p.shown_name, 'WhatsApp ' || i.created_by_phone)
    from (select distinct on (i2.id) i2.id, pr.auth_user_id,
                 coalesce(nullif(btrim(concat_ws(' ', pr.first_name, pr.last_name)), ''), pr.display_name) as shown_name
            from randapp.issues i2
            left join randapp.profiles pr on pr.phone = i2.created_by_phone and pr.active
           where i2.source = 'whatsapp' and i2.created_by_phone is not null
           order by i2.id, pr.created_at nulls last, pr.auth_user_id) p
   where i.id = p.id
     and (i.created_by is distinct from p.auth_user_id
          or i.created_by_name is distinct from coalesce(p.shown_name, 'WhatsApp ' || i.created_by_phone));
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function randapp.link_issue_senders() from public, anon, authenticated;

drop trigger if exists profiles_phone_link on randapp.profiles;
create trigger profiles_phone_link after insert or update of phone, display_name, first_name, last_name, active on randapp.profiles
  for each row execute function randapp.trg_profile_phone_link();
