-- Ognuno imposta il proprio numero dal Profilo. Il numero non si legge dal browser: lo vede solo chi lo salva, con queste due funzioni.
-- Al salvataggio il trigger profiles_phone_link collega le segnalazioni WhatsApp con lo stesso numero e compare il nome.

create or replace function randapp.get_my_phone()
returns text language sql stable security definer set search_path = randapp, pg_temp as $$
  select phone from randapp.profiles where auth_user_id = auth.uid();
$$;

-- Accetta "340 1234567", "+39 340 1234567", "0039 340…": salva sempre come +39… (se manca il prefisso, Italia). Vuoto = toglie il numero.
create or replace function randapp.set_my_phone(p_phone text)
returns text language plpgsql security definer set search_path = randapp, pg_temp as $$
declare
  v_raw text := regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g');
  v_new text;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'non autorizzato';
  end if;
  if v_raw = '' then
    v_new := null;
  else
    if v_raw like '00%' then v_raw := '+' || substr(v_raw, 3);
    elsif v_raw not like '+%' then v_raw := '+39' || v_raw;
    end if;
    if v_raw !~ '^\+[0-9]{8,15}$' then
      raise exception using errcode = '22023', message = 'Numero non valido';
    end if;
    v_new := v_raw;
  end if;
  if v_new is not null and exists (select 1 from randapp.profiles where phone = v_new and auth_user_id <> auth.uid()) then
    raise exception using errcode = '23505', message = 'Questo numero è già usato da un altro utente';
  end if;
  update randapp.profiles set phone = v_new where auth_user_id = auth.uid();
  return v_new;
end;
$$;

revoke all on function randapp.get_my_phone(), randapp.set_my_phone(text) from public, anon;
grant execute on function randapp.get_my_phone(), randapp.set_my_phone(text) to authenticated;
