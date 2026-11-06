-- Lo stesso numero WhatsApp può stare su più utenti (es. sviluppatore e manutentore sono la stessa persona).
-- 1) l'indice sul numero resta (serve alle ricerche) ma non è più unico;
-- 2) set_my_phone e admin_set_phone non rifiutano più un numero già usato;
-- 3) le segnalazioni WhatsApp di quel numero vanno al profilo attivo più vecchio (scelta fissa, niente casualità).

drop index if exists randapp.profiles_phone_uidx;
create index if not exists profiles_phone_idx on randapp.profiles (phone) where phone is not null;

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
  update randapp.profiles set phone = v_new where auth_user_id = auth.uid();
  return v_new;
end;
$$;

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
  update randapp.profiles set phone = v_new where auth_user_id = p_user;
  return v_new;
end;
$$;

create or replace function randapp.link_issue_senders()
returns integer language plpgsql security definer set search_path = randapp, pg_temp as $$
declare n integer;
begin
  update randapp.issues i
     set created_by      = p.auth_user_id,
         created_by_name = coalesce(p.display_name, 'WhatsApp ' || i.created_by_phone)
    from (select distinct on (i2.id) i2.id, pr.auth_user_id, pr.display_name
            from randapp.issues i2
            left join randapp.profiles pr on pr.phone = i2.created_by_phone and pr.active
           where i2.source = 'whatsapp' and i2.created_by_phone is not null
           order by i2.id, pr.created_at nulls last, pr.auth_user_id) p
   where i.id = p.id
     and (i.created_by is distinct from p.auth_user_id
          or i.created_by_name is distinct from coalesce(p.display_name, 'WhatsApp ' || i.created_by_phone));
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function randapp.link_issue_senders() from public, anon, authenticated;
