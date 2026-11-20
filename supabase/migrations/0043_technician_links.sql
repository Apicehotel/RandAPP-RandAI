-- 0043 — Link per il tecnico (come la vecchia app): il tecnico riceve un indirizzo personale e dalla pagina
-- comunica arrivo, inizio, note e «intervento terminato». La chiusura della segnalazione resta del personale.
-- Il codice nel link non è salvato: si conserva solo l'impronta SHA-256. Scadenza 72 ore, revocabile.
-- La pagina pubblica passa solo dalla funzione `randapp-technician-portal`; le funzioni portal_* non sono
-- eseguibili da anon/authenticated. Solo schema randapp.

create table randapp.technician_links (
  id            uuid primary key default gen_random_uuid(),
  hotel_id      text not null references randapp.hotels (id),
  issue_id      uuid not null references randapp.issues (id),
  technician_id uuid references randapp.external_technicians (id),
  token_hash    text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_by    uuid,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  revoked_at    timestamptz
);
create index technician_links_issue_idx on randapp.technician_links (issue_id, created_at desc);

create table randapp.technician_events (
  id         uuid primary key default gen_random_uuid(),
  hotel_id   text not null references randapp.hotels (id),
  issue_id   uuid not null references randapp.issues (id),
  link_id    uuid references randapp.technician_links (id),
  kind       text not null check (kind in ('opened','arrival','started','note','completion_requested')),
  note       text check (note is null or char_length(note) <= 1000),
  created_at timestamptz not null default now()
);
create index technician_events_issue_idx on randapp.technician_events (issue_id, created_at);

alter table randapp.technician_links  enable row level security;
alter table randapp.technician_events enable row level security;
revoke all on randapp.technician_links, randapp.technician_events from anon, authenticated;
-- Il personale legge solo gli eventi (nessun hash dei link dal browser).
create policy technician_events_read on randapp.technician_events
  for select to authenticated using (randapp.has_permission(hotel_id, 'issues.view'));
grant select on randapp.technician_events to authenticated;

-- Personale: crea il link (revoca i precedenti della stessa segnalazione) e riceve il codice una sola volta.
create or replace function randapp.create_technician_link(p_hotel text, p_issue uuid, p_technician uuid)
returns text
language plpgsql security definer set search_path = randapp, pg_temp
as $$
declare v_token text; v_tech uuid;
begin
  if not (randapp.has_permission(p_hotel, 'issues.update') and randapp.has_permission(p_hotel, 'technicians.view')) then
    raise exception 'Non autorizzato';
  end if;
  if not exists (select 1 from randapp.issues where id = p_issue and hotel_id = p_hotel) then
    raise exception 'Segnalazione non trovata';
  end if;
  select id into v_tech from randapp.external_technicians where id = p_technician and hotel_id = p_hotel;
  update randapp.technician_links set revoked_at = now() where issue_id = p_issue and revoked_at is null;
  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into randapp.technician_links (hotel_id, issue_id, technician_id, token_hash, created_by, expires_at)
  values (p_hotel, p_issue, v_tech, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), auth.uid(), now() + interval '72 hours');
  return v_token;
end $$;

-- Pagina pubblica: dati minimi della segnalazione + eventi già comunicati. Nessun errore dettagliato.
create or replace function randapp.portal_get(p_token text)
returns jsonb
language plpgsql security definer set search_path = randapp, pg_temp
as $$
declare l randapp.technician_links; i randapp.issues; h text;
begin
  select * into l from randapp.technician_links
   where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
     and revoked_at is null and expires_at > now();
  if l.id is null then return null; end if;
  select * into i from randapp.issues where id = l.issue_id;
  select name into h from randapp.hotels where id = l.hotel_id;
  insert into randapp.technician_events (hotel_id, issue_id, link_id, kind)
  select l.hotel_id, l.issue_id, l.id, 'opened'
   where not exists (select 1 from randapp.technician_events where link_id = l.id and kind = 'opened');
  return jsonb_build_object(
    'hotel', h, 'room', i.room, 'title', i.title, 'description', i.description, 'category', i.category,
    'urgency', i.urgency, 'status', i.status, 'expires_at', l.expires_at,
    'events', coalesce((select jsonb_agg(jsonb_build_object('kind', e.kind, 'note', e.note, 'at', e.created_at) order by e.created_at)
                         from randapp.technician_events e where e.link_id = l.id and e.kind <> 'opened'), '[]'::jsonb));
end $$;

create or replace function randapp.portal_event(p_token text, p_kind text, p_note text)
returns boolean
language plpgsql security definer set search_path = randapp, pg_temp
as $$
declare l randapp.technician_links; v_note text := nullif(left(trim(coalesce(p_note, '')), 1000), '');
begin
  if p_kind not in ('arrival','started','note','completion_requested') then return false; end if;
  if p_kind = 'note' and v_note is null then return false; end if;
  select * into l from randapp.technician_links
   where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
     and revoked_at is null and expires_at > now();
  if l.id is null then return false; end if;
  if (select status from randapp.issues where id = l.issue_id) = 'completata' then return false; end if;
  insert into randapp.technician_events (hotel_id, issue_id, link_id, kind, note) values (l.hotel_id, l.issue_id, l.id, p_kind, v_note);
  return true;
end $$;

revoke all on function randapp.create_technician_link(text, uuid, uuid) from public, anon;
grant execute on function randapp.create_technician_link(text, uuid, uuid) to authenticated;
revoke all on function randapp.portal_get(text), randapp.portal_event(text, text, text) from public, anon, authenticated;
