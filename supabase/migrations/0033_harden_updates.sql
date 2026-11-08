-- Harden UPDATE: hotel_id non modificabile dal browser; foto legate alla segnalazione corretta;
-- slot sale attivi senza doppioni esatti (stessa sala/giorno/turno).

-- ---------------------------------------------------------------- hotel_id immutabile (trigger su tabelle operative)
create or replace function randapp.forbid_hotel_id_change()
returns trigger
language plpgsql
set search_path = randapp, pg_temp
as $$
begin
  if new.hotel_id is distinct from old.hotel_id then
    raise exception using errcode = '42501', message = 'hotel_id non modificabile';
  end if;
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'issues','interventions','urgent_alerts','reminders',
    'hotel_locations','sale_rooms','sale_clients','sale_bookings','planning_works'
  ]
  loop
    execute format('drop trigger if exists %I_forbid_hotel on randapp.%I', t, t);
    execute format(
      'create trigger %I_forbid_hotel before update on randapp.%I
         for each row execute function randapp.forbid_hotel_id_change()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------- grant UPDATE a colonne (niente hotel_id / created_by / legacy)
revoke update on randapp.issues from authenticated;
grant update (
  title, description, category, urgency, status, room, assigned_to,
  completed_at, completed_by_name, completion_note, technician_name, part_replaced
) on randapp.issues to authenticated;

revoke update on randapp.interventions from authenticated;
grant update (
  title, location, notes, status, scheduled_at, scheduled_until, category,
  rooms, assignee_ids, assigned_to, issue_id, completed_at, completed_by_name
) on randapp.interventions to authenticated;

revoke update on randapp.urgent_alerts from authenticated;
grant update (status, taken_by, taken_at, resolved_at) on randapp.urgent_alerts to authenticated;

revoke update on randapp.reminders from authenticated;
grant update (
  message, target_roles, repeat_kind, weekdays, times, start_date, end_date, active
) on randapp.reminders to authenticated;

revoke update on randapp.hotel_locations from authenticated;
grant update (kind, name, group_name, aliases, sort_order, active) on randapp.hotel_locations to authenticated;

revoke update on randapp.sale_rooms from authenticated;
grant update (name, family, parts, capacity, sort_order, active) on randapp.sale_rooms to authenticated;

revoke update on randapp.sale_clients from authenticated;
grant update (name, preferred_room, preferred_layout, preferred_pax, notes) on randapp.sale_clients to authenticated;

-- ---------------------------------------------------------------- issue_photos: issue_id deve appartenere allo stesso hotel_id
drop policy if exists issue_photos_insert on randapp.issue_photos;
create policy issue_photos_insert on randapp.issue_photos
  for insert to authenticated
  with check (
    randapp.has_permission(hotel_id, 'issues.update')
    and exists (
      select 1 from randapp.issues i
      where i.id = issue_id and i.hotel_id = hotel_id
    )
  );

-- ---------------------------------------------------------------- prenotazioni sale: niente doppio slot attivo identico
-- (non copre giornata vs mattina/pomeriggio: resta il controllo in app)
create unique index if not exists sale_bookings_active_slot_uidx
  on randapp.sale_bookings (hotel_id, room, date_from, shift)
  where status = 'attiva';
