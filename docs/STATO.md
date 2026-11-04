# STATO DEL PROGETTO

File di passaggio di consegne tra Claude, Cursor e Codex. Aggiornalo a ogni sessione di lavoro.

## In corso
_Nessun lavoro in corso._ (Scrivi qui: strumento, branch, cosa stai facendo.)

## Fatto
- 2026-11-04 — Claude (branch `claude/sensori-layout`): layout di Sensori e impianti compatto: riga dei 3 numeri, stagione su una riga, temperature in riquadri a griglia con bordo per stato, "Nascondi" più piccolo, tasto "+ Nuovo". Solo grafica (`Sensors.jsx`, `base.css`), nessuna migrazione.
- 2026-11-04 — Claude (branch `claude/task-pattern`): Task con lo stesso schema (hub e liste con 3 numeri, tasti "+ Nuovo avviso"/"+ Nuovo promemoria" solo con permesso). `alertStats`, `reminderStats` in `src/lib/task.js`; riuso di `src/ui/hub.jsx`. Nessuna migrazione. Test 119.
- 2026-11-04 — Claude (branch `claude/operativita-pattern`): Operatività con lo stesso schema del Planning.
  - Hub: riquadri Segnalazioni/Interventi con 3 numeri (`issueStats`, `interventionStats`: fatte/fatti = completati oggi) e tasto "+ Nuova segnalazione"/"+ Nuovo intervento" solo con il permesso di creare. Componenti condivisi in `src/ui/hub.jsx` (`HubChoice`, `StatRow`). Liste: riga dei 3 numeri e tasto "+ Nuova"/"+ Nuovo". Nessuna migrazione. Test 118.
- 2026-11-02 — Claude (branch `claude/sensori-stagioni`): Sensori divisi in **Temperature** e **Interruttori** (Accesi/Spenti/Misti/Non raggiungibili) con **stagione Inverno/Estate**.
  - Migrazione `0010_sensor_seasons.sql`: ruolo del sensore (ambiente/motore/frigo) e tabella `sensor_settings` (stagione e soglie 20/18/0 della vecchia app). Test: 101.
  - Interpretazione mia della richiesta (la frase era troncata): da confermare. Lo script di importazione dei 45 sensori (fuori dal repo) ora assegna il ruolo "motore" ai sensori C/F; va eseguito dopo `0009` e `0010`.
- 2026-11-02 — Claude (branch `claude/sensori-nascosti`): in Sensori e impianti chi gestisce vede il filtro "Nascosti (n)" e li può rimostrare. I 45 sensori della vecchia app (progetto Apice MultiHotel) sono pronti da importare con uno script **tenuto fuori dal repo** (repo pubblico: codici dispositivo e nomi delle zone sono dati interni); si applica al nuovo database dopo `0009` e dopo il primo utente.
- 2026-11-02 — Claude (branch `claude/lettore-ewelink`): lettore eWeLink per i sensori.
  - Funzione `ewelink-sync` + `_shared/ewelink.js` (login firmato, elenco dispositivi, lettura temperatura/umidità/relay, modalità prova `?dry=1`, elenco dispositivi senza sensore). Test `ewelink.test.js` (97 in totale).
  - **Non provato contro l'API eWeLink vera**: formato delle risposte scritto dalla documentazione v2; da verificare con la modalità prova appena ci sono app id/secret. Da verificare anche paginazione dell'elenco e limiti di login.
  - Mancano: progetto Supabase (segreti e pianificazione ogni 5 minuti), comando relay dall'app. Alternativa se eWeLink dà problemi: Home Assistant.
- 2026-10-31 — Claude (branch `claude/moduli-operativi`): moduli di gestione dalla vecchia app, in versione "vuota" (struttura completa, nessun dato importato). Impianti = sensori e relay.
  - Migrazioni `0006` Magazzino, `0007` Rifornimento, `0008` Housekeeping, `0009` Sensori. Menu laterale: gruppo **Gestione**. Test `management.test.js` (87 in totale), avvio 138,3 KB.
  - Scritture sensibili solo da funzioni server: giacenza (`inventory_move`), richieste (`supply_create_request`/`supply_resolve_item`), struttura camere (`hk_set_room_active`, `hk_reset_day`); misure dei sensori non scrivibili dal browser.
  - **Non portato** (da fare se serve): magazzino con categorie/ubicazioni gerarchiche, trasferimenti, inventario, ricambi negli interventi, barcode; import camere da Slope e contabilità housekeeping; sincronizzazione eWeLink (misure, comando relay), regole stagionali dei sensori; notifiche; tile nella Home per i nuovi moduli.
  - Matrici dei permessi dei 4 moduli = mie scelte, da confermare. Verificato solo con l'anteprima (dati demo): le migrazioni non sono mai state eseguite su un Postgres vero.
