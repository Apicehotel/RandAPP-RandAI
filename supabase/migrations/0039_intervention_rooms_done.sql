-- 0039 — Segnare le camere di un intervento come fatte (dettaglio intervento)
-- Il browser non può scrivere rooms_done (0033: solo colonne elencate). Questa funzione lo fa in modo atomico:
-- più persone possono segnare camere insieme senza sovrascriversi (si unisce la mappa sul server, riga bloccata).
-- Permesso: interventions.update della struttura. Il nome di chi segna viene dal profilo, non dal browser.
-- La prima camera segnata porta "da fare" a "in corso". Il completamento resta manuale.
-- Solo schema randapp: non si tocca `public` (vecchia app).

create or replace function randapp.set_intervention_rooms(p_hotel text, p_id uuid, p_rooms text[], p_done boolean)
returns jsonb
language plpgsql
security definer
set search_path = randapp, pg_temp
as $$
declare
  v_row randapp.interventions%rowtype;
  v_name text;
  v_map jsonb;
  v_room text;
  v_at text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
  if auth.uid() is null or not randapp.has_permission(p_hotel, 'interventions.update') then
    raise exception using errcode = '42501', message = 'non autorizzato';
  end if;
  if p_rooms is null or cardinality(p_rooms) = 0 or cardinality(p_rooms) > 300 then
    raise exception using errcode = '22023', message = 'camere non valide';
  end if;

  select * into v_row from randapp.interventions where id = p_id and hotel_id = p_hotel for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'intervento non trovato';
  end if;

  select left(coalesce(display_name, ''), 80) into v_name from randapp.profiles where auth_user_id = auth.uid();
  v_map := case when jsonb_typeof(v_row.rooms_done) = 'object' then v_row.rooms_done else '{}'::jsonb end;

  foreach v_room in array p_rooms loop
    continue when not (v_room = any (v_row.rooms));   -- solo camere di questo intervento
    if p_done then
      v_map := v_map || jsonb_build_object(v_room, jsonb_build_object('by', v_name, 'at', v_at));
    else
      v_map := v_map - v_room;
    end if;
  end loop;

  update randapp.interventions
     set rooms_done = v_map,
         status = case when v_row.status = 'da_fare' and v_map <> '{}'::jsonb then 'in_corso' else v_row.status end
   where id = p_id;
  return v_map;
end;
$$;

revoke all on function randapp.set_intervention_rooms(text, uuid, text[], boolean) from public, anon;
grant execute on function randapp.set_intervention_rooms(text, uuid, text[], boolean) to authenticated;
