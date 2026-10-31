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
- **Home**: coda di lavoro ordinata per urgenza (poi la più vecchia), con 4 contatori. Non c'è un pulsante "Nuova": le segnalazioni si creano dalla sezione Segnalazioni.
- **Navigazione** (come la vecchia app): barra in basso con 5 posti fissi — **Operatività · Planning · Home (al centro) · Task · Altro**. Il quinto posto diventa **RandAI** quando RandAI è acceso; finché è in pausa è "Altro" e apre il menu completo. In alto a sinistra c'è la struttura, in alto a destra il **cerchio con le iniziali** dell'utente che apre il menu laterale (sezioni, profilo, Cambia struttura, Esci). Pulsanti e voci compaiono solo se il ruolo ha il permesso.
- **Operatività**: hub con **due sezioni interne, Segnalazioni e Interventi**, ciascuna con le 3 più importanti; in cima le due sezioni sono **due riquadri affiancati**. Gli **Interventi** (tabella `interventions`, migrazione `0002`) sono lavori di manutenzione anche programmati: titolo, camera/zona, data, note, stato Da fare · In corso · Fatto. Permessi `interventions.view/create/update` (governante e reception solo vista). **Planning** e **Task** sono per ora schermate "In arrivo".
- **Stati segnalazione**: Da fare · Tecnico · Attesa pezzo · Completata.
- **Stile**: tema Sistema/Chiaro/Scuro e dimensione Piccolo/Normale/Grande (dal Profilo). Colori e dimensioni sono solo in `src/ui/tokens.css`.
- **Attenzione agli stili**: le classi generiche (es. `.center`) valgono per tutta l'app; per i componenti della barra usare nomi specifici (`nav-*`).
- **Velocità**: ogni schermata si scarica solo quando la apri (`React.lazy`). `npm run check:bundle` fa fallire il controllo se l'avvio supera 160 KB compressi.

## Messa in funzione del database (nuovo progetto Supabase)
1. Crea un progetto Supabase **nuovo e separato** da quelli esistenti.
2. Applica in ordine `supabase/migrations/0001_base.sql` e `0002_interventions.sql`.
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
src/screens/           Login, Home, Operatività, Segnalazioni, Interventi, Nuova segnalazione/intervento, Profilo, "In arrivo"
src/ui/                tokens.css (colori/dimensioni), base.css, Shell (barra + header), Drawer (menu), componenti
src/randai/            RandAI (predisposto, spento)
supabase/migrations/   schema database con RLS
supabase/functions/    pin-auth (login con PIN lato server)
scripts/               create-user, check-bundle
test/                  test automatici (permessi, coda, schema RLS, niente segreti)
```
