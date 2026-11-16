# STANDARD — come lavorare su questo repo (per tutti gli agenti)

File di **standardizzazione** per Claude, Cursor e Codex. Se README e codice divergono, correggi la documentazione; se il database e il codice divergono, **non inventare**: segnala lo scarto in `docs/STATO.md` e aspetta conferma prima di applicare migrazioni.

Regole obbligatorie di collaborazione: [`AGENTS.md`](../AGENTS.md). Come funziona l'app: [`README.md`](../README.md). Stato operativo: [`docs/STATO.md`](./STATO.md).

---

## 1. Fonti di verità (in ordine)

| Cosa | Dove |
|------|------|
| Comportamento utente, stack, comandi | `README.md` |
| Regole di collaborazione AI | `AGENTS.md` |
| Cosa è fatto / in corso / da fare | `docs/STATO.md` |
| **Come standardizzare** (questo file) | `docs/STANDARD.md` |
| Schema e sicurezza reale | `supabase/migrations/*.sql` (RLS e grant) |
| Elenco ruoli UI | `src/lib/admin.js` → `ROLES` + `src/lib/permissions.js` → `ROLE_LABELS` |
| Elenco categorie | `src/lib/queue.js` → `CATEGORIES` |

Non duplicare matrici lunghe nel README: collega qui o al file sorgente.

---

## 2. Branch e consegne

- Prefisso: Claude `claude/…`, Cursor `cursor/…`, Codex `codex/…`. Mai commit diretti su `main`.
- Prima: `git fetch origin && git rebase origin/main` (o parti da `main` aggiornato).
- Controlla `docs/STATO.md` → **In corso**: non toccare il lavoro di un altro strumento.
- Dopo ogni modifica: aggiorna `README.md` se cambia il funzionamento **e** aggiungi una riga in `docs/STATO.md` (Fatto / Da fare / Note).
- Commit: messaggi brevi in italiano all'imperativo (`Aggiungi…`, `Correggi…`).
- Mai PIN, password, token, chiavi API, hash nel README, nei commit, nel codice o nei log. Solo **nomi** di variabili d'ambiente.

---

## 3. Migrazioni e database

### Ordine
1. Nuova migrazione = file successivo in `supabase/migrations/` (`0034_….sql`, …), mai modificare una migrazione già applicata in produzione se si può evitare: meglio una migrazione nuova.
2. Schema **solo** `randapp.*`. **Non creare né modificare oggetti in `public`** (vecchia app) senza ok esplicito dell'utente.
3. Funzioni edge con nomi propri (`randapp-pin-auth`, `randapp-admin`, `randapp-pin-recovery`, `ewelink-sync`, `notify-dispatch`, `legacy-sync`): non sovrascrivere `pin-auth` / `presence-status` della vecchia app.

### Stato applicato (da aggiornare in STATO quando cambia)
Aggiornare sempre questa tabella e la sezione equivalente del README dopo un deploy DB.

| Intervallo | Stato sul progetto condiviso |
|------------|------------------------------|
| `0000`–`0027` | Trattare come **applicate** (aggancio + admin + recovery + AI; vedi Fatto in STATO) |
| `0028` telefoni condivisi | **Applicata** su Apice MultiHotel (cronologia 2026-11-07) |
| `0029` username / profilo | **Applicata** su Apice MultiHotel (cronologia 2026-11-07) |
| `0030` Consumi v2 | **Applicata** su Apice MultiHotel (cronologia 2026-11-07) |
| `0031` ruoli legacy | **Applicata** su Apice MultiHotel (2026-11-08) |
| `0032` categorie edilizio | **Applicata** su Apice MultiHotel (2026-11-08) |
| `0033` harden UPDATE / foto / slot sale | **Applicata** su Apice MultiHotel (2026-11-08) |
| `0034` isolamento foto | **Applicata** su Apice MultiHotel (2026-11-08) |
| `0035` protezione permessi globali | **Applicata** su Apice MultiHotel (2026-11-08): funzione `can_manage_global_roles` verificata, 2 admin globali su 3 hotel attivi. |
| `0036` cestino di 7 giorni | **Applicata** su Apice MultiHotel (2026-11-13): tabella `randapp.cestino`, trigger `cestino_salva` su 10 tabelle operative, job `randapp-cestino-7-giorni` (03:40 UTC). Provata con un test annullato (lavoro + 2 giorni cancellati e ripristinati senza duplicati). |
| `0037` schermata Cestino | **Applicata** su Apice MultiHotel (2026-11-13): funzioni `randapp.cestino_elenco/_ripristina/_elimina/_svuota` (permesso `admin.access`, filtro per struttura), grant solo a `authenticated`. Verificati i grant; prova funzionale con sessione admin reale da fare. |

