-- Base per RandAI: "Casi simili" dallo storico (senza modelli) + registro delle scelte per un'IA locale futura.
-- Nessun dato personale nel registro: numeri di telefono ed email vengono tolti anche sul server. Niente PIN, token o chiavi.
-- Il registro lo scrive solo la funzione ai_log (limite 120 righe/ora per persona). Gli esempi "verificati" (giudizio positivo,
-- correzione umana, scelte fatte dalle persone) si esportano per allenare un modello locale quando sarà il momento.

-- ---------------------------------------------------------------- ricerca testuale sullo storico
create index issues_fts_idx on randapp.issues using gin (
  to_tsvector('italian', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(category, '') || ' ' ||
                         coalesce(completion_note, '') || ' ' || coalesce(part_replaced, '')));

create or replace function randapp.similar_cases(p_hotel text, p_query text, p_limit integer default 3, p_exclude uuid default null)
returns table (id uuid, title text, category text, room text, completion_note text, part_replaced text, technician_name text, completed_at timestamptz, rank real)
language plpgsql stable security definer set search_path = randapp, pg_temp as $$
declare
  v_words text[];
  v_q tsquery;
begin
  if not randapp.has_permission(p_hotel, 'issues.view') then
    raise exception using errcode = '42501', message = 'non autorizzato';
  end if;
  select coalesce(array_agg(distinct w), '{}') into v_words
    from (select lower(m[1]) w from regexp_matches(coalesce(p_query, ''), '([[:alnum:]àèéìòùÀÈÉÌÒÙ]{3,})', 'g') m limit 12) s;
  if cardinality(v_words) = 0 then return; end if;
  v_q := to_tsquery('italian', array_to_string(v_words, ' | '));
  return query
    select i.id, i.title, i.category, i.room, i.completion_note, i.part_replaced, i.technician_name, i.completed_at,
           ts_rank(to_tsvector('italian', coalesce(i.title, '') || ' ' || coalesce(i.description, '') || ' ' || coalesce(i.category, '') || ' ' ||
                                          coalesce(i.completion_note, '') || ' ' || coalesce(i.part_replaced, '')), v_q)
      from randapp.issues i
     where i.hotel_id = p_hotel and i.status = 'completata'
       and (i.id is distinct from p_exclude)
       and (coalesce(trim(i.completion_note), '') <> '' or coalesce(trim(i.part_replaced), '') <> '')
       and to_tsvector('italian', coalesce(i.title, '') || ' ' || coalesce(i.description, '') || ' ' || coalesce(i.category, '') || ' ' ||
                                  coalesce(i.completion_note, '') || ' ' || coalesce(i.part_replaced, '')) @@ v_q
     order by 9 desc, i.completed_at desc nulls last
     limit least(greatest(coalesce(p_limit, 3), 1), 8);
end;
$$;

-- ---------------------------------------------------------------- registro delle scelte
create table randapp.ai_interactions (
  id         uuid primary key default gen_random_uuid(),
  hotel_id   text not null references randapp.hotels (id),
  user_id    uuid not null references auth.users (id),
  feature    text not null check (feature in ('similar_cases','chat','classify')),
  source     text not null check (source in ('rules','history','human','cloud','local')),
  model      text check (model is null or char_length(model) <= 60),
  input      jsonb not null check (pg_column_size(input) < 4000),
  output     jsonb check (output is null or pg_column_size(output) < 8000),
  confidence real check (confidence is null or (confidence >= 0 and confidence <= 1)),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  created_at timestamptz not null default now()
);
create index ai_interactions_hotel_idx on randapp.ai_interactions (hotel_id, created_at desc);
create index ai_interactions_user_idx on randapp.ai_interactions (user_id, created_at desc);
alter table randapp.ai_interactions enable row level security;
create policy ai_interactions_select on randapp.ai_interactions
  for select to authenticated using (user_id = auth.uid() or randapp.has_permission(hotel_id, 'admin.access'));
revoke all on randapp.ai_interactions from anon, authenticated;
grant select on randapp.ai_interactions to authenticated;

create table randapp.ai_feedback (
  interaction_id uuid not null references randapp.ai_interactions (id) on delete cascade,
  user_id        uuid not null references auth.users (id),
  verdict        text not null check (verdict in ('up','down','corrected')),
  correction     jsonb check (correction is null or pg_column_size(correction) < 4000),
  created_at     timestamptz not null default now(),
  primary key (interaction_id, user_id)
);
alter table randapp.ai_feedback enable row level security;
create policy ai_feedback_select on randapp.ai_feedback
  for select to authenticated using (user_id = auth.uid());
revoke all on randapp.ai_feedback from anon, authenticated;
grant select on randapp.ai_feedback to authenticated;

-- Toglie numeri di telefono (8+ cifre) ed email da qualunque testo registrato.
create or replace function randapp.ai_scrub(p_json jsonb)
returns jsonb language sql immutable set search_path = pg_catalog, pg_temp as $$
  select case when p_json is null then null else
    regexp_replace(
      regexp_replace(p_json::text, '\+?\d[\d ]{6,}\d', '[numero]', 'g'),
      '[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}', '[email]', 'g')::jsonb end;
$$;

