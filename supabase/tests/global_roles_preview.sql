-- ESEGUIRE SOLO NEL DATABASE PREVIEW DI UNA PR, MAI IN PRODUZIONE.
-- Il test crea utenti sintetici in una transazione e termina SEMPRE con ROLLBACK.
-- Non usare account reali o credenziali. Se un assert fallisce la transazione abortisce.
BEGIN;

DO $test$
DECLARE
  global_id constant uuid := '00000000-0000-4000-8000-0000000000a1';
  local_id  constant uuid := '00000000-0000-4000-8000-0000000000a2';
  worker_id constant uuid := '00000000-0000-4000-8000-0000000000a3';
  n integer;
BEGIN
  -- Non eseguire se gli ID di prova fossero già occupati (per evitare di toccarli).
  IF EXISTS (SELECT 1 FROM auth.users WHERE id IN (global_id, local_id, worker_id)) THEN
    RAISE EXCEPTION 'ID di test già occupato: annullato';
  END IF;
  SELECT count(*) INTO n FROM randapp.hotels WHERE active;
  IF n < 2 THEN RAISE EXCEPTION 'Servono almeno due strutture attive'; END IF;

  INSERT INTO auth.users (id, aud, role)
  VALUES (global_id, 'authenticated', 'authenticated'),
         (local_id, 'authenticated', 'authenticated'),
         (worker_id, 'authenticated', 'authenticated');
  INSERT INTO randapp.profiles (auth_user_id, display_name)
  VALUES (global_id, 'TEST ADMIN GLOBALE'), (local_id, 'TEST ADMIN LOCALE'),
         (worker_id, 'TEST OPERATORE') ON CONFLICT (auth_user_id) DO NOTHING;

  INSERT INTO randapp.hotel_memberships (auth_user_id, hotel_id, role, active)
  SELECT global_id, id, 'admin', true FROM randapp.hotels WHERE active;

  INSERT INTO randapp.hotel_memberships (auth_user_id, hotel_id, role, active)
  VALUES (local_id, 'hotelgio', 'admin', true),
         (worker_id, 'hotelgio', 'manutentore', true);

  PERFORM set_config('request.jwt.claim.sub', global_id::text, true);
  IF NOT randapp.can_manage_global_roles('hotelgio') THEN
    RAISE EXCEPTION 'FAIL: admin globale senza autorizzazione';
  END IF;
  -- Scrittura in transazione rollback: verifica il percorso positivo dell'RPC.
  PERFORM randapp.admin_role_set('hotelgio', 'manutentore', 'issues.view', true);

  PERFORM set_config('request.jwt.claim.sub', local_id::text, true);
  IF NOT randapp.has_permission('hotelgio', 'admin.access') THEN
    RAISE EXCEPTION 'FAIL: admin locale non può amministrare il proprio hotel';
  END IF;
  IF randapp.can_manage_global_roles('hotelgio') THEN
    RAISE EXCEPTION 'FAIL: admin locale può cambiare ruoli globali';
  END IF;
  BEGIN
    PERFORM randapp.admin_role_set('hotelgio', 'manutentore', 'issues.view', false);
    RAISE EXCEPTION 'FAIL: modifica globale consentita ad admin locale';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- Atteso SQLSTATE 42501
  END;

  PERFORM set_config('request.jwt.claim.sub', worker_id::text, true);
  IF randapp.can_manage_global_roles('hotelgio') THEN
    RAISE EXCEPTION 'FAIL: operatore può cambiare ruoli globali';
  END IF;
  IF randapp.has_permission('chocohotel', 'issues.view') THEN
    RAISE EXCEPTION 'FAIL: operatore può leggere hotel non assegnato';
  END IF;
  IF NOT randapp.has_permission('hotelgio', 'issues.view') THEN
    RAISE EXCEPTION 'FAIL: operatore non può leggere proprio hotel';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', '', true);
  IF randapp.can_manage_global_roles('hotelgio') THEN
    RAISE EXCEPTION 'FAIL: utente senza sessione può cambiare ruoli globali';
  END IF;
  RAISE NOTICE 'PASS: admin globale, admin locale, operatore e anonimo';
END
$test$;

ROLLBACK;