**Regola:** se il codice assume una migrazione non ancora applicata, **non redeployare** la funzione edge / non far entrare utenti sui nuovi ruoli finché la migrazione non è sul DB — oppure documenta lo scarto in STATO e lascia un fallback.

**Dopo `0033`:** il client che chiude interventi/segnalazioni può scrivere `completed_by_name`; senza `0033` sul DB il grant colonnare manca e l’update potrebbe fallire se è già stato ristretto — applica `0033` prima o insieme al deploy che usa quei campi. I grant colonnari di `0033` **sostituiscono** l’UPDATE tabellare: senza applicare `0033` il comportamento resta quello precedente (UPDATE pieno, rischio `hotel_id`).

### Checklist dopo una migrazione applicata
1. Aggiorna la tabella sopra + README «Stato dell'aggancio».
2. Se cambia RPC/colonne usate dal client: verifica schermate e test.
3. Se cambia elenco ruoli o `legacy_category`: redeploy delle edge coinvolte (`randapp-admin`, `legacy-sync`, `randapp-pin-auth`).
4. Riga in `docs/STATO.md`.

---

## 4. Ruoli — elenco unico da tenere allineato

**12 ruoli** (6 base + 6 dalla vecchia app). Fonte UI: `ROLES` in `src/lib/admin.js`.

```
admin, direzione, responsabile, manutentore, governante, reception,
capo_governante, portiere_notturno, direttore_congressi, tecnico_esterno, supremo, randai
```

### Quando aggiungi o rinomini un ruolo, aggiorna TUTTI questi punti
1. `src/lib/admin.js` — `ROLES`
2. `src/lib/permissions.js` — `ROLE_LABELS`
3. `scripts/create-user.mjs` — array `ROLES`
4. `supabase/functions/randapp-admin/index.ts` — array `ROLES`
5. Nuova migrazione SQL: `CHECK` su `hotel_memberships.role` e su `reminders.target_roles` (+ eventuali allowlist in `admin_user_update` / `admin_role_set`)
6. Seed permessi in migrazione (come `0031`)
7. Se serve in assegnazioni: `ASSIGNABLE_ROLES` in `src/lib/forms.js`
8. Test: `test/roles-legacy.test.js` (deve restare verde)

Senza `0031` sul DB i CHECK ammettono solo i 6 ruoli base: creare i nuovi ruoli fallisce.

---

## 5. Categorie — elenco unico

Fonte: `CATEGORIES` in `src/lib/queue.js` (icone in `src/lib/forms.js`).

```
Idraulica, Elettrico, Climatizzazione, Arredi, Edilizio, Serramenti,
Filtri, Idromassaggio, Extrapiani, Altro
```

### Quando aggiungi una categoria
1. `src/lib/queue.js` — `CATEGORIES`
2. Icona in `src/lib/forms.js` se manca
3. Se arriva dalla vecchia app: aggiorna `randapp.legacy_category` con **nuova** migrazione (non riscrivere `0015` se già applicata) e/o `supabase/functions/legacy-sync` (`ops.ts` / SQL)
4. Test: `test/categories.test.js`

**Scarto noto:** senza `0032`, `legacy_category` mappa ancora `edilizio` → `Altro` (`0015`); gli interventi in `ops.ts` usano già `Edilizio`. Non documentare solo «Altro» nel README.

---

## 6. Sicurezza e multi-hotel (standard codice)

