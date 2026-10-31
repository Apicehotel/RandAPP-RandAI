# STATO DEL PROGETTO

File di passaggio di consegne tra Claude, Cursor e Codex. Aggiornalo a ogni sessione di lavoro.

## In corso
_Nessun lavoro in corso._ (Scrivi qui: strumento, branch, cosa stai facendo.)

## Fatto
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

## Da fare (in ordine)
1. Creare il progetto Supabase nuovo, applicare `0001_base.sql`, `0002_interventions.sql`, `0003_planning.sql`, `0004_task.sql` e `0005_presence.sql`, pubblicare `pin-auth`, creare i primi utenti (vedi README).
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
- Non usare mai il database delle app vecchie: lo schema qui è pensato per un progetto Supabase separato.
- Non aggiungere dipendenze o fogli CSS di override senza un motivo concreto; il budget del bundle è controllato da `npm run check:bundle`.
