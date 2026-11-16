-- Ricezione WhatsApp (Twilio → funzione randapp-whatsapp-inbound → segnalazione). Tutto in schema randapp, nessuna tabella della vecchia app toccata.
-- Il canale nasce SPENTO (enabled=false): finché non si accende e non si cambia il webhook Twilio, la funzione non crea nulla.
-- Le tabelle sono scritte solo dalla funzione (service role): nessun accesso dal browser.

create table randapp.whatsapp_channels (
  hotel_id       text primary key references randapp.hotels (id),
  inbound_number text not null unique check (inbound_number ~ '^\+[0-9]{8,15}$'),
  enabled        boolean not null default false,
  updated_at     timestamptz not null default now()
);

create table randapp.whatsapp_inbound (
  id           uuid primary key default gen_random_uuid(),
  message_sid  text not null unique,
  hotel_id     text not null references randapp.hotels (id),
  from_phone   text not null check (from_phone ~ '^\+[0-9]{8,15}$'),
  body         text not null default '' check (char_length(body) <= 4000),
  num_media    integer not null default 0,
  status       text not null check (status in ('created','needs_info','rate_limited','error')),
  issue_id     uuid references randapp.issues (id) on delete set null,
  created_at   timestamptz not null default now()
);
create index whatsapp_inbound_hotel_idx on randapp.whatsapp_inbound (hotel_id, created_at desc);
create index whatsapp_inbound_phone_idx on randapp.whatsapp_inbound (from_phone, created_at desc);

alter table randapp.whatsapp_channels enable row level security;
alter table randapp.whatsapp_inbound enable row level security;
revoke all on randapp.whatsapp_channels, randapp.whatsapp_inbound from anon, authenticated;

-- Stessi numeri della vecchia app, ma canale SPENTO fino al giorno del passaggio.
insert into randapp.whatsapp_channels (hotel_id, inbound_number, enabled)
select hotel_id, inbound_number, false from public.whatsapp_channel_settings
where hotel_id in (select id from randapp.hotels) on conflict do nothing;
