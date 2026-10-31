# RandAPP-RandAI

RandApp: app **multi-hotel** per la gestione operativa delle strutture (Hotel Giò, Choco Hotel, Hotel Il Brigantino).
È la riscrittura da zero della vecchia app `Apicehotel-Manutenzione`: stessa idea, ma leggera e con una sola base pulita.
Per ora funziona: **login con PIN, scelta struttura, permessi per ruolo, Home operativa e Segnalazioni**.
**RandAI è predisposto ma in pausa** (spento, non viene caricato).

## Lavoro con più strumenti AI
Su questo repo lavorano insieme **Claude, Cursor e Codex**. Regole in [`AGENTS.md`](./AGENTS.md), stato corrente in [`docs/STATO.md`](./docs/STATO.md).

## Stack
- **React 19 + Vite 7**, app mobile-first (telefono prima, poi desktop).
- **Supabase**: Auth, database Postgres con RLS, Edge Functions.
- Dipendenze volutamente poche: `react`, `react-dom`, `@supabase/supabase-js`.

## Comandi
```bash
npm install
npm run dev            # sviluppo in locale (porta 3000)
npm test               # test (node:test)
npm run build          # build di produzione in dist/
npm run check:bundle   # verifica il peso del bundle (dopo il build)
npm run check          # test + build + peso bundle
npm run user:create    # crea un utente con PIN (vedi sotto)
```

## Variabili d'ambiente
Solo i **nomi** (i valori non vanno mai nel repo). Modello in `.env.example`.

| Variabile | Dove | A cosa serve |
|---|---|---|
| `VITE_SUPABASE_URL` | build/browser | indirizzo del progetto Supabase |
| `VITE_SUPABASE_ANON_KEY` | build/browser | chiave pubblica Supabase |
| `VITE_FEATURE_RANDAI` | build/browser | `true` accende RandAI; vuoto/`false` = spento |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | solo terminale locale | solo per `npm run user:create`; mai nel browser |

Se mancano le variabili `VITE_*`, l'app mostra la schermata "Configurazione mancante".

