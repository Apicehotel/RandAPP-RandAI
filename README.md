# RandAPP-RandAI

RandApp: app **multi-hotel** per la gestione operativa delle strutture (Hotel Giò, Choco Hotel, Hotel Il Brigantino).
È la riscrittura da zero della vecchia app `Apicehotel-Manutenzione`: stessa idea, ma leggera e con una sola base pulita.
Per ora funziona: **login con PIN, scelta struttura, permessi per ruolo, Home operativa e Segnalazioni**.
**RandAI è predisposto ma in pausa**: la chat c'è già (quinto posto della barra) ma il campo di scrittura è spento.

## Lavoro con più strumenti AI
Su questo repo lavorano insieme **Claude, Cursor e Codex**. Regole in [`AGENTS.md`](./AGENTS.md), stato corrente in [`docs/STATO.md`](./docs/STATO.md), **come standardizzare** (ruoli, categorie, migrazioni, sicurezza, layout) in [`docs/STANDARD.md`](./docs/STANDARD.md).

## Stack
- **React 19 + Vite 8**, app mobile-first (telefono prima, poi desktop).
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

## Verifiche automatiche e sicurezza multi-hotel
Le PR e gli aggiornamenti a `main` eseguono `npm ci` e `npm run check` tramite GitHub Actions (`.github/workflows/randapp-check.yml`): test unitari/regressione, build e controllo bundle.
Le autorizzazioni globali degli amministratori sono protette nel database dalla migrazione `0035`; non basta nascondere i controlli nella UI.
Il test con utenti sintetici `supabase/tests/global_roles_preview.sql` si esegue **solo in una preview Supabase**, all'interno di una transazione che termina con `ROLLBACK`. Non eseguirlo su produzione.
Il check CI **non sostituisce** una verifica con sessioni Supabase valide e utenti di prova.

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
- **Login**: una sola schermata — utente (prime lettere del **nome** oppure **username** esatto) e PIN a 4 cifre; la struttura si sceglie **dopo** il PIN solo se la persona ha più hotel. Il PIN non viene mai controllato nel browser: lo verifica la funzione server `supabase/functions/randapp-pin-auth` (hash bcrypt, blocco di 10 minuti dopo 5 errori, ricerca nomi limitata e solo dopo 2 lettere).
- **Permessi**: la matrice ruolo → permessi è nel database (`role_permissions`). Il browser la legge solo per mostrare/nascondere le voci; la sicurezza vera sono le policy RLS. La matrice è **globale**: dalla migrazione `0035`, la può modificare solo un admin con accesso amministrativo attivo in **tutte le strutture attive**; gli admin dei singoli hotel possono consultarla ma non modificarla.
- **Multi-hotel**: ogni riga operativa ha `hotel_id`; le policy RLS e le query client la filtrano sempre per la struttura dell'utente (vedi [`docs/STANDARD.md`](./docs/STANDARD.md) §6).
- **Ruoli** (12; elenco canonico in `src/lib/admin.js` → `ROLES`): `admin`, `direzione`, `responsabile`, `manutentore`, `governante`, `reception`, più dalla vecchia app `capo_governante`, `portiere_notturno`, `direttore_congressi`, `tecnico_esterno`, `supremo`, `randai`. La migrazione `0031` che apre i CHECK SQL **non è ancora applicata** al database: finché manca, sul DB restano ammessi solo i 6 ruoli base. Per aggiungere un ruolo: checklist in [`docs/STANDARD.md`](./docs/STANDARD.md) §4.
- **Home** (riepilogo della giornata, visibile a tutti): un riquadro per ogni sezione che l'utente può vedere (Avvisi da prendere, Segnalazioni da fare, Interventi da fare, Lavori oggi, Sale occupate oggi, Promemoria per me), poi **Chi c'è in struttura** e **Da fare adesso** (elenco unico, al massimo 3 voci per sezione e 10 in tutto: prima avvisi, poi segnalazioni, interventi, lavori, sale, promemoria). Se una sezione non si carica, le altre si vedono lo stesso. Non c'è un pulsante "Nuova": si crea dentro le singole sezioni.
- **Chi c'è in struttura** (tabella `presence`, migrazione `0005` + scadenza in `0013`): ognuno segna a mano "Sono arrivato" / "Sono uscito" (niente GPS). Si scrive solo con la funzione server `set_presence`, che copia nome e ruolo dall'utente collegato (il browser non può falsificarli). La presenza **scade da sola dopo 7 h 20** (`PRESENCE_MAX_MINUTES = 440` in `src/lib/home.js`; anche sul server con `expire_presence()`). Vale per una struttura alla volta. Permessi `presence.view/update` per tutti i ruoli.
- **Intestazione fissa in ogni schermata**: il titolo (e la sua riga con eventuali tasti) resta in alto mentre il resto scorre. È una regola unica in `base.css`: vale per il primo blocco di `.page` che contiene un `h1`; le nuove schermate la ereditano senza codice. L'area scorrevole (`.shell-stage`) non ha padding in alto, perché `sticky` sia identico su ogni browser.
- **Navigazione** (come la vecchia app): barra in basso con 5 posti fissi — **Operatività · Planning · Home (al centro) · Task · RandAI**. Il quinto posto è la **chat RandAI** (sempre presente). Il **menu completo si apre solo dal cerchio del profilo** in alto a destra, non c'è più "Altro" nella barra. In alto a sinistra c'è la struttura (logo e nome, **tocca per cambiarla**: se il tuo utente ha accesso a più strutture si passa dall'una all'altra senza rifare il PIN; ruolo e permessi si rileggono per la nuova struttura; c'è anche "Entra con un altro utente"), in alto a destra il **cerchio con le iniziali** dell'utente che apre il menu laterale (sezioni, profilo, Cambia struttura, Esci). Pulsanti e voci compaiono solo se il ruolo ha il permesso.
- **Operatività**: hub con **due sezioni interne, Segnalazioni e Interventi**, ciascuna con le 3 più importanti; in cima le due sezioni sono **due riquadri affiancati**, come nel Planning: ognuno mostra **3 numeri** (Segnalazioni: Aperte · Urgenti · Fatte oggi; Interventi: Aperti · In corso · Fatti oggi) e, solo se il ruolo può creare, il tasto **+ Nuova segnalazione** / **+ Nuovo intervento**. Anche le liste hanno la riga dei 3 numeri e il tasto **+ Nuova** / **+ Nuovo**. Gli **Interventi** (tabella `interventions`, migrazione `0002`) sono lavori di manutenzione anche programmati: titolo, camera/zona, data, note, stato Da fare · In corso · Fatto. Permessi `interventions.view/create/update` (governante e reception solo vista). Il **dettaglio** mostra anche chi l'ha creato e chi l'ha chiuso (nome dalla vecchia app oppure, per quelli creati qui, dal profilo) e le **camere fatte** ("n su m", con data e nome dove noti; `rooms_done` arriva solo dalla vecchia app). Logica in `roomsProgress` e `interventionPeople` (`src/lib/interventions.js`).
- **Planning**: hub con **due riquadri affiancati, Planning Lavori e Planning Sale**, ciascuno con le statistiche **Oggi · Da finire · Fatti**, poi "Oggi · panoramica operativa" e il **calendario sale** della settimana (qui conta la data dell'**evento**). Allineato alla vecchia app con la migrazione `0012`.
  - **Planning Lavori** (`planning_works` + `planning_work_days`): un lavoro = descrizione, categoria, assegnatari e uno o più giorni (anche di settimane diverse). **Ogni giorno ha il suo stato** Da fare · Da finire · Fatto (con chi e quando) e si aziona dalla riga (✓, *Da finire*, *Fatto*, *Annulla giorno*: i giorni non si cancellano). Vista per settimana con le statistiche del giorno. Il lavoro risulta Fatto quando non restano giorni da fare o da finire. Lo stato si scrive solo con la funzione `planning_work_day_set` (permesso `planning_work.update`).
  - **Planning Sale** (`sale_bookings`): la lista operativa segue il giorno di **preparazione** ("Da preparare il", mai dopo l'evento), vista Giorno/Settimana, statistiche Oggi/Da finire/Fatti. Ogni scheda ha lo stato **Da finire · Fatto** (chi e quando) e i **check Audio/Video** (OK · Problema · Da verificare · N.R., chi e quando): **Fatto resta bloccato finché i check richiesti non sono OK o N.R.**. Stati e check si scrivono solo con `sale_booking_set_op` / `sale_booking_set_check` (permesso `planning_sale.operate`: manutentore e sopra); la reception crea e modifica i dati ma non opera. Turni: Mattina · Pomeriggio · Giornata intera. Le prenotazioni non si cancellano: si annullano. Si può **modificare** una prenotazione (`/planning/sale/edit/<id>`).
  - **Sale con famiglie e combinazioni** (`sale_rooms.family/parts`): una combinazione (es. "Sax 1+2") occupa anche le sale che la compongono. Nel modulo ogni sala è **Libera · Parziale · Occupata** nel periodo/turno scelto, raggruppate per famiglia; il doppio controllo (app + salvataggio) usa le stesse regole. Configurazione in *Planning Sale → Configura* (`planning_sale.manage`).
  - Nel menu laterale ci sono anche **Nuovo planning lavori** e **Nuovo planning sale** (come "Nuova segnalazione" e "Nuovo intervento"), col permesso `create` di ciascuno.
  - Il tasto **+ Nuovo** c'è nel riepilogo Planning (sotto ogni riquadro) e in cima a Planning Lavori e Planning Sale, ma solo se il ruolo ha il permesso `create` di quella sezione (oggi: lavori → admin, direzione, responsabile, manutentore; sale → admin, direzione, responsabile, reception).
  - Permessi `planning_work.*` e `planning_sale.*` (view/create/update + `manage` e `operate` per le sale). Il pulsante Planning in basso compare se c'è almeno uno dei due permessi di vista.
- **Task**: hub con **due riquadri affiancati, Avvisi Urgenti e Promemoria**, e sotto gli avvisi aperti e i promemoria per il tuo ruolo. Come Planning e Operatività, ogni riquadro mostra **3 numeri** (Avvisi: Da prendere · In carico · Risolti oggi; Promemoria: Per me · Attivi · Vigenti oggi) e, solo con il permesso di creare, il tasto **+ Nuovo avviso** / **+ Nuovo promemoria**; le liste hanno la stessa riga di numeri e il tasto **+ Nuovo**.
  - **Avvisi Urgenti** (`urgent_alerts`): nota rapida (max 300 caratteri) che passa da Aperto a In carico a Risolto, con ora di presa in carico e di risoluzione. Prima quelli da prendere, il più vecchio in cima. Non si cancellano.
  - **Promemoria** (`reminders`): messaggio per uno o più ruoli (nessun ruolo = tutti), ripetizione (una volta, ogni giorno, giorni scelti, ogni mese), uno o più orari, date di inizio e fine; si accende e si spegne. **L'invio automatico delle notifiche non è ancora attivo**: oggi si consultano nell'app. Chi può crearli vede "Per me" e "Tutti".
  - Permessi `urgent.*` e `reminders.*` (view/create/update). Il pulsante Task in basso compare se c'è almeno uno dei due permessi di vista.
- **Gestione** (voci nel menu laterale, ognuna col suo permesso; versioni "vuote": struttura completa, nessun dato importato):
  - **Magazzino** (`inventory_items`, `inventory_movements`, migrazione `0006`): articoli con categoria, unità, scorta minima, ubicazione; filtri Tutti / Sotto scorta / Esauriti e ricerca. La giacenza cambia **solo** con la funzione server `inventory_move` (Carico, Scarico, Rettifica), che lascia sempre un movimento e impedisce giacenze negative. Permessi `warehouse.view/create/move/manage`.
  - **Rifornimento** (`supply_products`, `supply_requests`, `supply_request_items`, migrazione `0007`): la governante chiede prodotti (Minibar / Consumo), il manutentore li segna Consegnato o Manca. Catalogo prodotti vuoto per struttura, gestito da chi ha `supplies.manage`. Richieste e righe si scrivono solo con `supply_create_request` e `supply_resolve_item`. Permessi `supplies.view/create/complete/manage`.
  - **Housekeeping** (`hk_rooms`, migrazione `0008`): camere per piano con stato Da fare · In corso · Fatta e nota. Camere aggiunte a mano (`housekeeping.manage`); "Riparti da zero" rimette tutto da fare. **Non c'è ancora l'import da Slope.** Permessi `housekeeping.view/update/manage`.
  - **Sensori e impianti** (`sensors`, `sensor_settings`, migrazioni `0009` e `0010`): la schermata ha una **stagione Inverno/Estate** (per struttura, la cambia chi ha `sensors.manage`) e due sezioni. **Layout compatto**: in cima 3 numeri (Sensori · In allerta · Non aggiornati), **barra unica** con Temperature/Interruttori e stagione affiancati (controlli piccoli) e le soglie in una riga di testo, sensori di temperatura in **riquadri a griglia** (telefono: 3 per fila in Piccolo, 2 in Normale, 1 in Grande; PC: 4 · 3 · 2) con bordo colorato per stato; tasto **+ Nuovo**.
    - **Temperature**: stati Regolare · In allerta · Non aggiornato (nessun dato da più di 30 minuti). Ruolo del sensore: *Ambiente* (soglie scritte a mano), *Motore/impianto* (inverno: allerta sotto 20 °C; estate: allerta sopra 18 °C) e *Frigo/cella* (allerta sopra 0 °C). I valori 20 / 18 / 0 sono quelli della vecchia app e stanno in `sensor_settings`.
    - **Interruttori** (relay) raggruppati in **Accesi · Spenti · Misti · Non raggiungibili** (offline o dato vecchio).
    - Le misure le scrive il lettore eWeLink (vedi sotto, non ancora attivo): dal browser si gestisce solo l'anagrafica e la stagione.
  - Come per il resto: niente DELETE dal browser, RLS su ogni tabella, `hotel_id` sempre filtrato. Le matrici dei ruoli sono scelte mie da confermare.
- **Stati segnalazione**: Da fare · Tecnico · Attesa pezzo · Completata.
- **Stile**: tema Sistema/Chiaro/Scuro e dimensione Piccolo/Normale/Grande, scelti dal **menu laterale** (sezione Aspetto). La dimensione NON è uno zoom: ogni livello ridefinisce font, spazi, altezza di pulsanti/campi/barra, icone, loghi e colonne. Token di densità in `src/ui/tokens.css` (`--hub-cols` hub: 2/2/1, `--tile-cols` tile Home: 3/2/1 in Piccolo/Normale/Grande; filtri a capo). `base.css` usa i token; `--sgrid-cols` (griglia sensori) è in `base.css`. Regola per schermate nuove: 360 px senza scroll orizzontale, griglie con `minmax(0, 1fr)` — dettaglio in [`docs/STANDARD.md`](./docs/STANDARD.md) §8. **Stile glass (2026-11-07)**: sfondo sfumato in due tinte e vetro smerigliato su barra alta, barra in basso, menu e pannelli (sfocatura solo lì: le schede hanno tinta e bordo di vetro senza sfocatura, per non pesare sui telefoni lenti; con «riduci trasparenza» o senza `backdrop-filter` il vetro diventa pieno). **Palette per struttura** in `src/lib/palette.js` (tabella id hotel → palette: Hotel Giò = Sera, Choco Hotel = Cacao, Il Brigantino = Ghiaccio; Salvia libera) applicata da `Shell` con `data-pal` sulla radice, ricordata in `localStorage` per partire già coi colori giusti; chiaro/scuro e dimensione restano scelte a parte. Token in `tokens.css` (`--g1…3`, `--glass*`, `--safe-left/right`), regole in fondo a `base.css`. **Bordi sicuri**: laterali (notch in orizzontale) su barra alta, contenuto, menu; barra in basso sospesa con stacco minimo `max(8px, safe-area)` anche con Android a tre tasti (dove il sistema dichiara 0); barra nascosta con la tastiera aperta (`src/lib/use-keyboard.js`). Vale per TUTTE le schermate, login e impostazioni compresi: i riempimenti secondari (`--surface-2`) sono un velo traslucido, campi/filtri/selettori usano `--glass-strong` con bordo `--field-line`. Prima del login la palette è l'ultima usata (default Ghiaccio). Nuova palette: aggiungere i 3 blocchi (chiaro, scuro scelto, scuro di sistema) in `tokens.css` e la riga in `PALETTES`/`HOTEL_PALETTE` (il test `palette.test.js` li controlla). **Categorie** (segnalazioni, interventi, lavori): elenco unico `CATEGORIES` in `src/lib/queue.js` (Idraulica, Elettrico, Climatizzazione, Arredi, Edilizio, Serramenti, Filtri, Idromassaggio, Extrapiani, Altro) con icone in `src/lib/forms.js`; la sincronizzazione dalla vecchia app (`legacy_category` in SQL e `CAT` in `legacy-sync/ops.ts`) deve usare solo nomi di quell'elenco (lo controlla `categories.test.js`). **Scelte sempre visibili**: un selettore a sezioni apribili (es. camere per piano in `RoomsPicker`) non nasconde mai ciò che è già scelto: le scelte stanno in una riga sempre visibile e togliibili con un tocco; «aperto» e «scelto» hanno aspetto diverso. **Regola per ogni schermata nuova**: deve reggere le tre dimensioni e il telefono stretto (360 px) senza scorrimento orizzontale: griglie con `minmax(0, 1fr)`, numero di colonne legato alle variabili (`--hub-cols`, `--tile-cols`, `--sgrid-cols`), tasti d'intestazione che non vanno a capo.
- **Attenzione agli stili**: le classi generiche (es. `.center`) valgono per tutta l'app; per i componenti della barra usare nomi specifici (`nav-*`).
- **Velocità**: ogni schermata si scarica solo quando la apri (`React.lazy`). `npm run check:bundle` fa fallire il controllo se l'avvio supera 160 KB compressi.


### Moduli di inserimento (migrazione `0011`)
Le quattro schermate "nuovo" sono state riprese dalla vecchia app e migliorate:
- **Nuova segnalazione**: categoria e urgenza a chip con icone, camera/zona con suggerimenti dal catalogo della struttura (`hotel_locations`; senza catalogo il testo è libero), **bozza salvata sul telefono** mentre scrivi.
- **Nuovo intervento**: categoria, **più camere** a piani (tocca il piano per sceglierle tutte), zona, periodo dal/al, **più assegnatari** (`hotel_staff()` restituisce solo nome e ruolo dei colleghi della stessa struttura). Dal dettaglio di una segnalazione "Crea intervento" precompila tutto, collega `issue_id` e porta la segnalazione a *Tecnico*; la segnalazione elenca gli interventi collegati.
- **Nuovo lavoro** (Planning Lavori): categoria e assegnatari oltre a descrizione e giorni.
- **Nuova prenotazione sala**: sale configurate (occupate = disattivate nel periodo), allestimenti (se ne può aggiungere uno al volo), **"Da preparare il"** (stesso giorno / giorno prima, mai dopo l'evento), controlli Audio/Video, PAX con contatore, **richiamo cliente** (sala, allestimento, PAX, note). Chi ha `planning_sale.manage` configura le sale da *Planning Sale → Configura*.
- Permessi nuovi: `planning_sale.manage` e `locations.manage` (admin, direzione, responsabile). Nessuna policy di DELETE. Le sale e i check sono descritti nella sezione Planning (migrazione `0012`).
- Il catalogo camere/zone si carica con un seed (non è nel repo pubblico).
- **Non ancora portato**: foto (serve lo storage), ricambi/magazzino negli interventi, trasformare un avviso urgente in segnalazione, gestione del catalogo luoghi da app.

## Lettore eWeLink (sensori e relay)
Funzione server `supabase/functions/ewelink-sync` (logica in `supabase/functions/_shared/ewelink.js`, testata). Legge i dispositivi dell'account eWeLink e aggiorna la tabella `sensors` **di una sola struttura**; i dispositivi si abbinano per `device_key` = id del dispositivo eWeLink.
- **Stato**: scritto dalla documentazione dell'API v2 **senza poterla provare dal vivo**. Prima di fidarsi usa la modalità prova.
- **Come la vecchia app** (`sync-sensori-temperatura`): sola lettura, connessione diretta a Postgres (`SUPABASE_DB_URL`; la chiave `service_role` via API risponde 401 alle Edge Function dal 1 ottobre 2026), credenziali dai segreti della funzione oppure, se mancano, dalla tabella `edge_function_secrets` dello stesso progetto (chiavi `ewelink_app_id`, `ewelink_app_secret`, `ewelink_email`, `ewelink_password`, `sensor_sync_secret`). La risposta elenca anche i sensori **mancanti** (nell'app ma non più restituiti da eWeLink) e quelli senza sensore nell'app. **Tasto Aggiorna** (icona rotonda nella barra Temperature/Interruttori/Stagione, senza righe in più; l'esito e "dati …" stanno nella riga delle soglie) in Sensori e impianti: chiama la stessa funzione con la sessione dell'utente (permesso `sensors.view` nella struttura, controllato dal server) e poi ricarica; se i dati sono già di meno di 60 secondi fa non richiama eWeLink. Senza connessione o senza funzione ricarica solo il database. Il segreto di sincronizzazione non è mai nel browser. In app: banner se nessun sensore si aggiorna da più di 1 ora e elenco **Non arrivano più** (nessun dato da oltre 24 ore). Un test impedisce di aggiungere chiamate di comando.
  - **Segreti** (opzionali se già in `edge_function_secrets`; mai nel repo, nei commit o in chat): `EWELINK_APP_ID`, `EWELINK_APP_SECRET` (dal portale sviluppatori eWeLink), `EWELINK_EMAIL`, `EWELINK_PASSWORD` (l'account può essere condiviso e in sola lettura: la funzione non comanda mai nulla), `EWELINK_REGION` (default `eu`), `EWELINK_COUNTRY_CODE` (default `+39`), `EWELINK_HOTEL_ID` (es. `hotelgio`), `SYNC_SECRET` (una stringa lunga a caso, serve a chi chiama la funzione).
- **Prova**: `POST <url funzione>/ewelink-sync?dry=1` con l'intestazione `x-sync-secret`. Non scrive nulla: risponde con i dispositivi trovati, quelli già abbinati (`preview`) e quelli **senza sensore nell'app** (`unmatched`, con id e nome: l'id è il "codice dispositivo" da scrivere in *Nuovo sensore*).
- **Uso**: crea in app i sensori con il codice giusto, poi chiama la funzione ogni 5 minuti (pg_cron + pg_net dal pannello Supabase, con `SYNC_SECRET` nell'intestazione). Aggiorna temperatura, umidità, relay, online e ultimo aggiornamento; un relay non tocca la temperatura. Dopo 30 minuti senza aggiornamenti l'app mostra "Non aggiornato".  Chi ha `sensors.manage` può nascondere un sensore e rimostrarlo dal filtro "Nascosti".
- **Non c'è** il comando dei relay dall'app (solo lettura). Elenco dispositivi senza paginazione: con molti dispositivi va verificato.

## Loghi e icona dell'app
Presi dalla vecchia app `Apicehotel-Manutenzione`.
- `src/assets/logos/`: mascotte **ApiceHotel** (login) e loghi di **Hotel Giò, Choco Hotel, Il Brigantino** (scelta struttura e intestazione). Sono importati dal codice (`src/lib/hotels.js`), quindi vengono pubblicati con nome a prova di cache.
- `public/icons/` + `public/manifest.webmanifest`: icona **RandApp** (192, 512, maskable, Apple) per aggiungere l'app alla schermata Home del telefono. 
- **Service worker** (`public/sw.js`, registrato da `src/lib/pwa.js` solo in produzione): oltre alle push, tiene in cache l'app (pagina + file `/assets/*` con hash + icone) così **si apre anche senza segnale**. Mai in cache i dati: Supabase è un altro dominio e il worker non lo intercetta. Pagina: prima la rete, poi l'ultima copia salvata. Se cambia la strategia di cache, incrementare `VERSION` in `sw.js` (le vecchie cache `randapp-shell-*` si cancellano da sole). Le scritture offline (coda segnalazioni/housekeeping) non ci sono ancora: sono il passo successivo.
- **Sempre l'ultima versione** (`src/lib/pwa.js`): all'avvio, al ritorno sull'app e quando torna la rete, l'app confronta i suoi file con quelli del server; se è uscita una versione nuova ricarica **una sola volta** (mai mentre stai scrivendo in un campo).
- **Sessione e orario** (`src/lib/jwt-recovery.js`, usato da `useAsync`): se una *lettura* fallisce con «JWT issued at future» (orologi non allineati) la sessione viene rinnovata e la lettura ripetuta una volta; le scritture non si ripetono mai. Se non basta, messaggio chiaro invece di errore tecnico.
- Non ancora presi: le "card" grandi delle strutture, il gatto di RandAI (quando lo riattiviamo), l'icona degli avvisi urgenti.

## Notifiche
Campanella in alto (con numero di non lette) → `/notifications`; impostazioni in `/notifications/settings`. Migrazione `0013_notifications.sql`, logica in `src/lib/notifications.js` (test), invio in `supabase/functions/notify-dispatch` (adattatori in `_shared/notify.js`, test).
- **Sempre in app**: ogni notifica finisce nella casella dell'utente (`notifications`, RLS: ognuno vede solo le sue). Fuori dall'app dipende dai canali.
- **Eventi** (tutti generati dal database, nessun invio dal browser): nuovo **avviso urgente**, promemoria "ancora da prendere in carico" e **promemoria**: questi tre solo a chi in quel momento è **in struttura** (presenza attiva, pulsante "Sono arrivato/Sono uscito"), oltre al ruolo. Come nella vecchia app la presenza **scade da sola dopo 7 h 20** e vale per **una struttura alla volta**; **segnalazione/intervento/lavoro assegnato** o urgente; **sensori in allerta**, **sensori che non arrivano più** (24 ore) e **sincronizzazione ferma** (1 ora). Il controllo periodico è `notify_run()`.
- **Canali per struttura** (`notification_channels`, li accende chi ha `notifications.manage`): **web push** (telefono/PC; su iPhone solo con l'app aggiunta alla Home), **ntfy** (topic personale lungo e casuale), **WhatsApp** (Meta Cloud API, modello approvato con 2 variabili). Ognuno sceglie per tipo di notifica quali canali usare (`notification_prefs`). **App Android/iOS (apk e Apple, in futuro)**: la tabella `notification_devices` ha già `android`/`ios`; il dispatcher li segna "non configurato" finché non si aggiunge FCM/APNs.
- **Segreti** del dispatcher (variabili della funzione o `edge_function_secrets`, mai nel repo): `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `NTFY_BASE` (default `https://ntfy.sh`), `NTFY_TOKEN`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `APP_URL`, `NOTIFY_SYNC_SECRET` (se manca usa `sensor_sync_secret`). Chiave pubblica anche nel sito: `VITE_VAPID_PUBLIC_KEY`.
- **Pianificazione** (pg_cron + pg_net dal pannello Supabase), ogni minuto: `select public.notify_run();` e una chiamata `POST <url funzione>/notify-dispatch` con l'intestazione `x-sync-secret`.
- **Prova**: in Impostazioni notifiche il tasto di prova crea una notifica per te (`notify_test`). Non provato dal vivo: nessuna migrazione né funzione è ancora su un Supabase vero (le migrazioni sono validate in PGlite, Postgres reale).

## Messa in funzione del database (Supabase condiviso con la vecchia app)
La nuova app **vive nello schema `randapp`** del progetto Supabase "Apice MultiHotel", che ospita anche la vecchia app nello schema `public`. Regole: **non si crea né si modifica niente in `public`**; utenti (`auth.users`) e Storage sono condivisi; le funzioni server della nuova app hanno nomi propri (`randapp-pin-auth`, `ewelink-sync`, `notify-dispatch`) perché `pin-auth`, `presence-status` ecc. sono della vecchia app e **non vanno sovrascritti**.
1. Applica in ordine tutti i file di `supabase/migrations/` da `0000_schema.sql` all'ultima presente (oggi fino a `0034_issue_photos_hotel_guard.sql`; la `0000` crea lo schema). **Sul database reale** vedi sotto «Stato dell'aggancio» e la tabella in [`docs/STANDARD.md`](./docs/STANDARD.md) §3: alcune migrazioni sono nel repo ma **non ancora applicate**.
2. Esponi lo schema all'API: `alter role authenticator set pgrst.db_schemas = '<elenco attuale>, randapp'; notify pgrst, 'reload config';` (il client usa `db: { schema: 'randapp' }`).
3. Pubblica le funzioni `randapp-pin-auth`, `randapp-admin`, `randapp-pin-recovery`, `ewelink-sync`, `notify-dispatch`, `legacy-sync`. Tutte leggono il database con Postgres diretto (`SUPABASE_DB_URL`) dove previsto. Elenco e regole di deploy: [`docs/STANDARD.md`](./docs/STANDARD.md) §9.
4. Utenti: gli account esistenti (`auth.users`) si riusano; profilo, appartenenza e PIN della nuova app si **copiano** da `public` a `randapp`. Seed base: `supabase/seed/00_users_from_legacy.sql` (ruoli già mappati). Nuovi utenti dal terminale:
   **Ruoli dalla vecchia app (migrazione `0031` + seme `supabase/seed/01_users_from_legacy_roles.sql`, entrambi scritti ma NON ancora applicati)**: oltre ai 6 ruoli base ci sono Capo Governante (`capo_governante`, stessi permessi di governante), Portiere Notturno (`portiere_notturno`, come reception ma solo lettura su housekeeping e urgenti), Direttore Centro Congressi (`direttore_congressi`, come direzione senza housekeeping), Tecnico esterno (`tecnico_esterno`: vede e aggiorna segnalazioni/interventi, non crea), Supremo (`supremo`: solo vedi e crea) e RandAI (`randai`: sola lettura più magazzino, mai admin). Le strutture abilitate restano quelle della vecchia app (una riga persona+struttura col ruolo di quella struttura). I promemoria senza destinatari NON vanno a Tecnico esterno e RandAI. **Nuovo ruolo**: checklist completa in [`docs/STANDARD.md`](./docs/STANDARD.md) §4 (`ROLES`, `ROLE_LABELS`, `randapp-admin`, `create-user.mjs`, vincolo SQL, test `roles-legacy.test.js`).
   ```bash
   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
   npm run user:create -- --name "Nome Cognome" --hotels hotelgio,chocohotel --role admin --pin 0000
   ```
   (usa valori tuoi: la chiave di servizio resta nel terminale).
5. Imposta `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` nell'hosting e fai il build.

### Stato dell'aggancio (aggiornato 8 novembre 2026)
Progetto condiviso `ooqlfldcrnkudhgjnied`. Schema `randapp` esposto all'API (`pgrst.db_schemas = public, graphql_public, randapp`). Funzioni edge pubblicate (senza JWT gateway: si proteggono da sole). Seed: utenti dei ruoli base, 478 luoghi, 45 sensori; segreti letti da `edge_function_secrets` della vecchia app, mai scritti qui.
Pianificazioni (pg_cron): `randapp-notify-run` ogni minuto, `randapp-notify-dispatch` ogni minuto, `randapp-ewelink-sync` ogni 10 minuti, `randapp-legacy-sync` ogni notte. Quelle della vecchia app non sono toccate.

**Migrazioni sul DB reale** (dettaglio operativo in [`docs/STANDARD.md`](./docs/STANDARD.md) §3 e in `docs/STATO.md`):
- **Applicate su Apice MultiHotel**: migrazioni `0000`–`0035`; le `0028`–`0030` risultavano nella cronologia dal 7 novembre e le `0031`–`0035` sono state applicate l'8 novembre 2026, in quest'ordine. Verificati la protezione degli hotel, l'indice sulle sale e il controllo degli amministratori globali. **Restano da effettuare i test funzionali con sessioni utenti reali** e gli eventuali seed separati: applicare una migrazione non importa automaticamente gli utenti legacy.

Script seed (in ordine, dopo le migrazioni): `00_users_from_legacy.sql`, `01_locations.sql` / `01_users_from_legacy_roles.sql` (dopo `0031`), `02_sensors.sql` / `02_issue_categories_backfill.sql` (dopo `0032`), `03_cron.sql`, `04_phones_from_legacy.sql`, `05_sale_config.sql`. Nessun PIN, hash o chiave dentro.
Nota sensori: eWeLink restituisce 30 dei 45 dispositivi; i 15 mancanti sono fermi anche nella vecchia app e la nuova li segnala come "Sensori che non arrivano più".

### Copia dalla vecchia app (segnalazioni)
La vecchia app di Hotel Giò usa un altro progetto Supabase ("HotelGio", ref `jmhzmwyolxzacjunfwcq`) con i dati completi (612 segnalazioni, non le 297 copiate in "Apice MultiHotel"). La funzione `legacy-sync` li legge **solo in lettura** (utente `randapp_reader`, solo `select` su segnalazioni, interventi, planning_lavori, prenotazioni_sale) e li copia in `randapp.issues` + `randapp.issue_photos`. Gira ogni notte alle 03:20 UTC (job `randapp-legacy-sync`) ed è idempotente (`legacy_id` = id della vecchia segnalazione).
- Tradotto per la nuova app: stati `todo/waiting/done` → `da_fare/attesa_pezzo/completata` (con tecnico → `tecnico`), urgenza `media` → `normale`. Categorie segnalazioni via `legacy_category`: con `0032` applicata → Idraulica, Elettrico, Climatizzazione, Arredi, **Edilizio**, Altro; **senza `0032`** `edilizio` finisce ancora in Altro (gli interventi in `ops.ts` mappano già Edilizio). Elenco UI completo in `CATEGORIES` (`queue.js`), inclusa Serramenti (solo app nuova). Checklist categorie: [`docs/STANDARD.md`](./docs/STANDARD.md) §5. Titolo = prima riga della nota.
- Numeri WhatsApp: **si mantengono** (`issues.created_by_phone`, formato `+39…`). Se un profilo ha lo stesso numero (`profiles.phone`, non leggibile dal browser) la segnalazione si collega a quella persona e compare il nome; altrimenti compare "WhatsApp +39…". Il collegamento è automatico (trigger `profiles_phone_link`, funzione `link_issue_senders`) anche quando il numero viene aggiunto dopo. **Ognuno imposta il proprio numero da Profilo → "Il mio numero WhatsApp"** (funzioni `get_my_phone` / `set_my_phone`: accetta `340…`, `+39 340…`, `0039…`; lo **stesso numero può stare su più utenti**, es. sviluppatore e manutentore: migrazione `0028`; le segnalazioni WhatsApp di quel numero vanno al profilo attivo più vecchio). Le sue segnalazioni passano a suo nome subito. **Profilo → "I miei dati"**: username, nome, cognome, numero WhatsApp ed email in un'unica scheda e un solo tasto Salva (funzioni `get_my_profile` / `set_my_profile`, migrazione `0029`; username unico, minuscolo, 3-30 caratteri; nessun grant al browser). Il nome con cui si accede (`display_name`) non cambia. Sulle segnalazioni WhatsApp compare "Nome Cognome" al posto del numero. Al login si può scrivere il nome (prime lettere) **o lo username** (esatto); poi si sceglie la persona e si mette il PIN. Anche l'**email può stare su più utenti** (il recupero PIN parte dall'utente scelto). Il campo numero ha il **selettore del prefisso internazionale con ricerca** (predefinito +39; componente `src/ui/PhoneField.jsx`, elenco in `src/lib/phone.js`), usato in Profilo, primo accesso, Numeri WhatsApp e Impostazioni → Utenti. Script `supabase/seed/04_phones_from_legacy.sql` copia i numeri già presenti nella vecchia app. Non copiati: dati tecnici di messaggistica.
- Fino alla dismissione la vecchia app è la fonte: modifiche fatte nella nuova su righe importate vengono riallineate alla prossima copia.
- Segreti (`legacy_db_password`, `legacy_db_host`, `legacy_project_ref`) solo in `public.edge_function_secrets`. Mai in repo.
- Copiati con lo stesso metodo (file `ops.ts`): **interventi** (stato `pending/done` → `da_fare/fatto`; categorie Filtri, Idromassaggio, Edilizio, Extrapiani, Arredi, Altro; assegnatari collegati ai profili per nome; camere e "camere fatte" in `rooms`/`rooms_done`), **planning lavori** (un lavoro con i suoi giorni e lo stato per giorno `fatto/da_finire/da_fare`; lavori senza giorni saltati) e **prenotazioni sale** (una riga per giorno; turno `tutto_giorno` → `giornata`; le date passate risultano già `fatto`). Le righe importate non mandano notifiche. Non copiate: foto degli interventi, piani, dati del tecnico esterno.

- **Numeri sui filtri**: ogni filtro di Segnalazioni e Interventi mostra quanti elementi contiene (es. "Tutte 612"), per controllare che non ne manchino.

## Registro errori (per ogni app, sempre attivo)
Ogni errore (richiesta al server fallita, script rotto, accesso che non va, variabili mancanti) viene scritto nel registro **con la causa vera** e **di chi è la colpa**: **App** (bug, configurazione, servizio), **Utente** (PIN, permessi, sessione scaduta, troppi tentativi, dato non valido) o **Dispositivo** (nessuna connessione, versione in cache, memoria piena, estensioni del browser). Se dal solo errore non si può essere sicuri, il verdetto dice "probabile". Accanto c'è sempre "Cosa fare".
- Dove si vede: **Profilo → Registro errori** (`#/errors`), e anche **prima del login** ("Problemi? Vedi registro errori" nella schermata di accesso e nella schermata "Configurazione mancante"). Filtri per causa, "Copia tutto" per mandarlo a chi gestisce l'app. Gli **admin** vedono anche gli errori di tutti i dispositivi (ultimi 7 giorni).
- **Prova collegamento** (stessa schermata di accesso): un tasto che contatta il server e dice in chiaro dove si ferma (app non configurata, server non raggiungibile, indirizzo/chiave sbagliati). Il server di accesso è stato verificato funzionante (elenco nomi risponde); se sul telefono i nomi non compaiono, questo tasto indica la causa.
- Codice: `src/lib/errorlog.js` (raccolta, pulizia dei segreti, `classify()` = il verdetto), richieste intercettate in `src/lib/supabase.js`, accesso in `src/lib/auth.js`, schermata `src/screens/ErrorLog.jsx`. Tabella `randapp.app_errors` (migrazioni 0020–0022), scrittura solo con `log_client_error()`, lettura solo admin, cancellazione dopo 30 giorni (job `randapp-errors-cleanup`).
- Mai dentro: PIN, token, chiavi (vengono tolti prima di salvare/inviare). Per aggiungere una regola di verdetto: `classify()` e il suo test in `test/errorlog.test.js`.

## RandAI (in pausa)
Il punto d'ingresso è `src/randai/`. La **chat** (`RandAI.jsx`, rotta `/randai`, pulsante in basso) è sempre raggiungibile e si carica solo quando la apri; con `VITE_FEATURE_RANDAI` spento mostra il messaggio "in pausa" e il campo è disabilitato. Il collegamento al servizio è tutto in `src/randai/client.js` (`askRandAI`, per ora lancia "non ancora collegato"): per accenderlo si sostituisce solo quella funzione. Tutto il codice di RandAI vive in quella cartella.

## Struttura
```
AGENTS.md              regole comuni agli strumenti AI
CLAUDE.md              rimando ad AGENTS.md
.cursor/rules/         regole Cursor (rimando ad AGENTS.md)
docs/STATO.md          passaggio di consegne tra strumenti
docs/STANDARD.md       come standardizzare (ruoli, categorie, migrazioni, sicurezza)
src/app/               App, router a hash, interruttori funzioni (features.js)
src/lib/               supabase, auth, permessi, coda priorità, preferenze UI, hook
src/data/              accesso ai dati (sempre filtrato per hotel_id)
src/screens/           Login, Home (riepilogo), Operatività, Segnalazioni, Interventi, Planning (hub, Lavori, Sale), Task (hub, Avvisi Urgenti, Promemoria), Magazzino, Rifornimento, Housekeeping, Sensori, Nuova segnalazione/intervento, Profilo
src/assets/logos/      loghi (ApiceHotel e strutture)
src/ui/                tokens.css (colori/dimensioni), base.css, Shell (barra + header), Drawer (menu), componenti
src/randai/            RandAI (predisposto, spento)
supabase/migrations/   schema database con RLS
supabase/functions/    randapp-pin-auth (login con PIN lato server), ewelink-sync (lettore eWeLink), notify-dispatch (invio notifiche), _shared (logica comune)
scripts/               create-user, check-bundle
test/                  test automatici (permessi, coda, schema RLS, niente segreti)
```

## Sessione scaduta

Se la sessione finisce (per esempio perché lo stesso utente accede da un altro dispositivo, o il rinnovo del token non riesce) l'app torna al login con l'avviso "Sessione scaduta" (`onSessionLost` e `verifySession` in `src/lib/auth.js`, gestiti in `App.jsx`). Il controllo col server avviene quando si torna sull'app. Se si è solo offline non si viene disconnessi.

## Hosting: Vercel (produzione), Netlify solo prova

- **Produzione**: [https://randapphotel.vercel.app](https://randapphotel.vercel.app) (Vercel). Build: `npm ci && npm run build`, cartella `dist`, variabili `VITE_*` impostate **prima** del build.
- **Netlify è solo provvisorio** (prove): https://randapp.netlify.app. Config in `netlify.toml` (stesso build; `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` / `VITE_FEATURE_RANDAI` nel file — chiave **anon** pubblica; il test `no-secrets` ammette lì solo JWT con ruolo `anon`).
- Dopo ogni cambio di URL pubblico: aggiornare `app_url` / `APP_URL` in `edge_function_secrets` e nei segreti delle edge (`randapp-pin-recovery`, `notify-dispatch`). Il default in codice di recovery è ancora Netlify: in produzione **impostare** `APP_URL=https://randapphotel.vercel.app`.
- Aprire l'app sempre dall'indirizzo in Safari/Chrome, non da anteprime di file (bloccano il collegamento al server).

## Numeri WhatsApp (admin)

- **Profilo → Numeri WhatsApp** (`#/phones`, solo permesso `admin.access`): elenco persone con o senza numero (prima quelle senza), campo per assegnare/togliere il numero, e i numeri che hanno scritto su WhatsApp senza essere assegnati a nessuno (con numero di segnalazioni e ultima data). Funzioni `admin_phone_overview` e `admin_set_phone` (migrazione `0023`): il numero non è mai leggibile con una select dal browser. Quando un numero viene assegnato, le segnalazioni WhatsApp passano dal numero al nome.

## Planning (come è organizzato)

- **Planning Lavori** (`#/planning/work`): due sezioni. *Lavori* = i lavori da fare per giorno (settimana); *Sale da preparare* = la lista operativa delle prenotazioni sale nel loro giorno di preparazione, con Audio/Video e Fatto (visibile con il permesso `planning_sale.view`).
- **Planning Sale** (`#/planning/sale`): calendario mensile delle sale. Conta la data dell'**evento**; il numero sul giorno è quante sale sono occupate, tocca il giorno per il dettaglio. Nuova prenotazione con "+ Nuovo".

## Sale: configurazione copiata dalla vecchia app

- `supabase/seed/05_sale_config.sql` (ripetibile) copia sale, allestimenti e clienti ricorrenti da `public.sale_*` (vecchia app multi-hotel) a `randapp.sale_rooms/sale_layouts/sale_clients`. Le sale hanno `family` (Trumpet, Sax, Auditorium…) e `parts`: una combinazione (es. *Trumpet 1+2*) occupa anche le sale che la compongono, quindi non è prenotabile se una parte è già presa.
- Nel modulo di prenotazione: ricerca sala, stato Libera/Parziale/Occupata nel periodo, la sala si azzera se date/turno la rendono non libera, allestimento obbligatorio, richiamo cliente.

- **Prenotazione su più giorni**: scegli "Evento dal/al" e per ogni giorno il turno (Mattina, Pomeriggio, Tutto il giorno; "Tutti: …" li imposta insieme). Si salva **una riga per giorno** (`createBookingDays`, tutto o niente, max 31 giorni). La sala risulta Libera solo se lo è in ogni giorno con il turno di quel giorno. Preparazione: la data scelta vale per il primo giorno, gli altri giorni "stesso giorno".

## Login (schermata fissa, come la vecchia app)

- Una sola schermata: **Utente** (2+ lettere, suggerimenti) e **PIN** (4 cifre, entra da solo). La struttura **non** si sceglie prima: la ricerca nomi interroga tutte le strutture e unisce le persone uguali; se la persona ha più strutture, dopo il PIN sceglie con quale lavorare (poi si cambia dal menu, senza rifare il PIN).
- Il PIN si prova **una sola volta** (sulla struttura preferita o la prima): la sessione è della persona. Provarlo su ogni struttura consumerebbe i 5 tentativi prima del blocco di 10 minuti.
- Sotto: "Problemi? Vedi registro errori" e "Prova collegamento" (diagnosi in chiaro). **Non cambiare questo aspetto senza che l'utente lo chieda.**

### Login: interruttore tema, Impostazioni, tasti
- In alto a destra c'è l'**interruttore sole/luna** (chiaro/scuro, come la vecchia app); "Sistema" resta nel menu laterale.
- Sotto "oppure" c'è la riga **Impostazioni** ("Configura l'app e le preferenze"): apre l'accesso protetto amministratore: **solo il PIN amministratore a 6 cifre, nessun nome** (come la vecchia app). Entra come admin di sistema e va alle **Impostazioni admin** (`#/settings`).
- "Registro errori" e "Prova collegamento" stanno sulla stessa riga.

## Impostazioni admin (`#/settings`, permesso `admin.access`)
Come la vecchia app, adattate a PIN per persona e WhatsApp. Si apre da Profilo → Impostazioni admin o dal login (riga "Impostazioni").
- **Utenti**: elenco e ricerca; crea utente (nome, ruolo, PIN 4 cifre, numero WhatsApp facoltativo); modifica nome/ruolo/attivo; numero WhatsApp (assorbe "Numeri WhatsApp", che resta per i numeri non assegnati); cambia PIN; sblocca dopo troppi tentativi. Non puoi toglierti da solo il ruolo admin né disattivarti.
- **Ruoli**: matrice ruolo → permessi con interruttori (valgono per tutte le strutture; `admin` tiene sempre `admin.access`).
- **Notifiche**: canali WhatsApp / ntfy / push attivabili per struttura, invii ultimi 7 giorni, ultimi falliti, destinazioni registrate, quante persone hanno il numero. (Per ora tutti i canali sono spenti: si accendono qui quando i segreti del server sono configurati.)
- **Consumi**: dimensione database, connessioni usate su massimo (barra), foto e peso, grafico segnalazioni/interventi degli ultimi 30 giorni, conteggi della struttura, destinazioni notifiche (funzione `admin_usage`, migrazione `0030`; helper `usagePercent` e `activityBars` in `src/lib/admin.js`).
- **Diagnostica**: errori ultimi 7 giorni (registro con la causa), invii falliti, numeri non assegnati.
- Server: migrazione `0024_admin_settings.sql` (RPC `admin_*`, tutte con controllo permesso, mai PIN o hash) e funzione edge `randapp-admin` (crea utente e cambia PIN con bcrypt, verifica sessione e `admin.access`; il PIN non è mai nei log né restituito).
- Non portate dalla vecchia app: scheda Sensori (c'è già la schermata Sensori), link per tecnici esterni (Fase 4).

### Accesso alle Impostazioni (PIN amministratore)
- Come la vecchia app (`admin-gate`): **un solo PIN a 6 cifre**, senza scegliere il nome. È lo **stesso PIN** della vecchia app: sta (solo come hash bcrypt) in `public.edge_function_secrets`, chiave `ADMIN_PANEL_PIN_BCRYPT`. Nessun PIN nel repo.
- Azione `admin_login` della funzione `randapp-pin-auth`: verifica il PIN sul server e apre la sessione dell'admin di sistema ("Randagio", admin attivo in tutte le strutture). Se quella persona non esiste/non è admin ovunque, l'accesso è rifiutato.
- Tentativi sbagliati contati per origine (hash di IP + dispositivo, tabella `randapp.admin_gate_attempts`, migrazione 0025): 5 errori = blocco 10 minuti.
- Il PIN si cambia nella vecchia app finché esiste; una scheda per cambiarlo qui non c'è ancora.

### Login pulito: rotella accanto al tema
- In alto a destra: **rotella Impostazioni** + switch sole/luna. La rotella apre l'accesso con PIN amministratore (la scheda mostra solo il PIN a 6 cifre); toccala di nuovo o "‹ RandApp" per tornare al login normale. La riga "Impostazioni" nella scheda non c'è più.

## RandAI: base per un'IA locale futura (migrazione 0026)
Obiettivo: oggi nessun modello a pagamento obbligatorio; intanto si **raccolgono le scelte** per allenare più avanti un modello locale e staccarsi dal cloud.
- **Casi simili già risolti** (`src/ui/SimilarCases.jsx`, RPC `similar_cases`): nella nuova segnalazione (mentre scrivi) e nel dettaglio di una segnalazione aperta mostra fino a 3 casi chiusi simili con soluzione e ricambio. È ricerca testuale italiana nel database (indice GIN su `issues`), **senza modelli e senza costi**, limitata alla struttura e al permesso `issues.view`.
- **Percorso unico** (`src/lib/ai.js`): regole → storico → modello **locale** (spento) → **cloud** (spento, solo se serve e c'è budget). Ogni risposta registra il gradino: la quota locale deve salire nel tempo (si vede in Impostazioni → IA).
- **Registro** (`randapp.ai_interactions`, `ai_feedback`; scrive solo `ai_log`, 120 righe/ora per persona): ogni "Casi simili" mostrato, il giudizio Sì/No e la **scelta della persona** quando invia una segnalazione (testo → categoria e urgenza, `source = human`). Numeri di telefono ed email vengono tolti **sul client e di nuovo sul server** (`ai_scrub`). Mai PIN, token, chiavi.
- **Esempi verificati**: Impostazioni → IA → "Scarica esempi verificati (.jsonl)" (`ai_training_export`, solo admin): giudizi positivi, correzioni, scelte umane + storico dei casi chiusi (circa 600). Sono la materia prima per allenare un modello locale.
- **Chat RandAI**: resta spenta (`askRandAI` non collegato). Quando si collega, deve passare dal percorso unico e registrare con `logAi`.
- Regole per l'allenamento futuro: solo esempi verificati da persone, a lotti e con prova su casi noti prima dell'uso; niente allenamento automatico; il modello locale gira su una macchina nostra (da decidere), non su Supabase.

### Numero WhatsApp: lo scrive ciascuno
- Non serve che l'admin sappia a chi appartiene ogni numero. Dopo l'accesso, in **Home**, chi non ha ancora il numero vede la scheda "Il tuo numero WhatsApp" (`src/ui/PhonePrompt.jsx`): lo scrive e salva; "Più tardi" la nasconde 7 giorni. Si può cambiare sempre da Profilo → Il mio numero WhatsApp.
- "Numeri non assegnati" (admin) è solo informativo: i numeri senza persona si collegano da soli quando ciascuno inserisce il proprio.

## Recupero PIN via email o WhatsApp (Twilio)
La schermata di accesso offre la scelta **email** (link monouso valido 15 minuti) o **WhatsApp** (OTP di 6 cifre valido 15 minuti). Il canale WhatsApp compare disabilitato fino alla configurazione e all'approvazione del template; l'email continua a funzionare senza Twilio.

**Template preparato (non ancora creato nell'account Twilio):** `twilio/templates/randapp_pin_recovery_it.json`, tipo `whatsapp/authentication`, italiano, pulsante copia codice, scadenza 15 minuti. Meta non consente di personalizzare liberamente il testo dei template Authentication.
- Anteprima senza rete e senza invii: `node scripts/create-twilio-pin-template.mjs`
- Creazione effettiva su account Twilio, **solo dopo esplicita approvazione e configurazione**: `TWILIO_ACCOUNT_SID=... TWILIO_AUTH_TOKEN=... node scripts/create-twilio-pin-template.mjs --create`
- Dal Content Template Builder inviare il nuovo template alla **revisione WhatsApp/Meta**; copiare il Content SID che inizia con `HX`.
- Impostare solo nei secrets della Edge Function `randapp-pin-recovery`: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` (`whatsapp:+...`), `TWILIO_PIN_CONTENT_SID` (`HX...`), `TWILIO_OTP_PEPPER` (valore casuale segreto di almeno 32 caratteri).
- **Non** attivare `TWILIO_RECOVERY_ENABLED=true` prima dell'approvazione esplicita dei costi dei messaggi, dei test di consegna e della verifica del sender.
- Il PIN non è mai spedito; si riceve solo un OTP e lo si inserisce nella schermata di cambio PIN. Gli OTP sono registrati solo come digest, con massimo 5 tentativi di convalida per ora per utente e consumo atomico del token.

## Recupero PIN via email (migrazione `0027`, funzione `randapp-pin-recovery`)
- Ognuno scrive la **propria email** in Profilo → "La mia email" (la vede solo lui; dopo `0029` l'email **non è più unica** tra profili: il recupero parte dall'utente scelto al login).
- Al login, scelto il nome, "**PIN dimenticato?**" manda un link (vale 15 minuti, una sola volta) con la pagina `#/recover?token=…` dove si sceglie il nuovo PIN. La risposta è sempre la stessa, con o senza email nel profilo; il token è salvato solo come hash; limiti: 3 richieste/ora per utente e 10/ora per origine. Il nuovo PIN azzera blocco e tentativi.
- Invio con **Gmail SMTP (porta 465)**. Segreti della funzione (Supabase → Edge Functions → Secrets, mai nel repo): `GMAIL_USER`, `GMAIL_APP_PASSWORD` (password per le app di Google), **`APP_URL=https://randapphotel.vercel.app`** (obbligatorio in produzione; se manca il default nel codice punta ancora a Netlify).
- Impostazioni → Diagnostica mostra se il recupero è "attivo" o "non configurato".


## Skill per gli agenti (Claude, Cursor, GPT, ecc.)

Le skill sono in `.agents/skills` e valgono per tutti gli agenti che le supportano.
Installate da obra/superpowers (versioni in `skills-lock.json`):

- writing-plans: scrivere un piano a passi prima di toccare il codice
- executing-plans: eseguire il piano con controlli a ogni tappa
- verification-before-completion: verificare prima di dichiarare un lavoro finito
- using-git-worktrees: sessioni parallele su branch separati
- finishing-a-development-branch: chiusura branch con test, commit e PR
- subagent-driven-development: lavoro diviso tra sotto-agenti, con revisione a ogni passo

Installazione: `npx skills add obra/superpowers --skill <nome>` dalla cartella del repo.
