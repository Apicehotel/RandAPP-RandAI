-- Correzione incrementale della policy foto: le migrazioni già registrate
-- non vengono rieseguite dalle preview Supabase quando cambia il relativo file.
-- La 0033 può essere già presente nella cronologia del database della preview.
-- Questa migrazione applica esplicitamente la stessa protezione senza toccare public.
--
-- L'utente deve avere issues.update nell'hotel della foto e la segnalazione
-- collegata deve appartenere esattamente a quello stesso hotel.
drop policy if exists issue_photos_insert on randapp.issue_photos;
create policy issue_photos_insert on randapp.issue_photos
  for insert to authenticated
  with check (
    randapp.has_permission(issue_photos.hotel_id, 'issues.update')
    and exists (
      select 1
      from randapp.issues i
      where i.id = issue_photos.issue_id
        and i.hotel_id = issue_photos.hotel_id
    )
  );
