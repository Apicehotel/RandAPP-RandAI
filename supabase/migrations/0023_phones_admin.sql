-- Schermata admin "Numeri WhatsApp": quali numeri hanno scritto, a chi sono collegati, chi non ha ancora il numero.
-- Solo con permesso admin.access (RPC, il numero non è mai leggibile con una select dal browser).

-- Persone della struttura e numero (anche vuoto) + numeri WhatsApp che hanno scritto e non sono collegati a nessuno.
create or replace function randapp.admin_phone_overview(p_hotel text)
returns table (kind text, auth_user_id uuid, name text, role text, phone text, issues bigint, last_at timestamptz)
language plpgsql stable security definer set search_path = randapp, pg_temp as $$
begin
  if not randapp.has_permission(p_hotel, 'admin.access') then
    raise exception using errcode = '42501', message = 'non autorizzato';
  end if;
  return query
    select 'persona'::text, p.auth_user_id, p.display_name, m.role, p.phone,
           (select count(*) from randapp.issues i where i.hotel_id = p_hotel and i.created_by_phone is not null and i.created_by_phone = p.phone),
           (select max(i.created_at) from randapp.issues i where i.hotel_id = p_hotel and i.created_by_phone is not null and i.created_by_phone = p.phone)
      from randapp.hotel_memberships m join randapp.profiles p on p.auth_user_id = m.auth_user_id
     where m.hotel_id = p_hotel and m.active and p.active
    union all
    select 'numero'::text, null::uuid, null::text, null::text, i.created_by_phone, count(*), max(i.created_at)
      from randapp.issues i
     where i.hotel_id = p_hotel and i.source = 'whatsapp' and i.created_by_phone is not null
       and not exists (select 1 from randapp.profiles pr where pr.phone = i.created_by_phone)
     group by i.created_by_phone;
end;
$$;

-- L'admin assegna (o toglie) il numero a una persona della sua struttura. Stesse regole di normalizzazione di set_my_phone.
create or replace function randapp.admin_set_phone(p_hotel text, p_user uuid, p_phone text)
returns text language plpgsql security definer set search_path = randapp, pg_temp as $$
declare
  v_raw text := regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g');
  v_new text;
begin
  if not randapp.has_permission(p_hotel, 'admin.access') then
    raise exception using errcode = '42501', message = 'non autorizzato';
  end if;
  if not exists (select 1 from randapp.hotel_memberships where hotel_id = p_hotel and auth_user_id = p_user and active) then
    raise exception using errcode = '22023', message = 'Persona non trovata in questa struttura';
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
  if v_new is not null and exists (select 1 from randapp.profiles where phone = v_new and auth_user_id <> p_user) then
    raise exception using errcode = '23505', message = 'Questo numero è già usato da un altro utente';
  end if;
  update randapp.profiles set phone = v_new where auth_user_id = p_user;
  return v_new;
end;
$$;

revoke all on function randapp.admin_phone_overview(text), randapp.admin_set_phone(text, uuid, text) from public, anon;
grant execute on function randapp.admin_phone_overview(text), randapp.admin_set_phone(text, uuid, text) to authenticated;
