-- 0037 — Schermata Cestino (Impostazioni > Cestino)
-- Funzioni per elencare, ripristinare, eliminare per sempre e svuotare il cestino (randapp.cestino, 0036).
-- Solo chi ha il permesso admin.access della struttura; si vedono e si toccano solo le voci di quella struttura
-- (hotel_id dentro la riga cancellata). Le foto non vengono mai restituite.
-- Solo schema randapp: non si tocca `public` (vecchia app).

create or replace function randapp.cestino_elenco(p_hotel text)
returns table (id bigint, tabella text, titolo text, dettaglio text, righe integer, eliminato_il timestamptz, scade_il timestamptz)
language plpgsql
stable
security definer
set search_path = randapp, pg_temp
as $$
begin
  if not randapp.has_permission(p_hotel, 'admin.access') then
    raise exception using errcode = '42501', message = 'non autorizzato';
  end if;
  return query
  with mie as (
    select c.* from randapp.cestino c
    where c.eliminato_il > now() - interval '7 days'
      and c.operazione in (select operazione from randapp.cestino where dati ->> 'hotel_id' = p_hotel)
  ), ord as (
    select m.*,
      row_number() over (partition by m.operazione order by
        array_position(array['issues','planning_works','supply_requests','reminders','sale_bookings','interventions',
          'planning_work_days','issue_photos','supply_request_items','urgent_alerts'], m.tabella::text), m.id) rn,
      count(*) over (partition by m.operazione) n
    from mie m
  )
  select o.id, o.tabella::text,
    case o.tabella::text
      when 'issues' then o.dati ->> 'title'
      when 'interventions' then o.dati ->> 'title'
      when 'planning_works' then o.dati ->> 'description'
      when 'sale_bookings' then o.dati ->> 'client'
      when 'reminders' then o.dati ->> 'message'
      when 'urgent_alerts' then o.dati ->> 'note'
      when 'supply_requests' then coalesce(o.dati ->> 'note', 'Richiesta di rifornimento')
      when 'supply_request_items' then o.dati ->> 'product_name'
      when 'planning_work_days' then 'Giorno ' || (o.dati ->> 'day')
      when 'issue_photos' then 'Foto di una segnalazione'
    end,
    case o.tabella::text
      when 'issues' then o.dati ->> 'room'
      when 'interventions' then o.dati ->> 'location'
      when 'sale_bookings' then (o.dati ->> 'room') || ' - ' || (o.dati ->> 'date_from')
      else null
    end,
    o.n::integer, o.eliminato_il, o.eliminato_il + interval '7 days'
  from ord o where o.rn = 1
  order by o.eliminato_il desc;
end $$;

-- Controllo comune: la voce esiste ed e' di questa struttura.
create or replace function randapp.cestino_controlla(p_hotel text, p_id bigint)
returns bigint
language plpgsql
stable
security definer
set search_path = randapp, pg_temp
as $$
declare v_op bigint;
begin
  if not randapp.has_permission(p_hotel, 'admin.access') then
    raise exception using errcode = '42501', message = 'non autorizzato';
  end if;
  select c.operazione into v_op from randapp.cestino c
   where c.id = p_id
     and c.operazione in (select operazione from randapp.cestino where dati ->> 'hotel_id' = p_hotel);
  if v_op is null then
    raise exception using errcode = 'P0002', message = 'Voce del cestino non trovata';
  end if;
  return v_op;
end $$;

create or replace function randapp.cestino_ripristina(p_hotel text, p_id bigint)
returns integer
language plpgsql
security definer
set search_path = randapp, pg_temp
as $$
begin
  perform randapp.cestino_controlla(p_hotel, p_id);
  return randapp.ripristina_dal_cestino(p_id);
end $$;

create or replace function randapp.cestino_elimina(p_hotel text, p_id bigint)
returns integer
language plpgsql
security definer
set search_path = randapp, pg_temp
as $$
declare v_op bigint; n integer;
begin
  v_op := randapp.cestino_controlla(p_hotel, p_id);
  delete from randapp.cestino where operazione = v_op;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function randapp.cestino_svuota(p_hotel text)
returns integer
language plpgsql
security definer
set search_path = randapp, pg_temp
as $$
declare n integer;
begin
  if not randapp.has_permission(p_hotel, 'admin.access') then
    raise exception using errcode = '42501', message = 'non autorizzato';
  end if;
  delete from randapp.cestino
   where operazione in (select operazione from randapp.cestino where dati ->> 'hotel_id' = p_hotel);
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function randapp.cestino_elenco(text), randapp.cestino_controlla(text, bigint),
  randapp.cestino_ripristina(text, bigint), randapp.cestino_elimina(text, bigint),
  randapp.cestino_svuota(text) from public, anon;
revoke all on function randapp.cestino_controlla(text, bigint) from authenticated;
grant execute on function randapp.cestino_elenco(text), randapp.cestino_ripristina(text, bigint),
  randapp.cestino_elimina(text, bigint), randapp.cestino_svuota(text) to authenticated;
