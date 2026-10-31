-- Task: Avvisi Urgenti (note rapide da prendere in carico) e Promemoria (messaggi per ruolo, anche ripetuti).
-- Nota: qui ci sono solo i dati. L'invio dei promemoria (notifiche) non è ancora attivo.

insert into public.role_permissions (role, permission) values
  ('admin','urgent.view'), ('admin','urgent.create'), ('admin','urgent.update'),
  ('direzione','urgent.view'), ('direzione','urgent.create'), ('direzione','urgent.update'),
  ('responsabile','urgent.view'), ('responsabile','urgent.create'), ('responsabile','urgent.update'),
  ('manutentore','urgent.view'), ('manutentore','urgent.create'), ('manutentore','urgent.update'),
  ('governante','urgent.view'), ('governante','urgent.create'),
  ('reception','urgent.view'), ('reception','urgent.create'),
  ('admin','reminders.view'), ('admin','reminders.create'), ('admin','reminders.update'),
  ('direzione','reminders.view'), ('direzione','reminders.create'), ('direzione','reminders.update'),
  ('responsabile','reminders.view'), ('responsabile','reminders.create'), ('responsabile','reminders.update'),
  ('manutentore','reminders.view'),
  ('governante','reminders.view'),
  ('reception','reminders.view'), ('reception','reminders.create'), ('reception','reminders.update')
on conflict do nothing;

-- ---------------------------------------------------------------- Avvisi urgenti
create table public.urgent_alerts (
  id           uuid primary key default gen_random_uuid(),
  hotel_id     text not null references public.hotels (id),
  note         text not null check (char_length(note) between 1 and 300),
  status       text not null default 'aperto' check (status in ('aperto','in_carico','risolto')),
  created_by   uuid not null references auth.users (id),
  taken_by     uuid references auth.users (id),
  taken_at     timestamptz,
  resolved_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index urgent_alerts_hotel_idx on public.urgent_alerts (hotel_id, status, created_at);
create trigger urgent_alerts_touch before update on public.urgent_alerts
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- Promemoria
create table public.reminders (
  id           uuid primary key default gen_random_uuid(),
  hotel_id     text not null references public.hotels (id),
  message      text not null check (char_length(message) between 1 and 500),
  target_roles text[] not null default '{}'
                 check (target_roles <@ array['admin','direzione','responsabile','manutentore','governante','reception']),
  repeat_kind  text not null default 'once' check (repeat_kind in ('once','daily','weekly','monthly')),
  weekdays     text[] not null default '{}'
                 check (weekdays <@ array['mon','tue','wed','thu','fri','sat','sun']),
  times        text[] not null default '{}' check (cardinality(times) <= 8),
  start_date   date not null default current_date,
  end_date     date,
  active       boolean not null default true,
  created_by   uuid not null references auth.users (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);
create index reminders_hotel_idx on public.reminders (hotel_id, active, start_date);
create trigger reminders_touch before update on public.reminders
  for each row execute function public.touch_updated_at();

alter table public.urgent_alerts enable row level security;
alter table public.reminders     enable row level security;

create policy urgent_alerts_select on public.urgent_alerts
  for select to authenticated using (public.has_permission(hotel_id, 'urgent.view'));
create policy urgent_alerts_insert on public.urgent_alerts
  for insert to authenticated
  with check (public.has_permission(hotel_id, 'urgent.create') and created_by = auth.uid());
create policy urgent_alerts_update on public.urgent_alerts
  for update to authenticated
  using (public.has_permission(hotel_id, 'urgent.update'))
  with check (public.has_permission(hotel_id, 'urgent.update'));

create policy reminders_select on public.reminders
  for select to authenticated using (public.has_permission(hotel_id, 'reminders.view'));
create policy reminders_insert on public.reminders
  for insert to authenticated
  with check (public.has_permission(hotel_id, 'reminders.create') and created_by = auth.uid());
create policy reminders_update on public.reminders
  for update to authenticated
  using (public.has_permission(hotel_id, 'reminders.update'))
  with check (public.has_permission(hotel_id, 'reminders.update'));

-- Nessuna policy di DELETE: avvisi e promemoria non si cancellano dal browser (si risolvono / si disattivano).

revoke all on public.urgent_alerts, public.reminders from anon;
grant select, insert, update on public.urgent_alerts, public.reminders to authenticated;