1. **Ogni query client** su tabelle con `hotel_id` deve filtrare `.eq('hotel_id', hotelId)` (anche se c'è RLS). Stesso per update/delete logici.
2. **Nuove policy UPDATE**: preferire grant a **colonne esplicite** che **escludono** `hotel_id`, `created_by` e campi legacy; modello in `0012_planning_ops.sql` e `0033_harden_updates.sql`. Evitare `grant update` sulla tabella intera. Trigger `forbid_hotel_id_change` su tabelle operative.
3. **Niente DELETE** dal browser sulle tabelle operative (annulla / stato, non cancella).
4. Scritture sensibili (PIN, presenza, magazzino, sync, admin) solo via **RPC / Edge Function**, non insert/update diretti dal client.
5. UI (`can(...)`, rotte): solo UX. La sicurezza vera è RLS + funzioni server.
6. Segreti solo in Supabase Secrets / `public.edge_function_secrets` (vecchia app) / `.env` locale (gitignore). `netlify.toml` può contenere solo variabili `VITE_*` pubbliche (anon key). Preferire `NOTIFY_SYNC_SECRET` dedicato (non riusare il segreto sensori).
7. Foto / `issue_photos`: `WITH CHECK` deve verificare che `issue_id` appartenga allo stesso `hotel_id` (`0033` e `0034`).
8. `admin_role_set` modifica la matrice **globale**: dalla migrazione `0035` solo gli utenti con ruolo `admin` attivo in **tutte le strutture attive** e `admin.access` nella struttura richiesta possono modificarla. Gli admin di singola struttura hanno sola lettura; non attribuire `admin.access` a ruoli operativi senza approvazione.
9. Hook dati: `useAsync` / `useUnread` devono invalidare risposte vecchie (contatore di generazione) al cambio hotel.

---

## 7. Valori fissi da non contraddire

| Tema | Valore corretto | Note |
|------|-----------------|------|
| Scadenza presenza | **7 h 20** (`PRESENCE_MAX_MINUTES = 440` in `src/lib/home.js`; server `expire_presence`) | Non scrivere «16 ore» |
| Login | Una schermata: utente (nome **o** username) + PIN 4 cifre; struttura **dopo** il PIN se multi-hotel | Funzione: `randapp-pin-auth` (non `pin-auth`) |
| Hosting produzione | **Vercel** — https://randapphotel.vercel.app | Netlify = solo prova; default `APP_URL` in recovery va allineato a Vercel |
| Email profilo | **Non unica** (dopo `0029`); stesso numero WhatsApp su più utenti (dopo `0028`) | |
| Schema DB | `randapp` | Client: `db: { schema: 'randapp' }` |

---

## 8. Layout mobile (standard UI)

- Telefono prima: reggere **360 px** e densità Piccolo / Normale / Grande **senza scroll orizzontale**.
- Griglie: `minmax(0, 1fr)` e colonne da variabili (`--hub-cols`, `--tile-cols`, `--sgrid-cols`). Non hardcodare colonne a breakpoint che annullano Grande.
- Token in `src/ui/tokens.css`; `base.css` usa i token (se aggiungi una variabile di layout, mettila nei token o documenta l'eccezione).
- Intestazione fissa: primo blocco `.page` con `h1` (regola in `base.css`).
- Scelte nei moduli: sempre visibili e togliibili (`RoomsPicker` / pattern «scelte visibili»).
- Classi generiche (es. `.center`) non per la barra: usare `nav-*`.

---

## 9. Edge functions — elenco e deploy

| Cartella | Ruolo |
|----------|--------|
| `randapp-pin-auth` | Login PIN, directory nomi/username, admin gate |
| `randapp-admin` | Crea utente / reset PIN (admin) |
| `randapp-pin-recovery` | Recupero PIN email (`APP_URL` = URL app reale) |
| `ewelink-sync` | Sensori (sola lettura) |
| `notify-dispatch` | Invio notifiche |
| `legacy-sync` | Copia notturna dalla vecchia app |

Dopo cambio sorgente: **pubblicare di nuovo** la funzione sul progetto Supabase. Documentare in STATO se manca il redeploy.

---

## 10. Checklist prima di dire «fatto»

1. `npm test` (o almeno i test della zona toccata) e, se tocchi UI/bundle, `npm run check`.
2. Nessun segreto nei diff.
3. README aggiornato se cambia il funzionamento; riga in STATO.
4. Se hai aggiunto ruolo/categoria/migrazione: checklist sezioni 3–5 di questo file.
5. Non dichiarare migrazioni «applicate» se non lo sono sul DB reale.
6. Se tocchi `public/sw.js` o `vite.config.js` (plugin `swPrecache`): tieni i segnaposto `__BUILD__` / `__PRECACHE__` e, se cambia la strategia di cache, incrementa `VERSION`. Una nuova scrittura che deve funzionare offline passa da `src/lib/outbox.js` (vedi README «Modifiche senza rete»): mai accodare un rifiuto del server, solo «server non raggiunto».
