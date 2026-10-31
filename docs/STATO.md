# STATO DEL PROGETTO

File di passaggio di consegne tra Claude, Cursor e Codex. Aggiornalo a ogni sessione di lavoro.

## In corso
_Nessun lavoro in corso._ (Scrivi qui: strumento, branch, cosa stai facendo.)

## Fatto
- 2026-10-31 — Claude: struttura di collaborazione (`AGENTS.md`, `CLAUDE.md`, `.cursor/rules/`, `docs/STATO.md`, `.gitignore`).
- 2026-10-31 — Claude (branch `claude/base-app`): base dell'app.
  - Scheletro React + Vite, schermate caricate a richiesta, stile chiaro/scuro con dimensioni P/N/G.
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

## Da fare (in ordine)
1. Creare il progetto Supabase nuovo, applicare `0001_base.sql`, pubblicare `pin-auth`, creare i primi utenti (vedi README).
2. **Provare il login e le segnalazioni su un telefono vero** (vedi note sotto).
3. Notifiche WhatsApp (API Meta) sulle segnalazioni.
4. Coda offline (Dexie) che conserva l'hotel di origine dell'operazione.
5. Housekeeping (import Excel), presenze, temperature.
6. PWA installabile, deploy.
7. Assegnazione segnalazioni (`issues.assign` esiste già nei permessi ma non ha ancora una schermata).
8. Riattivare RandAI (dopo il lancio).

## Note per il prossimo strumento
- **Il login non è mai stato provato end-to-end**: non esisteva ancora un progetto Supabase. Build e test passano, ma nessuno ha visto le schermate renderizzate né provato PIN → sessione → segnalazioni. È il primo controllo da fare.
- Planning e Task nella barra non hanno ancora un permesso nel database (`perm: null` in `src/lib/permissions.js`, visibili a tutti): quando li costruiamo vanno aggiunti a `role_permissions` e il valore va cambiato.
- Il PIN è di 4 cifre (come nella vecchia app): la protezione è nel blocco dopo 5 errori (10 minuti) e nel limite sulla ricerca nomi.
- Non usare mai il database delle app vecchie: lo schema qui è pensato per un progetto Supabase separato.
- Non aggiungere dipendenze o fogli CSS di override senza un motivo concreto; il budget del bundle è controllato da `npm run check:bundle`.
