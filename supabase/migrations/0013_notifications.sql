-- Sistema notifiche: una "casella" per utente (in app) + canali esterni predisposti
-- (ntfy, push web/Android/iOS, WhatsApp). Tutto per struttura (hotel_id), RLS ovunque, nessun DELETE.
-- Chi crea le notifiche sono solo le funzioni/trigger del server: il browser legge le proprie
-- e può solo segnarle come lette.

insert into randapp.role_permissions (role, permission) values
  ('admin','notifications.manage'), ('direzione','notifications.manage'), ('responsabile','notifications.manage')
on conflict do nothing;

-- ---------------------------------------------------------------- casella in app
create table randapp.notifications (
  id         uuid primary key default gen_random_uuid(),
  hotel_id   text not null references randapp.hotels (id),
  user_id    uuid not null references auth.users (id),
  kind       text not null check (kind in (
               'urgent_alert','urgent_reminder','issue_urgent','issue_assigned',
               'intervention_assigned','work_assigned','sensor_alert','sensor_stale',
               'sync_stopped','reminder','test')),
  title      text not null check (char_length(title) between 1 and 120),
  body       text check (body is null or char_length(body) <= 500),
  link       text check (link is null or link ~ '^/[a-z0-9/_-]*$'),
  priority   text not null default 'normal' check (priority in ('normal','urgent')),
  ref_id     uuid,
  created_at timestamptz not null default now(),
  read_at    timestamptz
);
create index notifications_user_idx on randapp.notifications (user_id, hotel_id, created_at desc);
create index notifications_unread_idx on randapp.notifications (user_id, hotel_id) where read_at is null;

alter table randapp.notifications enable row level security;
create policy notifications_select on randapp.notifications
  for select to authenticated using (user_id = auth.uid() and randapp.is_hotel_member(hotel_id));
create policy notifications_update on randapp.notifications
  for update to authenticated
  using (user_id = auth.uid() and randapp.is_hotel_member(hotel_id))
  with check (user_id = auth.uid() and randapp.is_hotel_member(hotel_id));
revoke all on randapp.notifications from anon, authenticated;
grant select on randapp.notifications to authenticated;
grant update (read_at) on randapp.notifications to authenticated;

-- ---------------------------------------------------------------- preferenze per tipo e canale
create table randapp.notification_prefs (
  user_id  uuid not null references auth.users (id),
  hotel_id text not null references randapp.hotels (id),
  kind     text not null,
  ntfy     boolean not null default true,
  push     boolean not null default true,
  whatsapp boolean not null default false,
  primary key (user_id, hotel_id, kind)
);
alter table randapp.notification_prefs enable row level security;
create policy notification_prefs_select on randapp.notification_prefs
  for select to authenticated using (user_id = auth.uid());
create policy notification_prefs_insert on randapp.notification_prefs
  for insert to authenticated with check (user_id = auth.uid() and randapp.is_hotel_member(hotel_id));
create policy notification_prefs_update on randapp.notification_prefs
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and randapp.is_hotel_member(hotel_id));
revoke all on randapp.notification_prefs from anon, authenticated;
grant select on randapp.notification_prefs to authenticated;
grant insert (user_id, hotel_id, kind, ntfy, push, whatsapp) on randapp.notification_prefs to authenticated;
grant update (ntfy, push, whatsapp) on randapp.notification_prefs to authenticated;

-- ---------------------------------------------------------------- canali attivi per struttura
-- Qui solo interruttori e impostazioni NON segrete: le chiavi (VAPID, WhatsApp...) stanno nei segreti della funzione.
create table randapp.notification_channels (
  hotel_id text not null references randapp.hotels (id),
  channel  text not null check (channel in ('ntfy','push','whatsapp')),
  enabled  boolean not null default false,
  config   jsonb not null default '{}' check (pg_column_size(config) < 2000),
  primary key (hotel_id, channel)
);
alter table randapp.notification_channels enable row level security;
create policy notification_channels_select on randapp.notification_channels
  for select to authenticated using (randapp.is_hotel_member(hotel_id));
