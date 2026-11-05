-- Copia gli utenti della vecchia app (schema public) nella nuova (schema randapp), SOLO per i ruoli che si mappano chiaramente.
-- Profili, appartenenze e hash dei PIN restano dentro il database: nessun PIN o hash passa da qui.
-- Ruoli non copiati (da decidere): RandAI, Portiere Notturno, Capo Governante, Tecnico esterno, Supremo, Direttore Centro Congressi.
-- Ripetibile. Eseguito il 2026-11-04: 21 profili, 30 appartenenze, 21 credenziali.
with map(old_role, new_role) as (values
  ('admin','admin'),('Direzione','direzione'),('Reception','reception'),('Governante','governante'),('manutentore','manutentore')),
src as (
  select m.auth_user_id, m.hotel_id, mp.new_role, m.active
  from public.hotel_memberships m
  join map mp on mp.old_role = m.role
  join public.profiles p on p.auth_user_id = m.auth_user_id
  where p.active
),
ins_p as (
  insert into randapp.profiles (auth_user_id, display_name, active)
  select distinct p.auth_user_id, p.display_name, p.active
  from public.profiles p where p.auth_user_id in (select auth_user_id from src)
  on conflict (auth_user_id) do nothing
  returning 1
),
ins_m as (
  insert into randapp.hotel_memberships (auth_user_id, hotel_id, role, active)
  select auth_user_id, hotel_id, new_role, active from src
  where exists (select 1 from randapp.hotels h where h.id = src.hotel_id)
  on conflict (auth_user_id, hotel_id) do nothing
  returning 1
),
ins_c as (
  insert into randapp.auth_pin_credentials (auth_user_id, pin_hash, failed_attempts, locked_until, must_change_pin)
  select c.auth_user_id, c.pin_hash, 0, null, c.must_change_pin
  from public.auth_pin_credentials c where c.auth_user_id in (select auth_user_id from src)
  on conflict (auth_user_id) do nothing
  returning 1
)
select (select count(*) from ins_p) profiles, (select count(*) from ins_m) memberships, (select count(*) from ins_c) credentials;
