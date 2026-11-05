-- Le segnalazioni importate da WhatsApp o di persone non riconosciute non hanno un utente autore.
-- Dall'app resta obbligatorio: la policy issues_insert richiede created_by = auth.uid().
alter table randapp.issues alter column created_by drop not null;
