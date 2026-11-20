-- 0041 — Pezzo in attesa sulla segnalazione («Serve pezzo» come nell'app HotelGio)
-- Solo schema randapp: non si tocca `public` (vecchia app).
alter table randapp.issues
  add column if not exists part_needed text
  check (part_needed is null or char_length(part_needed) between 1 and 200);
grant update (part_needed) on randapp.issues to authenticated;
