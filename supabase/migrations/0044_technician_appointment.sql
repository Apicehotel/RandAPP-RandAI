-- 0044 — Appuntamento del tecnico (come «Comunica quando arrivi» della vecchia app: data e ora).
-- Il tecnico fissa/cambia l'orario dal suo link; resta sulla segnalazione (issues.appointment_at) e negli eventi.
-- Il link dura fino a 12 ore dopo l'appuntamento. Colonna scritta solo da portal_event (security definer).

alter table randapp.issues add column if not exists appointment_at timestamptz;
alter table randapp.technician_events add column if not exists arrival_at timestamptz;
alter table randapp.technician_events drop constraint technician_events_kind_check;
alter table randapp.technician_events add constraint technician_events_kind_check
  check (kind in ('opened','arrival','arrival_set','started','note','completion_requested'));

drop function randapp.portal_event(text, text, text);
create or replace function randapp.portal_event(p_token text, p_kind text, p_note text, p_arrival timestamptz default null)
returns boolean
language plpgsql security definer set search_path = randapp, pg_temp
as $$
declare l randapp.technician_links; v_note text := nullif(left(trim(coalesce(p_note, '')), 1000), '');
begin
  if p_kind not in ('arrival_set','started','note','completion_requested') then return false; end if;
  if p_kind = 'note' and v_note is null then return false; end if;
  if p_kind = 'arrival_set' and (p_arrival is null or p_arrival < now() - interval '1 hour' or p_arrival > now() + interval '60 days') then return false; end if;
  select * into l from randapp.technician_links
   where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
     and revoked_at is null and expires_at > now();
  if l.id is null then return false; end if;
  if (select status from randapp.issues where id = l.issue_id) = 'completata' then return false; end if;
  insert into randapp.technician_events (hotel_id, issue_id, link_id, kind, note, arrival_at)
  values (l.hotel_id, l.issue_id, l.id, p_kind, v_note, case when p_kind = 'arrival_set' then p_arrival end);
  if p_kind = 'arrival_set' then
    update randapp.issues set appointment_at = p_arrival where id = l.issue_id;
    update randapp.technician_links set expires_at = greatest(expires_at, p_arrival + interval '12 hours') where id = l.id;
  end if;
  return true;
end $$;

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
    'urgency', i.urgency, 'status', i.status, 'expires_at', l.expires_at, 'appointment_at', i.appointment_at,
    'events', coalesce((select jsonb_agg(jsonb_build_object('kind', e.kind, 'note', e.note, 'at', e.created_at, 'arrival_at', e.arrival_at) order by e.created_at)
                         from randapp.technician_events e where e.link_id = l.id and e.kind <> 'opened'), '[]'::jsonb));
end $$;

revoke all on function randapp.portal_get(text), randapp.portal_event(text, text, text, timestamptz) from public, anon, authenticated;
