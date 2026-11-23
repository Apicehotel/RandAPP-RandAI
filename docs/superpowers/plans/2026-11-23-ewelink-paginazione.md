# Piano: paginazione elenco eWeLink

## Contesto
L'API CoolKit `/v2/device/thing` restituisce **al massimo 30** dispositivi per richiesta se non si pagina (`num` + `beginIndex`). In produzione l'account condiviso ha ~45 dispositivi e RandApp ne vedeva ~30: i 15 "mancanti" sono quasi certamente oltre la prima pagina, non dispositivi morti.

## File
- `supabase/functions/_shared/ewelink.js` — `listThings` pagina fino a `total` (o lista vuota)
- `test/ewelink.test.js` — test multipagina + URL con `num`/`beginIndex`
- `supabase/functions/ewelink-sync/index.ts` — risposta con `fetched` / `pages` per diagnosi
- `README.md`, `docs/STATO.md` — allineare documentazione

## Regole
- Solo lettura (nessun endpoint di comando)
- Max pagine di sicurezza (es. 20 × 30 = 600) per non loopare
- Nessun segreto nei log/messaggi