create or replace function randapp.ai_log(p_hotel text, p_feature text, p_source text, p_model text, p_input jsonb, p_output jsonb, p_confidence real default null, p_latency integer default null)
returns uuid language plpgsql security definer set search_path = randapp, pg_temp as $$
declare v_id uuid;
begin
  if not randapp.is_hotel_member(p_hotel) then
    raise exception using errcode = '42501', message = 'non autorizzato';
  end if;
  if (select count(*) from randapp.ai_interactions where user_id = auth.uid() and created_at > now() - interval '1 hour') >= 120 then
    return null;
  end if;
  insert into randapp.ai_interactions (hotel_id, user_id, feature, source, model, input, output, confidence, latency_ms)
  values (p_hotel, auth.uid(), p_feature, p_source, left(p_model, 60), randapp.ai_scrub(coalesce(p_input, '{}'::jsonb)), randapp.ai_scrub(p_output), p_confidence, p_latency)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function randapp.ai_feedback_give(p_interaction uuid, p_verdict text, p_correction jsonb default null)
returns void language plpgsql security definer set search_path = randapp, pg_temp as $$
begin
  if p_verdict not in ('up','down','corrected') then
    raise exception using errcode = '22023', message = 'Giudizio non valido';
  end if;
  if not exists (select 1 from randapp.ai_interactions where id = p_interaction and user_id = auth.uid()) then
    raise exception using errcode = '42501', message = 'non autorizzato';
  end if;
  insert into randapp.ai_feedback (interaction_id, user_id, verdict, correction)
  values (p_interaction, auth.uid(), p_verdict, randapp.ai_scrub(p_correction))
  on conflict (interaction_id, user_id) do update set verdict = excluded.verdict, correction = excluded.correction, created_at = now();
end;
$$;

-- Numeri per l'admin: quante richieste, da dove arrivano le risposte (storico, persone, modello locale, cloud), giudizi.
create or replace function randapp.ai_stats(p_hotel text)
returns jsonb language plpgsql stable security definer set search_path = randapp, pg_temp as $$
begin
  if not randapp.has_permission(p_hotel, 'admin.access') then
    raise exception using errcode = '42501', message = 'non autorizzato';
  end if;
  return jsonb_build_object(
    'by_source', coalesce((select jsonb_object_agg(source, n) from (select source, count(*) n from randapp.ai_interactions where hotel_id = p_hotel and created_at > now() - interval '30 days' group by source) s), '{}'::jsonb),
    'by_feature', coalesce((select jsonb_object_agg(feature, n) from (select feature, count(*) n from randapp.ai_interactions where hotel_id = p_hotel and created_at > now() - interval '30 days' group by feature) s), '{}'::jsonb),
    'feedback', coalesce((select jsonb_object_agg(verdict, n) from (select f.verdict, count(*) n from randapp.ai_feedback f join randapp.ai_interactions i on i.id = f.interaction_id where i.hotel_id = p_hotel group by f.verdict) s), '{}'::jsonb),
    'total', (select count(*) from randapp.ai_interactions where hotel_id = p_hotel),
    'verified', (select count(*) from randapp.ai_interactions i where i.hotel_id = p_hotel and (i.source = 'human' or exists (select 1 from randapp.ai_feedback f where f.interaction_id = i.id and f.verdict in ('up','corrected')))),
    'history_labeled', (select count(*) from randapp.issues where hotel_id = p_hotel and status = 'completata' and coalesce(trim(title), '') <> '')
  );
end;
$$;

-- Esempi verificati per allenare un modello locale: giudizio positivo, correzioni, scelte umane + storico chiuso. Mai nomi né numeri.
create or replace function randapp.ai_training_export(p_hotel text, p_limit integer default 2000)
returns table (kind text, feature text, input jsonb, output jsonb, verdict text, correction jsonb, at timestamptz)
language plpgsql stable security definer set search_path = randapp, pg_temp as $$
begin
  if not randapp.has_permission(p_hotel, 'admin.access') then
    raise exception using errcode = '42501', message = 'non autorizzato';
  end if;
  return query
    (select 'registro'::text, i.feature, i.input, i.output, f.verdict, f.correction, i.created_at
       from randapp.ai_interactions i left join randapp.ai_feedback f on f.interaction_id = i.id
      where i.hotel_id = p_hotel and (i.source = 'human' or f.verdict in ('up','corrected'))
      order by i.created_at desc limit least(coalesce(p_limit, 2000), 5000))
    union all
    (select 'storico'::text, 'classify'::text,
            randapp.ai_scrub(jsonb_build_object('title', s.title, 'description', left(coalesce(s.description, ''), 500))),
            jsonb_build_object('category', s.category, 'urgency', s.urgency, 'solution', left(coalesce(s.completion_note, ''), 500), 'part', s.part_replaced),
            'up'::text, null::jsonb, s.completed_at
       from randapp.issues s
      where s.hotel_id = p_hotel and s.status = 'completata'
      order by s.completed_at desc nulls last limit least(coalesce(p_limit, 2000), 5000));
end;
$$;

revoke all on function randapp.similar_cases(text, text, integer, uuid), randapp.ai_log(text, text, text, text, jsonb, jsonb, real, integer),
  randapp.ai_feedback_give(uuid, text, jsonb), randapp.ai_stats(text), randapp.ai_training_export(text, integer), randapp.ai_scrub(jsonb) from public, anon;
grant execute on function randapp.similar_cases(text, text, integer, uuid), randapp.ai_log(text, text, text, text, jsonb, jsonb, real, integer),
  randapp.ai_feedback_give(uuid, text, jsonb), randapp.ai_stats(text), randapp.ai_training_export(text, integer) to authenticated;
