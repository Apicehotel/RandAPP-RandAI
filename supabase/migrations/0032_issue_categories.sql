-- Categorie delle segnalazioni come nella vecchia app: "edilizio" non va più in "Altro" ma in "Edilizio"
-- (prima la funzione lo comprimeva in Altro; gli interventi avevano già la mappa completa in legacy-sync/ops.ts).
create or replace function randapp.legacy_category(p text)
returns text language sql immutable set search_path = randapp, pg_temp as $$
  select case p when 'idraulico' then 'Idraulica' when 'elettrico' then 'Elettrico'
                when 'clima' then 'Climatizzazione' when 'arredo' then 'Arredi'
                when 'edilizio' then 'Edilizio'
                else 'Altro' end;
$$;
revoke all on function randapp.legacy_category(text) from public, anon, authenticated;