## Come funziona
- **Login**: scegli la struttura → scrivi le prime lettere del nome → PIN a 4 cifre. Il PIN non viene mai controllato nel browser: lo verifica la funzione server `supabase/functions/pin-auth` (hash bcrypt, blocco di 10 minuti dopo 5 errori, ricerca nomi limitata e solo dopo 2 lettere).
- **Permessi**: la matrice ruolo → permessi è nel database (`role_permissions`). Il browser la legge solo per mostrare/nascondere le voci; la sicurezza vera sono le policy RLS.
- **Multi-hotel**: ogni segnalazione ha `hotel_id`; le policy RLS e le query la filtrano sempre per la struttura dell'utente.
- **Ruoli**: `admin`, `direzione`, `responsabile`, `manutentore`, `governante`, `reception`.
- **Home** (riepilogo della giornata, visibile a tutti): un riquadro per ogni sezione che l'utente può vedere (Avvisi da prendere, Segnalazioni da fare, Interventi da fare, Lavori oggi, Sale occupate oggi, Promemoria per me), poi **Chi c'è in struttura** e **Da fare adesso** (elenco unico, al massimo 3 voci per sezione e 10 in tutto: prima avvisi, poi segnalazioni, interventi, lavori, sale, promemoria). Se una sezione non si carica, le altre si vedono lo stesso. Non c'è un pulsante "Nuova": si crea dentro le singole sezioni.
- **Chi c'è in struttura** (tabella `presence`, migrazione `0005`): ognuno segna a mano "Sono arrivato" / "Sono uscito" (niente GPS). Si scrive solo con la funzione server `set_presence`, che copia nome e ruolo dall'utente collegato (il browser non può falsificarli). Dopo 16 ore senza uscita una persona non risulta più presente. Permessi `presence.view/update` per tutti i ruoli.
- **Navigazione** (come la vecchia app): barra in basso con 5 posti fissi — **Operatività · Planning · Home (al centro) · Task · Altro**. Il quinto posto diventa **RandAI** quando RandAI è acceso; finché è in pausa è "Altro" e apre il menu completo. In alto a sinistra c'è la struttura (logo e nome, **tocca per cambiarla**: se il tuo utente ha accesso a più strutture si passa dall'una all'altra senza rifare il PIN; ruolo e permessi si rileggono per la nuova struttura; c'è anche "Entra con un altro utente"), in alto a destra il **cerchio con le iniziali** dell'utente che apre il menu laterale (sezioni, profilo, Cambia struttura, Esci). Pulsanti e voci compaiono solo se il ruolo ha il permesso.
- **Operatività**: hub con **due sezioni interne, Segnalazioni e Interventi**, ciascuna con le 3 più importanti; in cima le due sezioni sono **due riquadri affiancati**. Gli **Interventi** (tabella `interventions`, migrazione `0002`) sono lavori di manutenzione anche programmati: titolo, camera/zona, data, note, stato Da fare · In corso · Fatto. Permessi `interventions.view/create/update` (governante e reception solo vista).
- **Planning**: hub con **due riquadri affiancati, Planning Sale e Planning Lavori**, e sotto cosa c'è oggi.
  - **Planning Lavori** (`planning_works`): un lavoro con descrizione e uno o più giorni (anche di settimane diverse); vista per settimana, stato Da fare · Fatto.
  - **Planning Sale** (`sale_bookings`): prenotazione sala con cliente, sala, dal/al, turno (Mattina · Pomeriggio · Sera · Tutto il giorno), persone, note; vista per giorno. Una sala già occupata nello stesso periodo e turno non si può prenotare (controllo nell'app e di nuovo al salvataggio). Le prenotazioni non si cancellano: si annullano.
  - Permessi `planning_work.*` e `planning_sale.*` (view/create/update). Il pulsante Planning in basso compare se c'è almeno uno dei due permessi di vista.
- **Task**: hub con **due riquadri affiancati, Avvisi Urgenti e Promemoria**, e sotto gli avvisi aperti e i promemoria per il tuo ruolo.
  - **Avvisi Urgenti** (`urgent_alerts`): nota rapida (max 300 caratteri) che passa da Aperto a In carico a Risolto, con ora di presa in carico e di risoluzione. Prima quelli da prendere, il più vecchio in cima. Non si cancellano.
  - **Promemoria** (`reminders`): messaggio per uno o più ruoli (nessun ruolo = tutti), ripetizione (una volta, ogni giorno, giorni scelti, ogni mese), uno o più orari, date di inizio e fine; si accende e si spegne. **L'invio automatico delle notifiche non è ancora attivo**: oggi si consultano nell'app. Chi può crearli vede "Per me" e "Tutti".
  - Permessi `urgent.*` e `reminders.*` (view/create/update). Il pulsante Task in basso compare se c'è almeno uno dei due permessi di vista.
- **Stati segnalazione**: Da fare · Tecnico · Attesa pezzo · Completata.
- **Stile**: tema Sistema/Chiaro/Scuro e dimensione Piccolo/Normale/Grande (dal Profilo). Colori e dimensioni sono solo in `src/ui/tokens.css`.
- **Attenzione agli stili**: le classi generiche (es. `.center`) valgono per tutta l'app; per i componenti della barra usare nomi specifici (`nav-*`).
- **Velocità**: ogni schermata si scarica solo quando la apri (`React.lazy`). `npm run check:bundle` fa fallire il controllo se l'avvio supera 160 KB compressi.

## Loghi e icona dell'app
Presi dalla vecchia app `Apicehotel-Manutenzione`.
- `src/assets/logos/`: mascotte **ApiceHotel** (login) e loghi di **Hotel Giò, Choco Hotel, Il Brigantino** (scelta struttura e intestazione). Sono importati dal codice (`src/lib/hotels.js`), quindi vengono pubblicati con nome a prova di cache.
- `public/icons/` + `public/manifest.webmanifest`: icona **RandApp** (192, 512, maskable, Apple) per aggiungere l'app alla schermata Home del telefono. Per ora c'è solo il manifest: il servizio di funzionamento offline arriva con la PWA completa.
- Non ancora presi: le "card" grandi delle strutture, il gatto di RandAI (quando lo riattiviamo), l'icona degli avvisi urgenti.

## Messa in funzione del database (nuovo progetto Supabase)
1. Crea un progetto Supabase **nuovo e separato** da quelli esistenti.
2. Applica in ordine `supabase/migrations/0001_base.sql`, `0002_interventions.sql`, `0003_planning.sql`, `0004_task.sql` e `0005_presence.sql`.
3. Pubblica la funzione `pin-auth` (`supabase/functions/pin-auth`).
4. Crea i primi utenti dal tuo terminale:
   ```bash
   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
   npm run user:create -- --name "Nome Cognome" --hotels hotelgio,chocohotel --role admin --pin 0000
   ```
   (usa valori tuoi: la chiave di servizio resta nel terminale).
5. Imposta `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` nell'hosting e fai il build.

## RandAI (in pausa)
Il punto d'ingresso è `src/randai/`. Con `VITE_FEATURE_RANDAI` spento non compare nei menu e il suo codice non viene scaricato. Quando lo riattiviamo, tutto il codice di RandAI vive in quella cartella e si carica solo a richiesta.

## Struttura
```
AGENTS.md              regole comuni agli strumenti AI
CLAUDE.md              rimando ad AGENTS.md
.cursor/rules/         regole Cursor (rimando ad AGENTS.md)
docs/STATO.md          passaggio di consegne tra strumenti
src/app/               App, router a hash, interruttori funzioni (features.js)
src/lib/               supabase, auth, permessi, coda priorità, preferenze UI, hook
src/data/              accesso ai dati (sempre filtrato per hotel_id)
src/screens/           Login, Home (riepilogo), Operatività, Segnalazioni, Interventi, Planning (hub, Lavori, Sale), Task (hub, Avvisi Urgenti, Promemoria), Nuova segnalazione/intervento, Profilo
src/assets/logos/      loghi (ApiceHotel e strutture)
src/ui/                tokens.css (colori/dimensioni), base.css, Shell (barra + header), Drawer (menu), componenti
src/randai/            RandAI (predisposto, spento)
supabase/migrations/   schema database con RLS
supabase/functions/    pin-auth (login con PIN lato server)
scripts/               create-user, check-bundle
test/                  test automatici (permessi, coda, schema RLS, niente segreti)
```
