-- Funzioni trigger con search_path fissato (avviso di sicurezza di Supabase).
alter function randapp.touch_updated_at() set search_path = randapp, pg_temp;
alter function randapp.sale_booking_sync_checks() set search_path = randapp, pg_temp;