create policy notification_channels_insert on randapp.notification_channels
  for insert to authenticated with check (randapp.has_permission(hotel_id, 'notifications.manage'));
create policy notification_channels_update on randapp.notification_channels
  for update to authenticated
  using (randapp.has_permission(hotel_id, 'notifications.manage'))
  with check (randapp.has_permission(hotel_id, 'notifications.manage'));
revoke all on randapp.notification_channels from anon, authenticated;
grant select on randapp.notification_channels to authenticated;
grant insert (hotel_id, channel, enabled, config) on randapp.notification_channels to authenticated;
grant update (enabled, config) on randapp.notification_channels to authenticated;
insert into randapp.notification_channels (hotel_id, channel)
  select h.id, c from randapp.hotels h, unnest(array['ntfy','push','whatsapp']) c on conflict do nothing;

-- ---------------------------------------------------------------- dispositivi / destinazioni dell'utente
-- web = abbonamento push del browser (token = endpoint, keys = p256dh/auth); android/ios = token nativo (apk e app Apple, in futuro);
-- ntfy = nome del topic personale (lungo e casuale); whatsapp = numero in formato +39...
create table randapp.notification_devices (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id),
  hotel_id   text not null references randapp.hotels (id),
  platform   text not null check (platform in ('web','android','ios','ntfy','whatsapp')),
  token      text not null check (char_length(token) between 3 and 1000),
  keys       jsonb check (keys is null or pg_column_size(keys) < 600),
  label      text check (label is null or char_length(label) <= 60),
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  last_seen  timestamptz,
  unique (user_id, hotel_id, platform, token)
);
create index notification_devices_user_idx on randapp.notification_devices (user_id, hotel_id, active);
alter table randapp.notification_devices enable row level security;
create policy notification_devices_select on randapp.notification_devices
  for select to authenticated using (user_id = auth.uid());
create policy notification_devices_insert on randapp.notification_devices
  for insert to authenticated with check (user_id = auth.uid() and randapp.is_hotel_member(hotel_id));
create policy notification_devices_update on randapp.notification_devices
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and randapp.is_hotel_member(hotel_id));
revoke all on randapp.notification_devices from anon, authenticated;
grant select on randapp.notification_devices to authenticated;
grant insert (user_id, hotel_id, platform, token, keys, label) on randapp.notification_devices to authenticated;
grant update (active, keys, label, last_seen) on randapp.notification_devices to authenticated;

-- ---------------------------------------------------------------- code di invio (solo server)
create table randapp.notification_deliveries (
  id              uuid primary key default gen_random_uuid(),
  notification_id uuid not null references randapp.notifications (id),
  channel         text not null check (channel in ('ntfy','push','whatsapp')),
  device_id       uuid references randapp.notification_devices (id),
  status          text not null default 'pending' check (status in ('pending','sent','failed','skipped')),
  attempts        integer not null default 0,
  error           text check (error is null or char_length(error) <= 300),
  created_at      timestamptz not null default now(),
  sent_at         timestamptz
);
create index notification_deliveries_pending_idx on randapp.notification_deliveries (created_at) where status = 'pending';
alter table randapp.notification_deliveries enable row level security;
revoke all on randapp.notification_deliveries from anon, authenticated;

