-- 0036 — Cestino di 7 giorni
-- Ogni riga cancellata dalle tabelle operative (segnalazioni, foto, interventi, planning lavori e
-- giorni, prenotazioni sale, richieste di rifornimento, avvisi urgenti, promemoria) resta per 7 giorni
-- in randapp.cestino; poi un job pg_cron la elimina per sempre.
-- Dal browser non si cancella gia' nulla (STANDARD §6.3): questa rete protegge da cancellazioni
-- fatte da SQL, da funzioni edge o da strumenti di amministrazione.
-- La tabella non e' leggibile dall'app (RLS attiva, nessuna policy, nessun grant).
-- Ripristino da SQL: select randapp.ripristina_dal_cestino(<id voce>);
-- Solo schema randapp: non si tocca `public` (vecchia app).

create table if not exists randapp.cestino (
  id           bigint generated always as identity primary key,
  tabella      text        not null,
  riga_id      text,
  dati         jsonb       not null,
  eliminato_il timestamptz not null default now(),
  operazione   bigint      not null default txid_current()
);
create index if not exists cestino_eliminato_il_idx on randapp.cestino (eliminato_il);
create index if not exists cestino_operazione_idx   on randapp.cestino (operazione);
alter table randapp.cestino enable row level security;
revoke all on randapp.cestino from anon, authenticated;

create or replace function randapp.cestino_salva()
returns trigger
language plpgsql
security definer
set search_path = randapp, pg_temp
as $$
begin
  insert into randapp.cestino (tabella, riga_id, dati)
  values (tg_table_name, to_jsonb(old) ->> 'id', to_jsonb(old));
  return old;
end $$;
revoke all on function randapp.cestino_salva() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'issues','issue_photos','interventions','planning_works','planning_work_days',
    'sale_bookings','supply_requests','supply_request_items','urgent_alerts','reminders'
  ] loop
    execute format(
      'create or replace trigger cestino_salva before delete on randapp.%I for each row execute function randapp.cestino_salva()', t);
  end loop;
end $$;

-- Ripristina la voce indicata e tutte quelle cancellate nella stessa operazione, prima le tabelle
-- "madre" poi le "figlie". I trigger della tabella (notifiche, giorni automatici) vengono sospesi
-- solo durante l'inserimento, cosi' il ripristino non rimanda avvisi ne' duplica i giorni.
-- Restituisce il numero di righe rimesse a posto.
create or replace function randapp.ripristina_dal_cestino(p_id bigint)
returns integer
language plpgsql
security definer
set search_path = randapp, pg_temp
as $$
declare
  v_op bigint;
  r    record;
  n    integer := 0;
begin
  select operazione into v_op from randapp.cestino where id = p_id;
  if v_op is null then
    raise exception 'Voce del cestino % non trovata', p_id;
  end if;
  for r in
    select * from randapp.cestino
    where operazione = v_op
    order by array_position(
      array['issues','planning_works','supply_requests','reminders','sale_bookings','interventions',
            'planning_work_days','issue_photos','supply_request_items','urgent_alerts'],
      tabella::text), id
  loop
    execute format('alter table randapp.%I disable trigger user', r.tabella);
    execute format(
      'insert into randapp.%I select * from jsonb_populate_record(null::randapp.%I, $1) on conflict do nothing',
      r.tabella, r.tabella) using r.dati;
    execute format('alter table randapp.%I enable trigger user', r.tabella);
    delete from randapp.cestino where id = r.id;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function randapp.ripristina_dal_cestino(bigint) from public, anon, authenticated;

-- Svuotamento: ogni notte alle 03:40 UTC si eliminano per sempre le voci con piu' di 7 giorni.
-- cron.schedule con lo stesso nome aggiorna il job esistente (nessun doppione).
select cron.schedule(
  'randapp-cestino-7-giorni',
  '40 3 * * *',
  $job$delete from randapp.cestino where eliminato_il < now() - interval '7 days'$job$
);
