-- Ruoli della vecchia app che mancavano: Capo Governante, Portiere Notturno, Direttore Centro Congressi,
-- Tecnico esterno, Supremo, RandAI. Permessi ricavati dalla matrice della vecchia app (public.role_permissions):
--   * Capo Governante: matrice identica a Governante  -> stessi permessi di governante.
--   * Direttore Centro Congressi: come Direzione ma senza housekeeping.
--   * Portiere Notturno: come Reception, solo lettura su housekeeping/urgenti, senza planning sale, promemoria, sensori, magazzino.
--   * Tecnico esterno: vede segnalazioni, interventi e lavori; prende in carico e completa (aggiorna), non crea.
--   * Supremo: nella vecchia app solo "crea e vedi" su tutti i moduli, senza gestione.
--   * RandAI: sola lettura più magazzino (crea, sposta, gestisce); niente accesso admin.
-- Gli utenti si copiano a parte con supabase/seed/01_users_from_legacy_roles.sql (dopo conferma).

-- 1) Elenco dei ruoli ammessi
alter table randapp.hotel_memberships drop constraint if exists hotel_memberships_role_check;
alter table randapp.hotel_memberships add constraint hotel_memberships_role_check check (role in
  ('admin','direzione','responsabile','manutentore','governante','reception',
   'capo_governante','portiere_notturno','direttore_congressi','tecnico_esterno','supremo','randai'));

alter table randapp.reminders drop constraint if exists reminders_target_roles_check;
alter table randapp.reminders add constraint reminders_target_roles_check check (target_roles <@ array
  ['admin','direzione','responsabile','manutentore','governante','reception',
   'capo_governante','portiere_notturno','direttore_congressi','tecnico_esterno','supremo','randai']);

-- 2) Funzioni che hanno l'elenco dei ruoli scritto dentro: si riscrivono dalla definizione attuale.
--    I promemoria senza destinatari vanno a tutti i ruoli di personale, NON a Tecnico esterno e RandAI.
do $$
declare
  old_list constant text := '''admin'',''direzione'',''responsabile'',''manutentore'',''governante'',''reception''';
  staff_list constant text := old_list || ',''capo_governante'',''portiere_notturno'',''direttore_congressi'',''supremo''';
  full_list constant text := staff_list || ',''tecnico_esterno'',''randai''';
  f record; def text;
begin
  for f in
    select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'randapp'
       and (case when p.prokind = 'f' then pg_get_functiondef(p.oid) end) like '%' || old_list || '%'
  loop
    def := pg_get_functiondef(f.oid);
    -- "array[...]" = destinatari di default dei promemoria; "in (...)" = validazione di un ruolo
    if position('array[' || old_list || ']' in def) > 0 then
      def := replace(def, 'array[' || old_list || ']', 'array[' || staff_list || ']');
    else
      def := replace(def, old_list, full_list);
    end if;
    execute def;
  end loop;
end $$;

-- 3) Permessi dei nuovi ruoli
insert into randapp.role_permissions (role, permission)
select 'capo_governante', permission from randapp.role_permissions where role = 'governante'
on conflict do nothing;

insert into randapp.role_permissions (role, permission)
select 'direttore_congressi', permission from randapp.role_permissions
 where role = 'direzione' and permission not like 'housekeeping.%'
on conflict do nothing;

insert into randapp.role_permissions (role, permission) values
  ('portiere_notturno','housekeeping.view'), ('portiere_notturno','interventions.view'),
  ('portiere_notturno','issues.view'), ('portiere_notturno','issues.create'),
  ('portiere_notturno','planning_work.view'), ('portiere_notturno','presence.view'),
  ('portiere_notturno','presence.update'), ('portiere_notturno','urgent.view'),

  ('tecnico_esterno','interventions.view'), ('tecnico_esterno','interventions.update'),
  ('tecnico_esterno','issues.view'), ('tecnico_esterno','issues.update'),
  ('tecnico_esterno','planning_work.view'),

  ('supremo','housekeeping.view'), ('supremo','interventions.view'), ('supremo','interventions.create'),
  ('supremo','issues.view'), ('supremo','issues.create'), ('supremo','planning_sale.view'), ('supremo','planning_sale.create'),
  ('supremo','planning_work.view'), ('supremo','planning_work.create'), ('supremo','presence.view'),
  ('supremo','reminders.view'), ('supremo','reminders.create'), ('supremo','sensors.view'),
  ('supremo','supplies.view'), ('supremo','supplies.create'), ('supremo','urgent.view'), ('supremo','urgent.create'),
  ('supremo','warehouse.view'), ('supremo','warehouse.create'),

  ('randai','issues.view'), ('randai','planning_work.view'), ('randai','sensors.view'),
  ('randai','warehouse.view'), ('randai','warehouse.create'), ('randai','warehouse.move'), ('randai','warehouse.manage')
on conflict do nothing;
