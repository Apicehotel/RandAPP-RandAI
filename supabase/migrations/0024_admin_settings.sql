-- Impostazioni admin (come la vecchia app): Utenti, Ruoli, Notifiche, Consumi.
-- Tutte le funzioni sono SECURITY DEFINER, controllano il permesso admin.access della struttura e non espongono mai PIN o hash.
-- Creare un utente e cambiare un PIN richiedono l'Auth admin API: lo fa la funzione "randapp-admin" (dopo gli stessi controlli).

create or replace function randapp.admin_users_list(p_hotel text)
returns table (auth_user_id uuid, name text, role text, active boolean, phone text, locked boolean, must_change_pin boolean, created_at timestamptz)
language plpgsql stable security definer set search_path = randapp, pg_temp as $$
begin
  if not randapp.has_permission(p_hotel, 'admin.access') then
    raise exception using errcode = '42501', message = 'non autorizzato';
  end if;
  return query
    select p.auth_user_id, p.display_name, m.role, (m.active and p.active), p.phone,
           coalesce(c.locked_until > now(), false), coalesce(c.must_change_pin, false), p.created_at
      from randapp.hotel_memberships m
      join randapp.profiles p on p.auth_user_id = m.auth_user_id
      left join randapp.auth_pin_credentials c on c.auth_user_id = m.auth_user_id
     where m.hotel_id = p_hotel
     order by (m.active and p.active) desc, p.display_name;
end;
$$;

-- Nome, ruolo, attivo/disattivo. Non ci si può togliere da soli l'accesso admin né disattivarsi.
create or replace function randapp.admin_user_update(p_hotel text, p_user uuid, p_name text, p_role text, p_active boolean)
returns void language plpgsql security definer set search_path = randapp, pg_temp as $$
declare v_name text := trim(coalesce(p_name, ''));
begin
  if not randapp.has_permission(p_hotel, 'admin.access') then
    raise exception using errcode = '42501', message = 'non autorizzato';
  end if;
  if p_role not in ('admin','direzione','responsabile','manutentore','governante','reception') then
    raise exception using errcode = '22023', message = 'Ruolo non valido';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 60 then
    raise exception using errcode = '22023', message = 'Nome non valido (2-60 caratteri)';
  end if;
  if not exists (select 1 from randapp.hotel_memberships where hotel_id = p_hotel and auth_user_id = p_user) then
    raise exception using errcode = '22023', message = 'Persona non trovata in questa struttura';
  end if;
  if p_user = auth.uid() and (p_role <> 'admin' or not p_active) then
    raise exception using errcode = '22023', message = 'Non puoi togliere a te stesso il ruolo admin o disattivarti';
  end if;
  update randapp.profiles set display_name = v_name where auth_user_id = p_user;
  update randapp.hotel_memberships set role = p_role, active = p_active where hotel_id = p_hotel and auth_user_id = p_user;
end;
$$;

-- Sblocca un utente (dopo i 5 tentativi sbagliati) senza cambiare il PIN.
create or replace function randapp.admin_user_unlock(p_hotel text, p_user uuid)
returns void language plpgsql security definer set search_path = randapp, pg_temp as $$
begin
  if not randapp.has_permission(p_hotel, 'admin.access') then
    raise exception using errcode = '42501', message = 'non autorizzato';
  end if;
  if not exists (select 1 from randapp.hotel_memberships where hotel_id = p_hotel and auth_user_id = p_user) then
    raise exception using errcode = '22023', message = 'Persona non trovata in questa struttura';
  end if;
  update randapp.auth_pin_credentials set failed_attempts = 0, locked_until = null where auth_user_id = p_user;
end;
$$;

-- Matrice ruoli → permessi. Vale per tutte le strutture (la tabella è unica): lo dice anche la schermata.
create or replace function randapp.admin_roles_overview(p_hotel text)
returns table (role text, permission text)
language plpgsql stable security definer set search_path = randapp, pg_temp as $$
begin
  if not randapp.has_permission(p_hotel, 'admin.access') then
    raise exception using errcode = '42501', message = 'non autorizzato';
  end if;
  return query select rp.role, rp.permission from randapp.role_permissions rp order by rp.role, rp.permission;
end;
$$;

create or replace function randapp.admin_role_set(p_hotel text, p_role text, p_permission text, p_on boolean)
returns void language plpgsql security definer set search_path = randapp, pg_temp as $$
begin
  if not randapp.has_permission(p_hotel, 'admin.access') then
    raise exception using errcode = '42501', message = 'non autorizzato';
  end if;
  if p_role not in ('admin','direzione','responsabile','manutentore','governante','reception') then
    raise exception using errcode = '22023', message = 'Ruolo non valido';
  end if;
  if not exists (select 1 from randapp.role_permissions where permission = p_permission) then
    raise exception using errcode = '22023', message = 'Permesso sconosciuto';
  end if;
  if p_role = 'admin' and p_permission = 'admin.access' then
    raise exception using errcode = '22023', message = 'Il ruolo admin deve sempre avere admin.access';
  end if;
  if p_on then
    insert into randapp.role_permissions (role, permission) values (p_role, p_permission) on conflict do nothing;
  else
    delete from randapp.role_permissions where role = p_role and permission = p_permission;
  end if;
