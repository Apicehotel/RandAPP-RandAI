-- Importazione dalla vecchia app (progetto HotelGio): colonne utili in più sulle segnalazioni e foto.
-- Si porta solo ciò che serve davvero; i numeri di telefono di chi ha scritto su WhatsApp NON vengono copiati.
-- Nessuna policy di DELETE. Le colonne nuove sono in sola lettura per il browser (le scrive solo la sincronizzazione).

alter table randapp.issues
  add column legacy_id         uuid unique,
  add column source            text check (source is null or source in ('app','whatsapp','import')),
  add column created_by_name   text check (created_by_name is null or char_length(created_by_name) <= 80),
  add column completed_by_name text check (completed_by_name is null or char_length(completed_by_name) <= 80),
  add column completion_note   text check (completion_note is null or char_length(completion_note) <= 2000),
  add column technician_name   text check (technician_name is null or char_length(technician_name) <= 80),
  add column part_replaced     text check (part_replaced is null or char_length(part_replaced) <= 200);

grant select (legacy_id, source, created_by_name, completed_by_name, completion_note, technician_name, part_replaced)
  on randapp.issues to authenticated;

-- Foto prima/dopo. Il contenuto sta in una tabella a parte così le liste restano leggere.
create table randapp.issue_photos (
  id         uuid primary key default gen_random_uuid(),
  hotel_id   text not null references randapp.hotels (id),
  issue_id   uuid not null references randapp.issues (id),
  kind       text not null check (kind in ('prima','dopo')),
  data_url   text not null check (data_url like 'data:image/%' and char_length(data_url) <= 2000000),
  created_at timestamptz not null default now(),
  unique (issue_id, kind)
);
create index issue_photos_issue_idx on randapp.issue_photos (issue_id);

alter table randapp.issue_photos enable row level security;
create policy issue_photos_select on randapp.issue_photos
  for select to authenticated using (randapp.has_permission(hotel_id, 'issues.view'));
-- Nuove foto dall'app (fase 1): chi può modificare le segnalazioni può aggiungerle.
create policy issue_photos_insert on randapp.issue_photos
  for insert to authenticated with check (randapp.has_permission(hotel_id, 'issues.update'));
revoke all on randapp.issue_photos from anon;
revoke all on randapp.issue_photos from authenticated;
grant select, insert on randapp.issue_photos to authenticated;

-- Traduzione dei valori della vecchia app nel linguaggio della nuova.
create or replace function randapp.legacy_status(p text, p_tecnico boolean)
returns text language sql immutable set search_path = randapp, pg_temp as $$
  select case p when 'done' then 'completata'
                when 'waiting' then 'attesa_pezzo'
                else case when p_tecnico then 'tecnico' else 'da_fare' end end;
$$;
create or replace function randapp.legacy_urgency(p text)
returns text language sql immutable set search_path = randapp, pg_temp as $$
  select case p when 'alta' then 'alta' when 'bassa' then 'bassa' else 'normale' end;
$$;
create or replace function randapp.legacy_category(p text)
returns text language sql immutable set search_path = randapp, pg_temp as $$
  select case p when 'idraulico' then 'Idraulica' when 'elettrico' then 'Elettrico'
                when 'clima' then 'Climatizzazione' when 'arredo' then 'Arredi'
                else 'Altro' end;
$$;
revoke all on function randapp.legacy_status(text, boolean), randapp.legacy_urgency(text), randapp.legacy_category(text)
  from public, anon, authenticated;
