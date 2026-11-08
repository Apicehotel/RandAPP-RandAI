-- La matrice randapp.role_permissions è condivisa da tutti gli hotel.
-- La gestione dei permessi globali non deve dipendere dall'admin di una sola struttura.
-- Il controllo usa le iscrizioni effettive in DB, non valori forniti dal client.

create or replace function randapp.can_manage_global_roles(p_hotel text)
returns boolean
language sql stable security definer set search_path = randapp, pg_temp as $$
  select auth.uid() is not null
    and randapp.has_permission(p_hotel, 'admin.access')
    and exists (
      select 1 from randapp.hotel_memberships m
      where m.auth_user_id = auth.uid()
        and m.hotel_id = p_hotel
        and m.active
        and m.role = 'admin'
    )
    and not exists (
      select 1
      from randapp.hotels h
      where h.active
        and not exists (
          select 1 from randapp.hotel_memberships m
          where m.auth_user_id = auth.uid()
            and m.hotel_id = h.id
            and m.active
            and m.role = 'admin'
        )
    );
$$;

revoke all on function randapp.can_manage_global_roles(text) from public, anon;
grant execute on function randapp.can_manage_global_roles(text) to authenticated;

create or replace function randapp.admin_role_set(p_hotel text, p_role text, p_permission text, p_on boolean)
returns void
language plpgsql security definer set search_path = randapp, pg_temp as $$
begin
  if not randapp.can_manage_global_roles(p_hotel) then
    raise exception using errcode = '42501',
      message = 'Solo un amministratore di tutte le strutture attive può modificare i permessi globali';
  end if;

  if p_role not in (
    'admin', 'direzione', 'responsabile', 'manutentore', 'governante', 'reception',
    'capo_governante', 'portiere_notturno', 'direttore_congressi',
    'tecnico_esterno', 'supremo', 'randai'
  ) then
    raise exception using errcode = '22023', message = 'Ruolo non valido';
  end if;
  if not exists (select 1 from randapp.role_permissions where permission = p_permission) then
    raise exception using errcode = '22023', message = 'Permesso sconosciuto';
  end if;
  if p_role = 'admin' and p_permission = 'admin.access' then
    raise exception using errcode = '22023', message = 'Il ruolo admin deve sempre avere admin.access';
  end if;

  if p_on then
    insert into randapp.role_permissions (role, permission)
    values (p_role, p_permission)
    on conflict do nothing;
  else
    delete from randapp.role_permissions
    where role = p_role and permission = p_permission;
  end if;
end;
$$;

revoke all on function randapp.admin_role_set(text, text, text, boolean) from public, anon;
grant execute on function randapp.admin_role_set(text, text, text, boolean) to authenticated;
