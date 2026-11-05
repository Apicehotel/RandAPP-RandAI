-- I numeri WhatsApp di chi scrive si MANTENGONO sulla segnalazione. Quando un numero viene messo sul profilo
-- di una persona, le sue segnalazioni si collegano da sole e al posto del numero compare il nome.
-- Il numero sul profilo non si legge dal browser (nessun grant): lo scrivono l'amministrazione e la sincronizzazione.

alter table randapp.profiles
  add column phone text check (phone is null or phone ~ '^\+[0-9]{8,15}$');
create unique index profiles_phone_uidx on randapp.profiles (phone) where phone is not null;

alter table randapp.issues
  add column created_by_phone text check (created_by_phone is null or created_by_phone ~ '^\+[0-9]{8,15}$');
grant select (created_by_phone) on randapp.issues to authenticated;
create index issues_phone_idx on randapp.issues (created_by_phone) where created_by_phone is not null;

-- Collega le segnalazioni WhatsApp al profilo con lo stesso numero; senza profilo resta "WhatsApp +39…".
create or replace function randapp.link_issue_senders()
returns integer language plpgsql security definer set search_path = randapp, pg_temp as $$
declare n integer;
begin
  update randapp.issues i
     set created_by      = p.auth_user_id,
         created_by_name = coalesce(p.display_name, 'WhatsApp ' || i.created_by_phone)
    from (select i2.id, pr.auth_user_id, pr.display_name
            from randapp.issues i2
            left join randapp.profiles pr on pr.phone = i2.created_by_phone and pr.active
           where i2.source = 'whatsapp' and i2.created_by_phone is not null) p
   where i.id = p.id
     and (i.created_by is distinct from p.auth_user_id
          or i.created_by_name is distinct from coalesce(p.display_name, 'WhatsApp ' || i.created_by_phone));
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function randapp.link_issue_senders() from public, anon, authenticated;

create or replace function randapp.trg_profile_phone_link()
returns trigger language plpgsql security definer set search_path = randapp, pg_temp as $$
begin
  perform randapp.link_issue_senders();
  return new;
end;
$$;
revoke all on function randapp.trg_profile_phone_link() from public, anon, authenticated;
create trigger profiles_phone_link after insert or update of phone, display_name, active on randapp.profiles
  for each row execute function randapp.trg_profile_phone_link();
