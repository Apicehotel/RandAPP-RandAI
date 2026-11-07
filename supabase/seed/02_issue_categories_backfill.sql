-- Rimette in "Edilizio" le 10 segnalazioni che la prima importazione aveva messo in "Altro" (id della vecchia app).
-- Ripetibile; si esegue dopo la migrazione 0032.
update randapp.issues set category = 'Edilizio'
 where category = 'Altro'
   and legacy_id in (
     'ff522a13-e308-4c49-b765-a612403a3fba','ade13809-0ffc-412e-a31f-b489bd491c2e','e4416257-d6ff-40eb-ae76-1a49ce372fa2',
     '9af5a5d6-113b-4ce5-bc6f-10b1fddf2614','90bb8a3e-2f5c-4bb8-9bb4-58b15d4bfe08','6dc0ee5e-b720-447e-b011-0c26024a2f90',
     '5dead068-5de4-4809-8c9e-704410dc9e79','645b76d0-1be8-44dc-9bed-9e28d80e9e25','c9f16b33-68ef-4ed1-9eed-f48047784849',
     '3cd80e2a-fb30-4d6a-bd49-628a946eebce');
