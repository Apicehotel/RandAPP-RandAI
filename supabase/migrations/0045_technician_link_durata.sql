-- 0045 — Durata del link del tecnico: 72 ore per fissare l'appuntamento; fissato, il link resta attivo
-- fino a 15 giorni dall'inizio intervento (se «Inizia» non viene premuto: 15 giorni dall'appuntamento).
-- La segnalazione chiusa non accetta più azioni. Il personale può annullare il link in qualsiasi momento.

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
    update randapp.technician_links set expires_at = greatest(expires_at, p_arrival + interval '15 days') where id = l.id;
  elsif p_kind = 'started' then
    update randapp.technician_links set expires_at = greatest(expires_at, now() + interval '15 days') where id = l.id;
  end if;
  return true;
end $$;

-- Personale: annulla i link attivi della segnalazione. Restituisce quanti ne ha annullati.
create or replace function randapp.revoke_technician_links(p_hotel text, p_issue uuid)
returns integer
language plpgsql security definer set search_path = randapp, pg_temp
as $$
declare n integer;
begin
  if not randapp.has_permission(p_hotel, 'issues.update') then raise exception 'Non autorizzato'; end if;
  update randapp.technician_links set revoked_at = now()
   where issue_id = p_issue and hotel_id = p_hotel and revoked_at is null;
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function randapp.portal_event(text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function randapp.revoke_technician_links(text, uuid) from public, anon;
grant execute on function randapp.revoke_technician_links(text, uuid) to authenticated;
