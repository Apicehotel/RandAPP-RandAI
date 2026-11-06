-- Accesso alle Impostazioni con il PIN amministratore a 6 cifre (come la vecchia app: nessun nome, un solo PIN).
-- Il PIN vive già in public.edge_function_secrets (chiave ADMIN_PANEL_PIN_BCRYPT, solo bcrypt): qui non si copia né si legge dal browser.
-- Questa tabella conta i tentativi sbagliati per origine (hash di IP + dispositivo): 5 errori = blocco 10 minuti. Solo server.
create table randapp.admin_gate_attempts (
  source_hash     text primary key,
  failed_attempts integer not null default 0,
  locked_until    timestamptz,
  updated_at      timestamptz not null default now()
);
alter table randapp.admin_gate_attempts enable row level security;
revoke all on randapp.admin_gate_attempts from anon, authenticated;