- 2026-10-31 — Claude: struttura di collaborazione (`AGENTS.md`, `CLAUDE.md`, `.cursor/rules/`, `docs/STATO.md`, `.gitignore`).
- 2026-10-31 — Claude (branch `claude/base-app`): base dell'app.
  - Scheletro React + Vite, schermate caricate a richiesta, stile chiaro/scuro con dimensioni P/N/G.
  - Aspetto nel menu laterale (`ui/Appearance.jsx`): tema e dimensione. Dimensione = densità vera (token per font, spazi, controlli, icone, colonne), non zoom; test `density.test.js`. Tolto dal Profilo.
  - Login PIN + scelta struttura (`src/screens/Login.jsx`, funzione server `supabase/functions/pin-auth`).
  - Schema database `0001_base.sql` con RLS (hotel, profili, membership, permessi, segnalazioni).
  - Home (coda per priorità) e Segnalazioni (lista con filtri, dettaglio con cambio stato, nuova).
  - RandAI predisposto e spento (`src/randai/`, interruttore `VITE_FEATURE_RANDAI`).
  - Test: 18 passano. Avvio 132,5 KB compressi (limite 160).

- 2026-10-31 — Claude (branch `claude/shell-5-sezioni`): navigazione come la vecchia app.
  - Barra in basso a 5 posti: Operatività, Planning, Home (centro), Task, Altro (RandAI quando acceso).
  - Header con struttura a sinistra e cerchio con le iniziali a destra, che apre il menu laterale (`src/ui/Drawer.jsx`).
  - Hub Operatività (collegamento alle Segnalazioni + top 3). Planning e Task sono segnaposto "In arrivo".
  - Test: 25 passano. Avvio 134,4 KB compressi (limite 160).

- 2026-10-31 — Claude (branch `claude/fix-barra-home`): corretto un errore di layout trovato guardando l'anteprima in un browser vero.
  - Il pulsante Home della barra usava la classe `.center`, già usata dalle schermate a tutta pagina (`min-height: 100dvh`): allungava la barra a tutto lo schermo. Ora la classe è `.nav-home`.
  - Prima schermata Home vista renderizzata (anteprima con dati demo, PIN demo 1234): ora struttura, cerchio profilo e 5 sezioni sono al posto giusto.

- 2026-10-31 — Claude (branch `claude/interventi`): Operatività ora ha 2 sezioni interne, Segnalazioni e Interventi.
  - Migrazione `0002_interventions.sql` (tabella con RLS, permessi `interventions.*`), lista con filtri Aperti/Fatti/Tutti, dettaglio con cambio stato, nuovo intervento.
  - Hub Operatività con le due sezioni e le top 3 di ciascuna. Non ancora: assegnazione a un tecnico, collegamento intervento ↔ segnalazione (c'è già la colonna `issue_id`), camere multiple, ricambi/pezzi come nella vecchia app.

- 2026-10-31 — Claude (branch `claude/hub-2-riquadri`): nell'hub Operatività le due sezioni sono due riquadri affiancati (`.hub-grid`).

- 2026-10-31 — Claude (branch `claude/planning`): Planning con hub a due riquadri, Planning Sale e Planning Lavori.
  - Migrazione `0003_planning.sql` (tabelle `planning_works` e `sale_bookings`, RLS, permessi `planning_work.*` e `planning_sale.*`).
  - Planning Lavori: lavori su più giorni, vista settimanale, stato. Planning Sale: prenotazioni per giorno, turni, controllo sovrapposizioni, annullamento.
  - La matrice dei permessi per ruolo del Planning è una **scelta mia da confermare**: manutentore gestisce i lavori e vede le sale; reception gestisce le sale e vede i lavori; governante solo vista.
  - Non ancora portato dalla vecchia app: elenco sale configurabile per struttura (ora il nome sala è testo libero con suggerimenti), clienti ricorrenti, configurazioni/allestimenti, "da preparare il" per la manutenzione, audio/video.
  - Il controllo doppie prenotazioni è nell'app (non c'è un vincolo nel database): due persone che salvano nello stesso istante potrebbero sovrapporsi. Da blindare con un vincolo quando ci sarà l'elenco sale.

