-- Interventi: lavori di manutenzione (anche programmati), separati dalle segnalazioni.
-- Un intervento può nascere da una segnalazione (issue_id) ma non è obbligatorio.

insert into randapp.role_permissions (role, permission) values
  ('admin','interventions.view'), ('admin','interventions.create'), ('admin','interventions.update'),
  ('direzione','interventions.view'), ('direzione','interventions.create'), ('direzione','interventions.update'),
  ('responsabile','interventions.view'), ('responsabile','interventions.create'), ('responsabile','interventions.update'),
  ('manutentore','interventions.view'), ('manutentore','interventions.create'), ('manutentore','interventions.update'),
  ('governante','interventions.view'),
  ('reception','interventions.view')
on conflict do nothing;

create table randapp.interventions (
  id           uuid primary key default gen_random_uuid(),
  hotel_id     text not null references randapp.hotels (id),
  title        text not null check (char_length(title) between 1 and 140),
  location     text check (location is null or char_length(location) <= 40),
  notes        text check (notes is null or char_length(notes) <= 2000),
  status       text not null default 'da_fare'
                 check (status in ('da_fare','in_corso','fatto')),
  scheduled_at timestamptz,
  issue_id     uuid references randapp.issues (id),
  created_by   uuid not null references auth.users (id),
  assigned_to  uuid references auth.users (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  completed_at timestamptz
);

create index interventions_hotel_status_idx on randapp.interventions (hotel_id, status, scheduled_at);

create trigger interventions_touch before update on randapp.interventions
  for each row execute function randapp.touch_updated_at();

alter table randapp.interventions enable row level security;

create policy interventions_select on randapp.interventions
  for select to authenticated using (randapp.has_permission(hotel_id, 'interventions.view'));

create policy interventions_insert on randapp.interventions
  for insert to authenticated
  with check (randapp.has_permission(hotel_id, 'interventions.create') and created_by = auth.uid());

create policy interventions_update on randapp.interventions
  for update to authenticated
  using (randapp.has_permission(hotel_id, 'interventions.update'))
  with check (randapp.has_permission(hotel_id, 'interventions.update'));

-- Nessuna policy di DELETE: gli interventi non si cancellano dal browser.

revoke all on randapp.interventions from anon;
grant select, insert, update on randapp.interventions to authenticated;
