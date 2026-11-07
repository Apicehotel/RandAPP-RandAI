-- Consumi come nella vecchia app: dimensione database, connessioni usate/massime, foto, conteggi, destinazioni notifiche e
-- attività degli ultimi 30 giorni (segnalazioni e interventi per giorno). Le chiavi di prima restano, ne arrivano di nuove.
-- Attività: una sola scansione per tabella (group by giorno), non una sottoquery per giorno.
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
    'connections', (select count(*) from pg_stat_activity where datname = current_database()),
    'max_connections', (select setting::bigint from pg_settings where name = 'max_connections'),
    'devices', (select count(*) from randapp.notification_devices where hotel_id = p_hotel and active),
    'activity_30d', (
      select jsonb_agg(jsonb_build_object('date', d.day, 'issues', coalesce(i.n, 0), 'interventions', coalesce(v.n, 0)) order by d.day)
        from (select (current_date - g)::date as day from generate_series(0, 29) g) d
        left join (select created_at::date as day, count(*) n from randapp.issues
                    where hotel_id = p_hotel and created_at >= current_date - 29 group by 1) i on i.day = d.day
        left join (select created_at::date as day, count(*) n from randapp.interventions
                    where hotel_id = p_hotel and created_at >= current_date - 29 group by 1) v on v.day = d.day
    )
  );
end;
$$;
