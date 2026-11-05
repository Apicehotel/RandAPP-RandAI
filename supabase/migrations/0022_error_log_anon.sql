-- Prima del login (anon) l'app deve poter scrivere nel registro errori. Serve USAGE sullo schema randapp.
-- Sicurezza: anon non ha nessun permesso su tabelle di randapp (verificato) e qui chiudo anche l'EXECUTE
-- che le funzioni dei trigger avevano per default (i trigger non lo richiedono per scattare).
-- Resta eseguibile da anon solo log_client_error().
revoke execute on function randapp.sale_booking_sync_checks(), randapp.touch_updated_at(),
  randapp.trg_notify_intervention(), randapp.trg_notify_issue(), randapp.trg_notify_urgent_alert(), randapp.trg_notify_work()
  from public, anon;
grant usage on schema randapp to anon;