-- Memoria dei controlli (chi è già stato avvisato di cosa): solo server.
create table randapp.notification_state (
  key        text primary key,
  value      jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
alter table randapp.notification_state enable row level security;
revoke all on randapp.notification_state from anon, authenticated;

-- Promemoria già inviati (uno per promemoria, giorno e orario).
create table randapp.reminder_fires (
  reminder_id uuid not null references randapp.reminders (id),
  fire_date   date not null,
  fire_time   text not null,
  primary key (reminder_id, fire_date, fire_time)
);
alter table randapp.reminder_fires enable row level security;
revoke all on randapp.reminder_fires from anon, authenticated;

-- ---------------------------------------------------------------- creare una notifica
-- Un record in casella per ogni destinatario (ruoli e/o persone, escluso chi ha fatto l'azione)
-- e una consegna in coda per ogni canale acceso (struttura + preferenza dell'utente).
-- p_only_present = true: solo a chi in quel momento è "in struttura" (tabella presence, present = true).
create or replace function randapp.notify(
  p_hotel text, p_roles text[], p_users uuid[], p_kind text, p_title text, p_body text,
  p_link text, p_priority text default 'normal', p_ref uuid default null, p_exclude uuid default null,
  p_only_present boolean default false
) returns integer
language plpgsql security definer set search_path = randapp
as $$
declare
  r record; nid uuid; n integer := 0; pref record; d record;
  ntfy_on boolean; push_on boolean; wa_on boolean;
begin
  select coalesce(bool_or(enabled) filter (where channel = 'ntfy'), false),
         coalesce(bool_or(enabled) filter (where channel = 'push'), false),
         coalesce(bool_or(enabled) filter (where channel = 'whatsapp'), false)
    into ntfy_on, push_on, wa_on
    from randapp.notification_channels where hotel_id = p_hotel;

  for r in
    select distinct m.auth_user_id as uid
    from randapp.hotel_memberships m
    join randapp.profiles p on p.auth_user_id = m.auth_user_id
    where m.hotel_id = p_hotel and m.active and p.active
      and (m.role = any (coalesce(p_roles, '{}')) or m.auth_user_id = any (coalesce(p_users, '{}')))
      and m.auth_user_id is distinct from p_exclude
      and (not p_only_present or exists (
            select 1 from randapp.presence pr
            where pr.hotel_id = p_hotel and pr.user_id = m.auth_user_id and pr.present
              and pr.since > now() - interval '7 hours 20 minutes'))
  loop
    insert into randapp.notifications (hotel_id, user_id, kind, title, body, link, priority, ref_id)
    values (p_hotel, r.uid, p_kind, left(p_title, 120), left(p_body, 500), p_link, coalesce(p_priority, 'normal'), p_ref)
    returning id into nid;
    n := n + 1;

    select * into pref from randapp.notification_prefs where user_id = r.uid and hotel_id = p_hotel and kind = p_kind;
    for d in
      select id, platform from randapp.notification_devices
      where user_id = r.uid and hotel_id = p_hotel and active
    loop
      if (d.platform = 'ntfy' and ntfy_on and coalesce(pref.ntfy, true))
         or (d.platform in ('web','android','ios') and push_on and coalesce(pref.push, true))
         or (d.platform = 'whatsapp' and wa_on and coalesce(pref.whatsapp, false)) then
        insert into randapp.notification_deliveries (notification_id, channel, device_id)
        values (nid, case d.platform when 'ntfy' then 'ntfy' when 'whatsapp' then 'whatsapp' else 'push' end, d.id);
      end if;
    end loop;
  end loop;
  return n;
end;
$$;
revoke all on function randapp.notify(text, text[], uuid[], text, text, text, text, text, uuid, uuid, boolean) from public, anon, authenticated;

-- ---------------------------------------------------------------- eventi: avvisi urgenti
create or replace function randapp.trg_notify_urgent_alert() returns trigger
language plpgsql security definer set search_path = randapp
as $$
begin
  if tg_op = 'INSERT' then
    perform randapp.notify(new.hotel_id, array['admin','direzione','responsabile','manutentore'], null,
      'urgent_alert', 'Avviso urgente', new.note, '/task/urgent/' || new.id, 'urgent', new.id, new.created_by, true);
  elsif new.status = 'in_carico' and old.status = 'aperto' then
    perform randapp.notify(new.hotel_id, null, array[new.created_by],
      'urgent_alert', 'Avviso preso in carico', new.note, '/task/urgent/' || new.id, 'normal', new.id, new.taken_by);
  end if;
  return new;
end;
$$;
create trigger urgent_alerts_notify after insert or update of status on randapp.urgent_alerts
  for each row execute function randapp.trg_notify_urgent_alert();

-- ---------------------------------------------------------------- eventi: segnalazioni
create or replace function randapp.trg_notify_issue() returns trigger
language plpgsql security definer set search_path = randapp
as $$
begin
  if new.urgency = 'urgente' and (tg_op = 'INSERT' or old.urgency is distinct from 'urgente') then
    perform randapp.notify(new.hotel_id, array['admin','direzione','responsabile'], null,
      'issue_urgent', 'Segnalazione urgente', new.title || coalesce(' · ' || new.room, ''),
      '/issues/' || new.id, 'urgent', new.id, new.created_by);
  end if;
  if new.assigned_to is not null and (tg_op = 'INSERT' or old.assigned_to is distinct from new.assigned_to) then
    perform randapp.notify(new.hotel_id, null, array[new.assigned_to],
      'issue_assigned', 'Segnalazione assegnata a te', new.title || coalesce(' · ' || new.room, ''),
      '/issues/' || new.id, 'normal', new.id, new.created_by);
  end if;
  return new;
end;
$$;
create trigger issues_notify after insert or update of urgency, assigned_to on randapp.issues
  for each row execute function randapp.trg_notify_issue();

-- ---------------------------------------------------------------- eventi: interventi e lavori assegnati
create or replace function randapp.trg_notify_intervention() returns trigger
language plpgsql security definer set search_path = randapp
as $$
declare added uuid[];
begin
  select coalesce(array_agg(x), '{}') into added
    from unnest(new.assignee_ids) x
    where tg_op = 'INSERT' or not (x = any (old.assignee_ids));
  if cardinality(added) > 0 then
    perform randapp.notify(new.hotel_id, null, added, 'intervention_assigned', 'Intervento assegnato a te',
      new.title || coalesce(' · ' || new.location, ''), '/interventions/' || new.id, 'normal', new.id, new.created_by);
  end if;
  return new;
end;
$$;
create trigger interventions_notify after insert or update of assignee_ids on randapp.interventions
  for each row execute function randapp.trg_notify_intervention();

create or replace function randapp.trg_notify_work() returns trigger
language plpgsql security definer set search_path = randapp
as $$
declare added uuid[];
begin
  select coalesce(array_agg(x), '{}') into added
    from unnest(new.assignee_ids) x
    where tg_op = 'INSERT' or not (x = any (old.assignee_ids));
  if cardinality(added) > 0 then
    perform randapp.notify(new.hotel_id, null, added, 'work_assigned', 'Lavoro assegnato a te',
      new.description, '/planning/work', 'normal', new.id, new.created_by);
  end if;
  return new;
end;
$$;
create trigger planning_works_notify after insert or update of assignee_ids on randapp.planning_works
  for each row execute function randapp.trg_notify_work();

-- ---------------------------------------------------------------- controlli periodici
-- notify_run() va chiamata ogni minuto (pg_cron, vedi README). Ogni controllo ricorda cosa ha già detto.

-- Avvisi urgenti ancora aperti: dopo 10 minuti, poi ogni 15, al massimo 6 volte.
create or replace function randapp.notify_stale_alerts() returns integer
language plpgsql security definer set search_path = randapp
as $$
declare a record; st jsonb; sent integer := 0;
begin
  for a in select * from randapp.urgent_alerts where status = 'aperto' and created_at < now() - interval '10 minutes' loop
    select value into st from randapp.notification_state where key = 'alert:' || a.id;
    if st is null or ((st->>'n')::int < 6 and (st->>'at')::timestamptz < now() - interval '15 minutes') then
      perform randapp.notify(a.hotel_id, array['admin','direzione','responsabile','manutentore'], null,
        'urgent_reminder', 'Avviso ancora da prendere in carico', a.note, '/task/urgent/' || a.id, 'urgent', a.id, null, true);
      insert into randapp.notification_state (key, value) values ('alert:' || a.id, jsonb_build_object('n', 1, 'at', now()))
        on conflict (key) do update set value = jsonb_build_object('n', coalesce((notification_state.value->>'n')::int, 0) + 1, 'at', now()), updated_at = now();
      sent := sent + 1;
    end if;
  end loop;
  return sent;
end;
$$;

-- Sensori: temperatura fuori soglia (stesse regole dell'app), sensori che non arrivano più, sincronizzazione ferma.
create or replace function randapp.notify_sensor_checks() returns integer
language plpgsql security definer set search_path = randapp
as $$
declare
  h record; s record; st jsonb; cfg record; tmin numeric; tmax numeric; breach boolean; sent integer := 0;
  missing_n integer; prev_n integer; newest timestamptz; stopped boolean;
begin
  for h in select id from randapp.hotels where active loop
    select * into cfg from randapp.sensor_settings where hotel_id = h.id;
    for s in select * from randapp.sensors where hotel_id = h.id and active and kind = 'temperatura' loop
      breach := false;
      if s.online and s.last_seen is not null and s.last_seen > now() - interval '30 minutes' and s.temperature is not null then
        if s.role = 'motore' then
          if coalesce(cfg.season, 'inverno') = 'estate' then tmin := null; tmax := coalesce(cfg.summer_max, 18);
          else tmin := coalesce(cfg.winter_min, 20); tmax := null; end if;
        elsif s.role = 'frigo' then tmin := null; tmax := coalesce(cfg.fridge_max, 0);
        else tmin := s.alert_min; tmax := s.alert_max; end if;
        breach := (tmax is not null and s.temperature > tmax) or (tmin is not null and s.temperature < tmin);
      end if;
      select value into st from randapp.notification_state where key = 'sensor:' || s.id;
      if breach and (st is null or coalesce((st->>'alert')::boolean, false) = false
                     or (st->>'at')::timestamptz < now() - interval '6 hours') then
        perform randapp.notify(h.id, array['admin','direzione','responsabile','manutentore'], null,
          'sensor_alert', 'Sensore in allerta', s.name || ' · ' || to_char(s.temperature, 'FM990.0') || '°C',
          '/sensors', 'urgent', s.id, null);
        insert into randapp.notification_state (key, value) values ('sensor:' || s.id, jsonb_build_object('alert', true, 'at', now()))
          on conflict (key) do update set value = jsonb_build_object('alert', true, 'at', now()), updated_at = now();
        sent := sent + 1;
      elsif not breach and st is not null and coalesce((st->>'alert')::boolean, false) then
        update randapp.notification_state set value = jsonb_build_object('alert', false, 'at', now()), updated_at = now() where key = 'sensor:' || s.id;
      end if;
    end loop;

    -- sensori senza dati da più di 24 ore: si avvisa quando il numero cresce
    select count(*) into missing_n from randapp.sensors
      where hotel_id = h.id and active and (last_seen is null or last_seen < now() - interval '24 hours');
    select coalesce((value->>'n')::int, 0) into prev_n from randapp.notification_state where key = 'missing:' || h.id;
    if missing_n > coalesce(prev_n, 0) then
      perform randapp.notify(h.id, array['admin','direzione','responsabile'], null, 'sensor_stale', 'Sensori che non arrivano più',
        missing_n || ' sensori senza dati da oltre 24 ore', '/sensors', 'normal', null, null);
      sent := sent + 1;
    end if;
    insert into randapp.notification_state (key, value) values ('missing:' || h.id, jsonb_build_object('n', missing_n))
      on conflict (key) do update set value = jsonb_build_object('n', missing_n), updated_at = now();

    -- sincronizzazione ferma: nessun sensore aggiornato da più di un'ora
    select max(last_seen) into newest from randapp.sensors where hotel_id = h.id and active;
    stopped := newest is not null and newest < now() - interval '60 minutes';
    select value into st from randapp.notification_state where key = 'sync:' || h.id;
    if stopped and (st is null or coalesce((st->>'stopped')::boolean, false) = false or (st->>'at')::timestamptz < now() - interval '6 hours') then
      perform randapp.notify(h.id, array['admin','direzione','responsabile','manutentore'], null, 'sync_stopped',
        'Sensori: sincronizzazione ferma', 'Nessun sensore si aggiorna da oltre un''ora', '/sensors', 'urgent', null, null);
      insert into randapp.notification_state (key, value) values ('sync:' || h.id, jsonb_build_object('stopped', true, 'at', now()))
        on conflict (key) do update set value = jsonb_build_object('stopped', true, 'at', now()), updated_at = now();
      sent := sent + 1;
    elsif not stopped and st is not null and coalesce((st->>'stopped')::boolean, false) then
      update randapp.notification_state set value = jsonb_build_object('stopped', false, 'at', now()), updated_at = now() where key = 'sync:' || h.id;
    end if;
  end loop;
  return sent;
end;
$$;

-- Promemoria all'orario: fuso Europe/Rome; tolleranza di 10 minuti se il controllo ritarda; una sola volta per orario.
create or replace function randapp.notify_due_reminders() returns integer
language plpgsql security definer set search_path = randapp
as $$
declare
  r record; t text; local_now timestamp := now() at time zone 'Europe/Rome'; today date := (now() at time zone 'Europe/Rome')::date;
  due boolean; sent integer := 0; roles text[]; wd text;
begin
  wd := (array['mon','tue','wed','thu','fri','sat','sun'])[extract(isodow from today)::int];
  for r in select * from randapp.reminders where active and start_date <= today and (end_date is null or end_date >= today) loop
    due := case r.repeat_kind
      when 'once' then today = r.start_date
      when 'daily' then true
      when 'weekly' then wd = any (r.weekdays)
      when 'monthly' then extract(day from today) = extract(day from r.start_date)
    end;
    continue when not coalesce(due, false);
    roles := case when cardinality(r.target_roles) = 0
                  then array['admin','direzione','responsabile','manutentore','governante','reception'] else r.target_roles end;
    foreach t in array r.times loop
      continue when (today + t::time) > local_now or (today + t::time) < local_now - interval '10 minutes';
      begin
        insert into randapp.reminder_fires (reminder_id, fire_date, fire_time) values (r.id, today, t);
      exception when unique_violation then continue;
      end;
      perform randapp.notify(r.hotel_id, roles, null, 'reminder', 'Promemoria', r.message, '/task/reminders/' || r.id, 'normal', r.id, null, true);
      sent := sent + 1;
    end loop;
  end loop;
  return sent;
end;
$$;

-- Come la vecchia app: la presenza scade da sola dopo 7 ore e 20 minuti.
create or replace function randapp.expire_presence() returns integer
language plpgsql security definer set search_path = randapp
as $$
declare n integer;
begin
  update randapp.presence set present = false where present and since <= now() - interval '7 hours 20 minutes';
  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function randapp.notify_run() returns jsonb
language sql security definer set search_path = randapp
as $$
  select jsonb_build_object('expired', randapp.expire_presence(), 'alerts', randapp.notify_stale_alerts(),
                            'sensors', randapp.notify_sensor_checks(), 'reminders', randapp.notify_due_reminders());
$$;
revoke all on function randapp.expire_presence(), randapp.notify_stale_alerts(), randapp.notify_sensor_checks(), randapp.notify_due_reminders(), randapp.notify_run() from public, anon, authenticated;

-- Notifica di prova: la manda a se stesso chi ha il permesso notifications.manage (serve a provare i canali).
create or replace function randapp.notify_test(p_hotel text) returns integer
language plpgsql security definer set search_path = randapp
as $$
begin
  if auth.uid() is null or not randapp.is_hotel_member(p_hotel) then raise exception 'not allowed'; end if;
  return randapp.notify(p_hotel, null, array[auth.uid()], 'test', 'Notifica di prova', 'Se la leggi, le notifiche funzionano.', '/notifications', 'normal', null, null);
end;
$$;
revoke all on function randapp.notify_test(text) from public, anon;
grant execute on function randapp.notify_test(text) to authenticated;
