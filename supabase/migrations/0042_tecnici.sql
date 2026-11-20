-- 0042 — Sezione Tecnici (tecnici esterni di ogni struttura), come nella vecchia RandApp.
-- Elenco per struttura con numero, azienda, competenze; assegnazione alla segnalazione.
-- Lettura: technicians.view (include il numero, serve per scrivere al tecnico). Scrittura: solo tramite
-- le funzioni sotto, con technicians.manage. Mai cancellazioni dal browser (STANDARD §6.3): si disattiva.
-- Solo schema randapp: non si tocca `public` (vecchia app).

create table randapp.technician_competencies (
  id     uuid primary key default gen_random_uuid(),
  code   text not null unique,
  label  text not null,
  active boolean not null default true
);
insert into randapp.technician_competencies (code, label) values
  ('fire_safety','Antincendio / Sicurezza'), ('lifts','Ascensori'), ('appliances','Attrezzature / Elettrodomestici'),
  ('hvac','Climatizzazione / HVAC'), ('electrical','Elettrico'), ('carpentry','Falegnameria'),
  ('plumbing','Idraulica'), ('refrigeration','Refrigerazione'), ('it_network','Rete / IT'),
  ('locks_access','Serrature / Accessi');

create table randapp.external_technicians (
  id         uuid primary key default gen_random_uuid(),
  hotel_id   text not null references randapp.hotels (id),
  name       text not null check (char_length(name) between 1 and 80),
  phone      text not null check (phone ~ '^\+[0-9]{8,15}$'),
  company    text check (company is null or char_length(company) <= 80),
  email      text check (email is null or char_length(email) <= 120),
  notes      text check (notes is null or char_length(notes) <= 500),
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index external_technicians_hotel_idx on randapp.external_technicians (hotel_id, active, name);

create table randapp.external_technician_competencies (
  technician_id uuid not null references randapp.external_technicians (id),
  competency_id uuid not null references randapp.technician_competencies (id),
  primary key (technician_id, competency_id)
);

-- Permessi (come i ruoli della vecchia app: gestiscono Direzione, Direttore congressi, Reception, Admin).
insert into randapp.role_permissions (role, permission) values
  ('admin','technicians.manage'), ('direzione','technicians.manage'),
  ('direttore_congressi','technicians.manage'), ('reception','technicians.manage'),
  ('admin','technicians.view'), ('direzione','technicians.view'), ('direttore_congressi','technicians.view'),
  ('reception','technicians.view'), ('responsabile','technicians.view'), ('manutentore','technicians.view')
on conflict do nothing;

alter table randapp.technician_competencies          enable row level security;
alter table randapp.external_technicians             enable row level security;
alter table randapp.external_technician_competencies enable row level security;

create policy technician_competencies_read on randapp.technician_competencies
  for select to authenticated using (active);
create policy external_technicians_read on randapp.external_technicians
  for select to authenticated using (randapp.has_permission(hotel_id, 'technicians.view'));
create policy external_technician_competencies_read on randapp.external_technician_competencies
  for select to authenticated using (exists (
    select 1 from randapp.external_technicians t
    where t.id = technician_id and randapp.has_permission(t.hotel_id, 'technicians.view')));

revoke all on randapp.technician_competencies, randapp.external_technicians, randapp.external_technician_competencies from anon, authenticated;
grant select on randapp.technician_competencies, randapp.external_technicians, randapp.external_technician_competencies to authenticated;

-- Nuovo tecnico o modifica (p_id null = nuovo). Il numero si accetta con spazi e senza «+» davanti per l'Italia.
create or replace function randapp.manage_technician(
  p_hotel text, p_id uuid, p_name text, p_phone text, p_company text, p_email text, p_notes text, p_active boolean)
returns uuid
language plpgsql security definer set search_path = randapp, pg_temp
as $$
declare
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g');
  v_id uuid;
begin
  if not randapp.has_permission(p_hotel, 'technicians.manage') then raise exception 'Non autorizzato'; end if;
  if v_phone !~ '^\+' then v_phone := '+39' || regexp_replace(v_phone, '^(00)?39', ''); end if;
  if v_phone !~ '^\+[0-9]{8,15}$' then raise exception 'Numero non valido'; end if;
  if nullif(trim(coalesce(p_name, '')), '') is null then raise exception 'Scrivi il nome'; end if;
  if p_id is null then
    insert into randapp.external_technicians (hotel_id, name, phone, company, email, notes, active)
    values (p_hotel, trim(p_name), v_phone, nullif(trim(coalesce(p_company, '')), ''), nullif(trim(coalesce(p_email, '')), ''),
            nullif(trim(coalesce(p_notes, '')), ''), coalesce(p_active, true))
    returning id into v_id;
  else
    update randapp.external_technicians
       set name = trim(p_name), phone = v_phone, company = nullif(trim(coalesce(p_company, '')), ''),
           email = nullif(trim(coalesce(p_email, '')), ''), notes = nullif(trim(coalesce(p_notes, '')), ''),
           active = coalesce(p_active, true), updated_at = now()
     where id = p_id and hotel_id = p_hotel
     returning id into v_id;
    if v_id is null then raise exception 'Tecnico non trovato'; end if;
  end if;
  return v_id;
end $$;

create or replace function randapp.set_technician_competencies(p_hotel text, p_technician uuid, p_competencies uuid[])
returns void
language plpgsql security definer set search_path = randapp, pg_temp
as $$
begin
  if not randapp.has_permission(p_hotel, 'technicians.manage') then raise exception 'Non autorizzato'; end if;
  if not exists (select 1 from randapp.external_technicians where id = p_technician and hotel_id = p_hotel) then
    raise exception 'Tecnico non trovato';
  end if;
  delete from randapp.external_technician_competencies where technician_id = p_technician;
  insert into randapp.external_technician_competencies (technician_id, competency_id)
  select p_technician, id from randapp.technician_competencies
   where id = any (coalesce(p_competencies, '{}'::uuid[])) and active;
end $$;

revoke all on function randapp.manage_technician(text, uuid, text, text, text, text, text, boolean) from public, anon;
revoke all on function randapp.set_technician_competencies(text, uuid, uuid[]) from public, anon;
grant execute on function randapp.manage_technician(text, uuid, text, text, text, text, text, boolean) to authenticated;
grant execute on function randapp.set_technician_competencies(text, uuid, uuid[]) to authenticated;

-- Segnalazione: tecnico scelto dall'elenco (il nome resta in technician_name come per le righe importate).
alter table randapp.issues add column if not exists technician_id uuid references randapp.external_technicians (id);
grant update (technician_id) on randapp.issues to authenticated;

-- Il tecnico di una segnalazione deve essere della stessa struttura.
create or replace function randapp.issue_technician_same_hotel()
returns trigger language plpgsql as $$
begin
  if new.technician_id is not null and not exists (
    select 1 from randapp.external_technicians t where t.id = new.technician_id and t.hotel_id = new.hotel_id) then
    raise exception 'Tecnico di un''altra struttura';
  end if;
  return new;
end $$;
create trigger issues_technician_same_hotel before insert or update of technician_id on randapp.issues
  for each row execute function randapp.issue_technician_same_hotel();
