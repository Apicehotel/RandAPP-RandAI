-- RandApp: schema di base multi-hotel.
-- Da applicare SOLO a un progetto Supabase nuovo/separato. Non toccare i database esistenti.
-- Regole: ogni record operativo ha hotel_id; RLS attiva su ogni tabella; nessun segreto qui dentro.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- strutture
create table public.hotels (
  id     text primary key,
  name   text not null,
  active boolean not null default true
);

insert into public.hotels (id, name) values
  ('hotelgio',   'Hotel Giò'),
  ('chocohotel', 'Choco Hotel'),
  ('brigantino', 'Hotel Il Brigantino');

-- ---------------------------------------------------------------- identità
create table public.profiles (
  auth_user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create table public.hotel_memberships (
  auth_user_id uuid not null references public.profiles (auth_user_id) on delete cascade,
  hotel_id     text not null references public.hotels (id),
  role         text not null check (role in
                 ('admin','direzione','responsabile','manutentore','governante','reception')),
  active       boolean not null default true,
  primary key (auth_user_id, hotel_id)
);

-- Credenziali PIN: solo server (nessuna policy, nessun grant al browser).
create table public.auth_pin_credentials (
  auth_user_id    uuid primary key references auth.users (id) on delete cascade,
  pin_hash        text not null,
  failed_attempts integer not null default 0,
  locked_until    timestamptz,
  must_change_pin boolean not null default false,
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------- permessi
create table public.role_permissions (
  role       text not null,
  permission text not null,
  primary key (role, permission)
);

insert into public.role_permissions (role, permission) values
  ('admin','issues.view'), ('admin','issues.create'), ('admin','issues.update'),
  ('admin','issues.assign'), ('admin','admin.access'),
  ('direzione','issues.view'), ('direzione','issues.create'),
  ('direzione','issues.update'), ('direzione','issues.assign'),
  ('responsabile','issues.view'), ('responsabile','issues.create'),
  ('responsabile','issues.update'), ('responsabile','issues.assign'),
  ('manutentore','issues.view'), ('manutentore','issues.create'), ('manutentore','issues.update'),
  ('governante','issues.view'), ('governante','issues.create'),
  ('reception','issues.view'), ('reception','issues.create');

-- ---------------------------------------------------------------- helper di autorizzazione
create or replace function public.is_hotel_member(p_hotel text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.hotel_memberships m
    where m.auth_user_id = auth.uid() and m.hotel_id = p_hotel and m.active
  );
$$;

create or replace function public.has_permission(p_hotel text, p_permission text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.hotel_memberships m
    join public.role_permissions rp on rp.role = m.role
    where m.auth_user_id = auth.uid()
      and m.hotel_id = p_hotel
      and m.active
      and rp.permission = p_permission
  );
$$;

revoke all on function public.is_hotel_member(text) from public, anon;
revoke all on function public.has_permission(text, text) from public, anon;
grant execute on function public.is_hotel_member(text) to authenticated;
grant execute on function public.has_permission(text, text) to authenticated;

-- ---------------------------------------------------------------- segnalazioni
create table public.issues (
  id           uuid primary key default gen_random_uuid(),
  hotel_id     text not null references public.hotels (id),
  title        text not null check (char_length(title) between 1 and 140),
  description  text check (description is null or char_length(description) <= 2000),
  category     text not null default 'Altro',
  urgency      text not null default 'normale'
                 check (urgency in ('bassa','normale','alta','urgente')),
  status       text not null default 'da_fare'
                 check (status in ('da_fare','tecnico','attesa_pezzo','completata')),
  room         text check (room is null or char_length(room) <= 40),
  created_by   uuid not null references auth.users (id),
  assigned_to  uuid references auth.users (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  completed_at timestamptz
);

create index issues_hotel_status_idx on public.issues (hotel_id, status, urgency, created_at);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger issues_touch before update on public.issues
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- RLS su OGNI tabella
alter table public.hotels               enable row level security;
alter table public.profiles             enable row level security;
alter table public.hotel_memberships    enable row level security;
alter table public.auth_pin_credentials enable row level security;
alter table public.role_permissions     enable row level security;
alter table public.issues               enable row level security;

-- Tabelle di servizio: nessun accesso dal browser.
revoke all on public.auth_pin_credentials from anon, authenticated;

-- Lettura minima per far funzionare l'app dopo il login.
create policy hotels_read on public.hotels
  for select to authenticated using (active);

create policy profiles_read_own on public.profiles
  for select to authenticated using (auth_user_id = auth.uid());

create policy memberships_read_own on public.hotel_memberships
  for select to authenticated using (auth_user_id = auth.uid());

create policy role_permissions_read on public.role_permissions
  for select to authenticated using (true);

-- Segnalazioni: sempre dentro la propria struttura e con il permesso giusto.
create policy issues_select on public.issues
  for select to authenticated using (public.has_permission(hotel_id, 'issues.view'));

create policy issues_insert on public.issues
  for insert to authenticated
  with check (public.has_permission(hotel_id, 'issues.create') and created_by = auth.uid());

create policy issues_update on public.issues
  for update to authenticated
  using (public.has_permission(hotel_id, 'issues.update'))
  with check (public.has_permission(hotel_id, 'issues.update'));

-- Nessuna policy di DELETE: le segnalazioni non si cancellano dal browser.

revoke all on public.issues, public.hotels, public.profiles,
              public.hotel_memberships, public.role_permissions from anon;
grant select, insert, update on public.issues to authenticated;
grant select on public.hotels, public.profiles,
                public.hotel_memberships, public.role_permissions to authenticated;
