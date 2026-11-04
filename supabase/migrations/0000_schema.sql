-- Schema dedicato della nuova app (RandApp). Il progetto Supabase "Apice MultiHotel" ospita anche la
-- vecchia app nello schema `public`: qui NIENTE viene creato né modificato in `public`.
-- Utenti (auth.users) e Storage sono condivisi; tutte le tabelle e le funzioni della nuova app stanno in `randapp`.
create schema if not exists randapp;
revoke all on schema randapp from public;
grant usage on schema randapp to authenticated, service_role;