end;
$$;

-- Consumi e conteggi della struttura (solo numeri, nessun contenuto).
create or replace function randapp.admin_usage(p_hotel text)
returns jsonb language plpgsql stable security definer set search_path = randapp, pg_temp as $$
begin
  if not randapp.has_permission(p_hotel, 'admin.access') then
    raise exception using errcode = '42501', message = 'non autorizzato';
  end if;
  return jsonb_build_object(
    'users', (select count(*) from randapp.hotel_memberships where hotel_id = p_hotel and active),
    'issues', (select count(*) from randapp.issues where hotel_id = p_hotel),
    'issues_open', (select count(*) from randapp.issues where hotel_id = p_hotel and status <> 'completata'),
    'interventions', (select count(*) from randapp.interventions where hotel_id = p_hotel),
    'planning_works', (select count(*) from randapp.planning_works where hotel_id = p_hotel),
    'sale_bookings', (select count(*) from randapp.sale_bookings where hotel_id = p_hotel),
    'urgent', (select count(*) from randapp.urgent_alerts where hotel_id = p_hotel),
    'photos', (select count(*) from randapp.issue_photos where hotel_id = p_hotel),
    'photos_bytes', (select coalesce(sum(char_length(data_url)), 0) from randapp.issue_photos where hotel_id = p_hotel),
    'errors_7d', (select count(*) from randapp.app_errors where at > now() - interval '7 days'),
    'db_bytes', pg_database_size(current_database()),
    'connections', (select count(*) from pg_stat_activity where datname = current_database())
  );
end;
$$;

-- Stato notifiche (WhatsApp, ntfy, push): canali, invii degli ultimi 7 giorni, ultimi falliti, destinazioni registrate.
create or replace function randapp.admin_notification_overview(p_hotel text)
returns jsonb language plpgsql stable security definer set search_path = randapp, pg_temp as $$
begin
  if not randapp.has_permission(p_hotel, 'admin.access') then
    raise exception using errcode = '42501', message = 'non autorizzato';
  end if;
  return jsonb_build_object(
    'channels', coalesce((select jsonb_agg(jsonb_build_object('channel', c.channel, 'enabled', c.enabled) order by c.channel)
                            from randapp.notification_channels c where c.hotel_id = p_hotel), '[]'::jsonb),
    'deliveries', coalesce((select jsonb_agg(jsonb_build_object('channel', d.channel, 'status', d.status, 'n', d.n))
                              from (select d.channel, d.status, count(*) n
                                      from randapp.notification_deliveries d
                                      join randapp.notifications n on n.id = d.notification_id
                                     where n.hotel_id = p_hotel and d.created_at > now() - interval '7 days'
                                     group by d.channel, d.status) d), '[]'::jsonb),
    'failed', coalesce((select jsonb_agg(jsonb_build_object('at', f.created_at, 'channel', f.channel, 'error', f.error) order by f.created_at desc)
                          from (select d.created_at, d.channel, d.error
                                  from randapp.notification_deliveries d
                                  join randapp.notifications n on n.id = d.notification_id
                                 where n.hotel_id = p_hotel and d.status = 'failed'
                                 order by d.created_at desc limit 10) f), '[]'::jsonb),
    'devices', coalesce((select jsonb_agg(jsonb_build_object('platform', x.platform, 'n', x.n))
                           from (select platform, count(*) n from randapp.notification_devices
                                  where hotel_id = p_hotel and active group by platform) x), '[]'::jsonb),
    'people', (select count(*) from randapp.hotel_memberships where hotel_id = p_hotel and active),
    'people_with_phone', (select count(*) from randapp.hotel_memberships m join randapp.profiles p on p.auth_user_id = m.auth_user_id
                           where m.hotel_id = p_hotel and m.active and p.phone is not null)
  );
end;
$$;

revoke all on function
  randapp.admin_users_list(text), randapp.admin_user_update(text, uuid, text, text, boolean), randapp.admin_user_unlock(text, uuid),
  randapp.admin_roles_overview(text), randapp.admin_role_set(text, text, text, boolean),
  randapp.admin_usage(text), randapp.admin_notification_overview(text)
  from public, anon;
grant execute on function
  randapp.admin_users_list(text), randapp.admin_user_update(text, uuid, text, text, boolean), randapp.admin_user_unlock(text, uuid),
  randapp.admin_roles_overview(text), randapp.admin_role_set(text, text, text, boolean),
  randapp.admin_usage(text), randapp.admin_notification_overview(text)
  to authenticated;
