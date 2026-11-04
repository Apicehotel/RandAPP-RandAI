# STATO DEL PROGETTO

File di passaggio di consegne tra Claude, Cursor e Codex. Aggiornalo a ogni sessione di lavoro.

## In corso
_Nessun lavoro in corso._ (Scrivi qui: strumento, branch, cosa stai facendo.)

## Fatto
- 2026-11-04 — Claude (branch `claude/schema-randapp`): **scelta dell'utente: schema separato `randapp` nel Supabase "Apice MultiHotel"**. Il progetto è il database vivo della vecchia app (100+ tabelle, 50 funzioni, 38 utenti, 34 PIN): collidevano `hotels`, `role_permissions`, `hotel_memberships`, `sale_clients`, `supply_*`, `inventory_*`, `is_hotel_member`, `supply_create_request`, e le funzioni `pin-auth`/`presence-status`. Ora: migrazione `0000_schema.sql`, tutte le altre in `randapp.*` (nessun oggetto in `public`, verificato in PGlite: 0 tabelle/funzioni/trigger in public, 32 tabelle tutte con RLS), client con `db: { schema: 'randapp' }`, login `randapp-pin-auth` riscritto con Postgres diretto, `ewelink-sync` e `notify-dispatch` su `randapp.*` (i segreti si leggono ancora da `public.edge_function_secrets`). Test 138. Da fare: applicare sul progetto, esporre lo schema a PostgREST, pubblicare le funzioni, copiare gli utenti con ruoli chiari.
- 2026-11-04 — Claude (branch `claude/presenza-7h20`): presenza allineata alla vecchia app (letta in `apicehotel-manutenzione`: `presence-status`, `expire_stale_presence`, `utenti.in_struttura*`). **Scade da sola dopo 7 h 20** (app: `PRESENCE_MAX_MINUTES = 440`; server: `expire_presence()`, chiamata da `notify_run()`, e la notifica controlla comunque l'orario) e si è **in struttura in una struttura alla volta** (`set_presence` spegne le altre). Validato in PGlite. Differenze rimaste: nella vecchia app segnavano la presenza solo manutentore, Portiere Notturno e admin, e gli avvisi urgenti andavano per ruolo senza guardare la presenza (la presenza serviva a widget e allerta meteo): qui la presenza vale per tutti i ruoli e filtra avvisi e promemoria, come richiesto. Test 138.
- 2026-11-04 — Claude (branch `claude/notifiche-presenti`): **avvisi urgenti (nuovo e sollecito) e promemoria arrivano solo a chi è "in struttura"** (presenza attiva, tabella `presence`), oltre al filtro per ruolo. `notify()` ha il nuovo parametro `p_only_present`, usato da questi tre eventi; modificata la `0013` (non ancora applicata da nessuna parte). "Avviso preso in carico" va sempre al creatore. Provato in PGlite (5 scenari) e con test. **Attenzione**: se nessuno è in struttura, nessuno riceve l'avviso (resta visibile in Task). In Impostazioni notifiche i tre tipi riportano "solo se sei in struttura". Test 138.
- 2026-11-04 — Claude (branch `claude/home-bolla`): la bolla del tasto Home non sporge più sopra la barra (sul telefono i contenuti la coprivano: era quello il "cappuccio" che spariva). Ora sta **dentro** la barra, che è un po' più alta; la barra ha anche `z-index` sopra i contenuti. Verificato a 360 px Piccolo/Normale/Grande e 1200 px. Solo grafica.
- 2026-11-04 — Claude (branch `claude/intestazione-fissa-tutte`): l'intestazione fissa vale ora per **tutte le schermate** (Operatività, Planning, Home, Task, Segnalazioni, Interventi, Sensori, moduli di creazione, ecc.), senza toccare le singole schermate: regola CSS in `base.css` sul primo blocco di `.page` che contiene l'`h1`. L'area scorrevole non ha più padding in alto, così l'offset `sticky` è uguale ovunque; Home torna alla struttura normale (niente più `.fixed-head`). Controllate 29 rotte × 4 configurazioni (360 px Piccolo/Normale/Grande, 1200 px) in Chromium: titolo fermo e nessuno scorrimento orizzontale. **Da confermare su iPhone** (qui WebKit non c'è). RandAI è la chat: scorre solo il registro, il campo resta in basso. Solo grafica.
- 2026-11-04 — Claude (branch `claude/aggiorna-librerie`): librerie aggiornate alle ultime: React 19.3.1, Vite 8.3.5, @vitejs/plugin-react 6.2.1, @supabase/supabase-js 2.119.0, bcryptjs 3.0.3. `npm audit`: 0 vulnerabilità; 137 test, build e budget ok (avvio 138,5 KB su 160). **Non toccate** le librerie delle Edge Function (Deno: `postgres@3.4.7`, `web-push@3.6.7`, `bcryptjs@2.4.3`, supabase-js `@2`): non provabili senza Supabase vero; `postgres` 4.0 esiste ma è una major da provare dal vivo.
- 2026-11-04 — Claude (branch `claude/home-intestazione-fissa`): correzione: il primo tentativo (`position: sticky`) non reggeva sul telefono. Ora in Home il titolo "Oggi" è fuori dall'area che scorre (`.page.fixed-head` + `.page-scroll`), quindi non scompare su nessun browser. Solo grafica.
- 2026-11-04 — Claude (branch `claude/home-intestazione`): in Home l'intestazione ("Oggi" + data) resta **ferma in alto** mentre le schede scorrono (`.page-head` in `base.css`, riusabile in altre schermate). Verificato a 360/390/1200 px in Piccolo/Normale/Grande. Solo CSS.
- 2026-11-04 — Claude (branch `claude/menu-profilo`): il menu laterale si apre **solo dal cerchio del profilo** (in alto a destra); "Altro" tolto dalla barra. Il quinto posto in basso è ora la **chat RandAI**, predisposta: schermata `/randai` con messaggi e campo di scrittura, spento finché `VITE_FEATURE_RANDAI` non è `true`; `src/randai/client.js` (`askRandAI`) è il solo punto da collegare. Verificato a 360 px (Piccolo/Normale/Grande) e a 1200 px. Nessuna migrazione. Test 137.
- 2026-11-04 — Claude (branch `claude/notifiche`): **sistema notifiche**. Migrazione `0013` (casella per utente, preferenze per tipo×canale, canali per struttura, dispositivi web/android/ios/ntfy/whatsapp, coda di invio, memoria dei controlli, `notify_run()`), campanella con contatore, schermate Notifiche e Impostazioni, `public/sw.js` (solo push), funzione `notify-dispatch` (web push, ntfy, WhatsApp; app native "non configurato", predisposte per apk/Apple). Eventi: avviso urgente, assegnazioni/urgenti, sensori in allerta/senza dati/sync ferma, promemoria. Migrazioni validate in PGlite (Postgres reale), anteprima verificata a 360 px in Piccolo/Normale/Grande. **Non provato dal vivo**: servono VAPID, pg_cron e un Supabase vero. Test 138.
- 2026-11-04 — Claude (branch `claude/sensori-aggiorna-riga`): il tasto Aggiorna non ha più una riga propria: è un'icona rotonda nella barra Temperature/Interruttori/Stagione; esito e "dati data/ora" nella riga delle soglie. Icona `refresh` in `kit.jsx`. Solo grafica.
- 2026-11-04 — Claude (branch `claude/sensori-aggiorna`): tasto manuale **Aggiorna** in Sensori e impianti. La funzione `ewelink-sync` accetta anche la sessione dell'utente (permesso `sensors.view`, verificato sul server) oltre al segreto di pg_cron; freno di 60 secondi; la chiave di sincronizzazione non è mai nel browser. Mostra "Ultimo dato …" e l'esito. Non provato dal vivo (serve la funzione attiva sul Supabase agganciato). Test 122.
- 2026-11-04 — Claude (branch `claude/ewelink-come-vecchia`): lettore eWeLink riscritto come quello della vecchia app. Postgres diretto (`SUPABASE_DB_URL`, niente `service_role` via API: dal 1/10/2026 dà 401), credenziali da segreti o da `edge_function_secrets`, sola lettura (test che vieta i comandi), risposta con `missing` e `unmatched`. In app: banner sincronizzazione ferma (>1 ora) e elenco "Non arrivano più" (>24 ore). Account eWeLink condiviso, quindi nessuna correzione possibile da qui: serve avvisare il titolare. Non provato dal vivo: prima `?dry=1` sul Supabase esistente. Test 122.
- 2026-11-04 — Claude (branch `claude/sensori-barra`): in Sensori e impianti Temperature/Interruttori e la stagione (Inverno/Estate) stanno **sulla stessa riga**, come controlli piccoli; le soglie diventano una riga di testo piccolo sotto. Su telefono stretto le etichette si abbreviano (Temp. / Interr.); con Grande vanno a capo. Solo grafica.
- 2026-11-04 — Claude (branch `claude/sensori-piccolo`): con dimensione Piccolo i sensori di temperatura stanno **a file di 3** (`--sgrid-cols: 3`), con riquadri più compatti (temperatura 20px, nome piccolo, umidità e soglia nascoste, stato in etichetta ridotta). Solo CSS.
- 2026-11-04 — Claude (branch `claude/schermate-adattive`): schermate adattive a Piccolo/Normale/Grande e da 360 px al PC. Corretto il bug dei moduli (Nuovo intervento / Nuova prenotazione sala) che uscivano dallo schermo sul telefono: `.page` e `.two` ora usano `minmax(0, 1fr)`, campi con `min-width: 0`. Griglia sensori legata a `--sgrid-cols` (2 telefono, 3 PC; Piccolo 4 su PC; Grande 1 telefono / 2 PC). Tasti d'intestazione senza a-capo; 3 numeri in colonna con Grande su telefono stretto. Scansione di 21 schermate × 3 dimensioni × 3 larghezze senza scorrimento orizzontale. Solo CSS.
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

- 2026-11-04 — Claude (branch `claude/aggancio-supabase`): **aggancio al Supabase esistente** (schema separato `randapp`). Applicate `0000`–`0014` (la `0014` fissa il `search_path` di due funzioni trigger), schema esposto a PostgREST, funzioni `randapp-pin-auth`, `ewelink-sync`, `notify-dispatch` pubblicate e provate (ricerca nomi OK; eWeLink in prova a vuoto e poi reale: 30 dispositivi trovati e abbinati), utenti dei 5 ruoli mappati copiati dentro il database (PIN invariati), seed luoghi (478) e sensori (45), pg_cron attivo. `ewelink-sync` ora aggiorna i sensori di **tutte** le strutture per codice dispositivo; `notify-dispatch` legge le chiavi VAPID come `vapid_public`/`vapid_private` (nomi della tabella condivisa). `public` non è stato toccato. **Da fare: prova di login su telefono vero.**

## Da fare (in ordine)
1. ~~Agganciare il Supabase esistente~~ (fatto il 2026-11-04, vedi sopra).
2. **Provare il login e le segnalazioni su un telefono vero** (vedi note sotto).
3. Notifiche WhatsApp (API Meta) sulle segnalazioni.
4. Coda offline (Dexie) che conserva l'hotel di origine dell'operazione.
5. Housekeeping (import Excel), presenze, temperature.
6. PWA installabile, deploy.
7. Assegnazione segnalazioni (`issues.assign` esiste già nei permessi ma non ha ancora una schermata).
8. Riattivare RandAI (dopo il lancio).

## Note per il prossimo strumento
- **Il login con PIN non è ancora stato provato da un telefono**: la funzione risponde e il database è pronto, ma manca la prova PIN → sessione → segnalazioni reale. Build e test passano; le schermate sono state viste renderizzate solo con dati demo (mock), non su Supabase vero: manca ancora la prova PIN → sessione → segnalazioni reale. È il primo controllo da fare.
- Tutte le sezioni della barra (Operatività, Planning, Home, Task) hanno ormai i loro permessi nel database; non resta nessuna voce con `perm: null` tranne Profilo e il menu "Altro".
- Il PIN è di 4 cifre (come nella vecchia app): la protezione è nel blocco dopo 5 errori (10 minuti) e nel limite sulla ricerca nomi.
- Database: agganciato al Supabase esistente nello schema `randapp` (2026-11-04). Non toccare `public` (vecchia app) senza il ok dell'utente. Ruoli speciali della vecchia app (Portiere Notturno, Capo Governante, Direttore Centro Congressi, Tecnico esterno, RandAI, Supremo) non ancora copiati: i loro utenti non possono entrare nella nuova app finché i ruoli non sono decisi.
- Non aggiungere dipendenze o fogli CSS di override senza un motivo concreto; il budget del bundle è controllato da `npm run check:bundle`.
