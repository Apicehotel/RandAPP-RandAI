-- Presenza: chi c'è in struttura adesso. Check-in/check-out manuale (niente GPS).
-- Nome e ruolo si copiano sul server dall'utente collegato: il browser non li può falsificare.

insert into randapp.role_permissions (role, permission)
select r.role, p.permission
from (values ('admin'),('direzione'),('responsabile'),('manutentore'),('governante'),('reception')) as r(role)
cross join (values ('presence.view'),('presence.update')) as p(permission)
on conflict do nothing;

create table randapp.presence (
  hotel_id     text not null references randapp.hotels (id),
  user_id      uuid not null references auth.users (id) on delete cascade,
  display_name text not null,
  role         text not null,
  present      boolean not null default true,
  since        timestamptz not null default now(),
  primary key (hotel_id, user_id)
);
create index presence_hotel_idx on randapp.presence (hotel_id, present, since);

alter table randapp.presence enable row level security;

create policy presence_select on randapp.presence
  for select to authenticated using (randapp.has_permission(hotel_id, 'presence.view'));

-- Nessuna policy di insert/update/delete e nessun grant di scrittura: si scrive solo con set_presence().
revoke all on randapp.presence from anon, authenticated;
grant select on randapp.presence to authenticated;

create or replace function randapp.set_presence(p_hotel text, p_present boolean)
returns randapp.presence
language plpgsql security definer set search_path = randapp
as $$
declare
  v_name text;
  v_role text;
  v_row  randapp.presence;
begin
  if auth.uid() is null or not randapp.has_permission(p_hotel, 'presence.update') then
    raise exception 'non autorizzato' using errcode = '42501';
  end if;

  select p.display_name, m.role into v_name, v_role
  from randapp.profiles p
  join randapp.hotel_memberships m on m.auth_user_id = p.auth_user_id
  where p.auth_user_id = auth.uid() and m.hotel_id = p_hotel and m.active;

  -- Come la vecchia app: si è "in struttura" in UNA struttura alla volta.
  if p_present then
    update randapp.presence set present = false where user_id = auth.uid() and hotel_id <> p_hotel and present;
  end if;

  insert into randapp.presence as t (hotel_id, user_id, display_name, role, present, since)
  values (p_hotel, auth.uid(), v_name, v_role, p_present, now())
  on conflict (hotel_id, user_id) do update
    set display_name = excluded.display_name,
        role         = excluded.role,
        present      = excluded.present,
        since        = case when t.present = excluded.present then t.since else now() end
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function randapp.set_presence(text, boolean) from public, anon;
grant execute on function randapp.set_presence(text, boolean) to authenticated;
