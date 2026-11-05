-- Sale, allestimenti e clienti ricorrenti copiati dalla vecchia app (schema public: sale_rooms_config, sale_layouts_config, sale_clients).
-- Ripetibile (on conflict do nothing). Eseguire dopo le migrazioni 0011 e successive.
-- "family" raggruppa le sale (Trumpet, Sax, Auditorium…); "parts" dice quali spazi fisici occupa:
-- una combinazione (es. Trumpet 1+2) occupa anche Trumpet 1 e Trumpet 2, quindi non si può prenotare se una parte è già presa.
insert into randapp.sale_rooms (hotel_id, name, family, parts, sort_order, active)
select r.hotel_id, r.name, r.family, coalesce(r.parts, '{}'), coalesce(r.sort_order, 0), coalesce(r.active, true)
  from public.sale_rooms_config r
 where r.hotel_id in (select id from randapp.hotels)
on conflict (hotel_id, name) do nothing;

insert into randapp.sale_layouts (hotel_id, name, sort_order)
select l.hotel_id, l.name, coalesce(l.sort_order, 0)
  from public.sale_layouts_config l
 where l.hotel_id in (select id from randapp.hotels) and coalesce(l.active, true)
on conflict (hotel_id, name) do nothing;

-- Richiami cliente: la vecchia app salvava la chiave della sala/allestimento, qui si salva il nome.
-- I clienti di prova (nome "Test") non si copiano.
insert into randapp.sale_clients (hotel_id, name, preferred_room, preferred_layout, preferred_pax, notes)
select c.hotel_id, c.name,
       (select r.name from public.sale_rooms_config r where r.hotel_id = c.hotel_id and r.room_key = c.preferred_room_key),
       (select l.name from public.sale_layouts_config l where l.hotel_id = c.hotel_id and l.layout_key = c.preferred_layout_key),
       c.preferred_pax, nullif(c.recurring_notes, '')
  from public.sale_clients c
 where c.hotel_id in (select id from randapp.hotels) and coalesce(c.active, true) and lower(c.name) <> 'test'
on conflict (hotel_id, name) do nothing;
