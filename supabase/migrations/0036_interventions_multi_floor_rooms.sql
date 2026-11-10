-- Consenti interventi su interi piani: il precedente limite di 60 camere
-- rifiutava selezioni multipiano (es. 126 camere Chocohotel).
-- La UI mantiene il riepilogo compatto di location (max 40 caratteri).
alter table randapp.interventions
  drop constraint if exists interventions_rooms_check;

alter table randapp.interventions
  add constraint interventions_rooms_check
  check (cardinality(rooms) <= 300);