- 2026-10-31 — Claude (branch `claude/task`): Task con hub a due riquadri, Avvisi Urgenti e Promemoria.
  - Migrazione `0004_task.sql` (tabelle `urgent_alerts` e `reminders`, RLS, permessi `urgent.*` e `reminders.*`). Rimossa la schermata segnaposto "In arrivo".
  - Matrice permessi **scelta mia da confermare**: tutti vedono e inviano avvisi (manutentore, responsabile, direzione e admin li gestiscono); i promemoria li crea e gestisce reception, responsabile, direzione e admin; gli altri li vedono.
  - **Non attivo**: l'invio dei promemoria (notifiche WhatsApp/push all'orario). Ora sono solo dati da consultare. È la voce "Notifiche" della roadmap.
  - Non ancora portato dalla vecchia app: trasformare un avviso in segnalazione, escalation/solleciti degli avvisi urgenti, foto sui promemoria, aggiornamento in tempo reale, nome di chi ha inviato/preso in carico (ora si salva l'id utente, non lo si mostra).

- 2026-10-31 — Claude (branch `claude/home-riepilogo`): Home riscritta come riepilogo della giornata.
  - Riquadri per sezione, **Chi c'è in struttura** (presenza manuale, migrazione `0005_presence.sql`), **Da fare adesso** (elenco unico).
  - Home ora visibile a tutti (`perm: null`); Operatività compare con segnalazioni **o** interventi; le rotte `/issues` e `/interventions` hanno ciascuna il proprio controllo permessi.
  - Presenza: solo check-in/out a mano, niente GPS né storico; dopo 16 ore non risulta più presente. Scelta mia, da confermare.
  - Non ancora: aggiornamento in tempo reale, presenze per orario/turno, GPS.

- 2026-10-31 — Claude (branch `claude/loghi`): loghi presi dalla vecchia app.
  - Mascotte ApiceHotel nel login, logo di ogni struttura nella scelta struttura e nell'intestazione.
  - Icone installabili e `manifest.webmanifest` (senza service worker: la PWA offline resta da fare).
  - Lasciati fuori: card grandi delle strutture, `randai-cat.webp`, `icon-urgent-192.png`.

- 2026-10-31 — Claude (branch `claude/cambia-struttura`): cambio struttura dal chip in alto a sinistra (e da "Cambia struttura" nel menu).
  - Selettore `src/ui/HotelPicker.jsx`: legge le iscrizioni dell'utente (`hotel_memberships`, già leggibili) e rilegge ruolo e permessi della nuova struttura con la stessa sessione, senza PIN. Le schermate si ricaricano da sole perché dipendono da `ctx.hotelId`.
  - Se l'utente ha una sola struttura il selettore lo dice e offre "Entra con un altro utente" (vecchio comportamento: torna al login).
  - **Da provare sul Supabase vero**: il cambio al volo funziona se lo stesso utente ha l'iscrizione in più strutture (`npm run user:create --hotels hotelgio,chocohotel`).

- 2026-11-02 — Claude (branch `claude/moduli-inserimento`): moduli di inserimento migliorati (migrazione `0011_forms.sql`).
  - Nuova segnalazione/intervento/lavoro/sala: luoghi con suggerimenti (`hotel_locations`), bozze sul telefono, assegnatari multipli (`hotel_staff()`), più camere per intervento, collegamento segnalazione → intervento (`issue_id`), sale/allestimenti/clienti (`sale_rooms`, `sale_layouts`, `sale_clients`), "Da preparare il", audio/video. Logica pura in `src/lib/forms.js` (test in `test/management.test.js`, 108 test).
  - Nuovi permessi `planning_sale.manage`, `locations.manage` (admin/direzione/responsabile). Schermata `/planning/sale/config`.
  - **Seed dei luoghi** fuori dal repo (pubblico): va eseguito dopo `0011`. Non portati: foto, ricambi, avviso→segnalazione, gestione luoghi da app, "da preparare il" nella lista lavori del manutentore.
  - **Decisione utente (2026-11-02)**: niente nuovo progetto Supabase; ci si aggancia al Supabase esistente più avanti. Prima di applicare le migrazioni lì va controllato che i nomi delle tabelle (`issues`, `interventions`, `sale_bookings`…) non collidano con quelle della vecchia app.

- 2026-11-02 — Claude (branch `claude/planning-allineato`): Planning riallineato alla vecchia app (migrazione `0012_planning_ops.sql`). Nella PR #18 avevo aggiunto campi ma lasciato un modello diverso; qui è corretto.
  - **Lavori**: stato **per giorno** (`planning_work_days`, riempita da un trigger alla creazione del lavoro e per i lavori esistenti) con Da fare · Da finire · Fatto · Annullato, chi e quando; funzione `planning_work_day_set`. `planning_works.status` ora lo imposta il server (il browser non lo scrive più).
  - **Sale**: lista per giorno di preparazione, stato operativo e **check Audio/Video** con "Fatto" bloccato (`sale_booking_set_op/_check`, permesso `planning_sale.operate`), famiglie e **combinazioni** (`sale_rooms.family/parts`), disponibilità Libera/Parziale/Occupata, modifica prenotazione, calendario eventi nel riepilogo Planning.
  - Grant a colonne su `sale_bookings`: dal browser solo i dati; stati/check solo via funzioni. Home: i lavori contano i giorni (non più il lavoro intero).
  - Logica in `src/lib/planning.js` (test in `test/planning.test.js`, 116 test totali). Anteprima: `dayStats`, `prepStats`, `roomAvailability`.
  - Non portato: sensori/audio-video automatici (test con microfono/telecamera: nel vecchio erano solo segnaposto), notifiche di assegnazione, eliminazione di un giorno (qui "annulla"), ruolo "Direttore Centro Congressi" (qui: `planning_sale.manage/update` a direzione e responsabile; da confermare).

- 2026-11-03 — Claude (branch `claude/planning-tasto-nuovo`): tasto **+ Nuovo** anche nel riepilogo Planning (sotto Lavori e Sale) e rinominato "+ Nuovo" nelle due liste. Compare solo con il permesso `create` del ruolo: la reception non vede "Nuovo lavoro", il manutentore non vede "Nuova prenotazione" (come nella vecchia app).

- 2026-11-04 — Claude (branch `claude/menu-nuovo-planning`): menu laterale con **Nuovo planning lavori** e **Nuovo planning sale** (permessi `planning_work.create` / `planning_sale.create`).

- 2026-11-04 — Claude (branch `claude/ritocchi-planning`): link con il colore del tema e pastiglie Audio/Video allineate.

## Da fare (in ordine)
1. Agganciare il Supabase **esistente** (scelta dell'utente): verificare collisioni di nomi, applicare `0001`…`0012` in ordine, pubblicare `pin-auth` e `ewelink-sync`, creare i primi utenti, eseguire i seed (sensori, luoghi).
2. **Provare il login e le segnalazioni su un telefono vero** (vedi note sotto).
3. Notifiche WhatsApp (API Meta) sulle segnalazioni.
4. Coda offline (Dexie) che conserva l'hotel di origine dell'operazione.
5. Housekeeping (import Excel), presenze, temperature.
6. PWA installabile, deploy.
7. Assegnazione segnalazioni (`issues.assign` esiste già nei permessi ma non ha ancora una schermata).
8. Riattivare RandAI (dopo il lancio).

## Note per il prossimo strumento
- **Il login non è mai stato provato end-to-end**: non esisteva ancora un progetto Supabase. Build e test passano; le schermate sono state viste renderizzate solo con dati demo (mock), non su Supabase vero: manca ancora la prova PIN → sessione → segnalazioni reale. È il primo controllo da fare.
- Tutte le sezioni della barra (Operatività, Planning, Home, Task) hanno ormai i loro permessi nel database; non resta nessuna voce con `perm: null` tranne Profilo e il menu "Altro".
- Il PIN è di 4 cifre (come nella vecchia app): la protezione è nel blocco dopo 5 errori (10 minuti) e nel limite sulla ricerca nomi.
- Database: l'utente ha deciso di agganciarsi al Supabase esistente (2026-11-02). Lo schema è nato per un progetto separato: prima di applicare le migrazioni controllare collisioni con le tabelle della vecchia app e non toccare i dati esistenti senza il suo ok.
- Non aggiungere dipendenze o fogli CSS di override senza un motivo concreto; il budget del bundle è controllato da `npm run check:bundle`.
