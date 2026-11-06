# Interventi: chi li ha creati/chiusi e camere fatte — Piano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nel dettaglio di un intervento mostrare chi lo ha creato, chi lo ha chiuso e quali camere sono già fatte (n su m).

**Architecture:** La logica sta in due funzioni pure in `src/lib/interventions.js`, provate con `node:test`. Le colonne `created_by_name`, `completed_by_name` e `rooms_done` esistono già e sono già leggibili dal browser (migrazione `0019`): basta aggiungerle alla select in `src/data/interventions.js` e mostrarle in `InterventionDetail`. Nessuna migrazione, nessuna scrittura nuova, nessuna dipendenza.

**Tech Stack:** React 19, Vite 8, `node:test`.

**Spec:** `docs/STATO.md`, riga del 2026-11-05 (`claude/import-interventi-planning-sale`): "l'app non mostra ancora `rooms_done` negli interventi né il nome di chi ha creato". Colonne e permessi in `supabase/migrations/0019_legacy_ops.sql`. Forma di `rooms_done` in `supabase/functions/legacy-sync/ops.ts`: oggetto `{ "<camera>": { at: ISO|null, by: string|null } }`.

## Global Constraints

- Testi dell'interfaccia in italiano.
- Nessuna nuova dipendenza e nessuna migrazione: solo lettura.
- Avvio dell'app entro 160 KB compressi (`npm run check:bundle`).
- Nessuno scorrimento orizzontale a 360 px nelle tre dimensioni (Piccolo, Normale, Grande); colori e misure solo da `src/ui/tokens.css`.
- Nessun dato sensibile (PIN, password, token) in codice, README, commit o log.
- Branch `claude/interventi-chi-e-camere`; mai su `main` (`AGENTS.md`, regola 4).
- A fine lavoro: aggiornare `README.md` e aggiungere una riga in `docs/STATO.md` (`AGENTS.md`, regola 2).

## Review Focus

- `rooms_done` assente, `null` o `{}`: nessun errore, "0 su n" camere fatte.
- Intervento senza camere (`rooms` vuoto): nessuna sezione camere e nessun "0 su 0".
- Una camera presente in `rooms_done` ma non in `rooms`: ignorata, non conteggiata.
- Una camera fatta con `at` o `by` a `null`: risulta fatta, senza data né nome e senza la scritta "undefined" o "null".
- Intervento creato dall'app (`created_by_name` nullo): il nome si ricava da `created_by` e dalla lista colleghi; se la persona non c'è nella lista, nessuna riga "Creato da".

(Ogni riga ha il suo test nel Task 1.)

---

### Task 1: Logica pura per camere fatte e persone

**Files:**
- Modify: `src/lib/interventions.js` (aggiungere in fondo, più l'import di `staffNames`)
- Test: `test/interventions.test.js`

**Interfaces:**
- Consumes: `staffNames(staff, ids)` da `src/lib/forms.js`: restituisce i nomi dei soli id trovati in `staff` (elementi `{ user_id, display_name }`).
- Produces:
  - `roomsProgress(item) -> { total: number, done: number, rooms: { room: string, done: boolean, at: string | null, by: string | null }[] }`. L'ordine e l'elenco delle camere sono quelli di `item.rooms`.
  - `interventionPeople(item, staff) -> { createdBy: string | null, completedBy: string | null }`. `createdBy` = `created_by_name` (senza spazi ai lati) se c'è, altrimenti il nome di `created_by` nella lista `staff`, altrimenti `null`. `completedBy` = `completed_by_name` solo se `item.status === 'fatto'`, altrimenti `null`.

- [ ] **Step 1: Scrivere i test che falliscono** in `test/interventions.test.js` (aggiungere `roomsProgress, interventionPeople` all'import esistente)

```js
test('roomsProgress segue l ordine di rooms e conta le fatte', () => {
  const item = { rooms: ['101', '102', '103'], rooms_done: { '102': { at: '2026-11-02T09:00:00.000Z', by: 'Luca' } } }
  const p = roomsProgress(item)
  assert.equal(p.total, 3)
  assert.equal(p.done, 1)
  assert.deepEqual(p.rooms.map((r) => r.room), ['101', '102', '103'])
  assert.deepEqual(p.rooms[1], { room: '102', done: true, at: '2026-11-02T09:00:00.000Z', by: 'Luca' })
  assert.equal(p.rooms[0].done, false)
})

test('roomsProgress: rooms_done assente, null o vuoto -> 0 fatte', () => {
  for (const rooms_done of [undefined, null, {}]) {
    const p = roomsProgress({ rooms: ['101', '102'], rooms_done })
    assert.equal(p.total, 2)
    assert.equal(p.done, 0)
  }
})

test('roomsProgress: senza camere -> total 0 e nessuna riga', () => {
  for (const rooms of [undefined, null, []]) {
    assert.deepEqual(roomsProgress({ rooms, rooms_done: { '101': { at: null, by: null } } }), { total: 0, done: 0, rooms: [] })
  }
})

test('roomsProgress: una camera fuori da rooms viene ignorata', () => {
  const p = roomsProgress({ rooms: ['101'], rooms_done: { '999': { at: null, by: null } } })
  assert.equal(p.done, 0)
  assert.equal(p.rooms.length, 1)
})

test('roomsProgress: at e by nulli -> fatta senza data né nome', () => {
  const p = roomsProgress({ rooms: ['101'], rooms_done: { '101': { at: null, by: null } } })
  assert.deepEqual(p.rooms[0], { room: '101', done: true, at: null, by: null })
})

test('interventionPeople: created_by_name, poi il profilo, altrimenti null', () => {
  const staff = [{ user_id: 'u1', display_name: 'Anna' }]
  assert.equal(interventionPeople({ created_by_name: '  Marco ', created_by: 'u1' }, staff).createdBy, 'Marco')
  assert.equal(interventionPeople({ created_by_name: null, created_by: 'u1' }, staff).createdBy, 'Anna')
  assert.equal(interventionPeople({ created_by_name: null, created_by: 'zz' }, staff).createdBy, null)
  assert.equal(interventionPeople({ created_by_name: null, created_by: null }, undefined).createdBy, null)
})

test('interventionPeople: completedBy solo se fatto e con nome', () => {
  assert.equal(interventionPeople({ status: 'fatto', completed_by_name: 'Luca' }, []).completedBy, 'Luca')
  assert.equal(interventionPeople({ status: 'in_corso', completed_by_name: 'Luca' }, []).completedBy, null)
  assert.equal(interventionPeople({ status: 'fatto', completed_by_name: null }, []).completedBy, null)
})
```

- [ ] **Step 2: Verificare che falliscano**

Run: `node --test test/interventions.test.js`
Expected: FAIL (le due funzioni non sono esportate da `src/lib/interventions.js`).

- [ ] **Step 3: Implementare `roomsProgress(item)` e `interventionPeople(item, staff)` in `src/lib/interventions.js`**

Costruire le righe da `item.rooms` (array, altrimenti vuoto) e leggere `rooms_done` solo se è un oggetto semplice; il confronto delle camere è per stringa identica. Riusare `staffNames` per il nome da `created_by`.

- [ ] **Step 4: Verificare che passino**

Run: `npm test`
Expected: PASS (tutti i test, compresi i 7 nuovi).

- [ ] **Step 5: Commit**

```bash
git add src/lib/interventions.js test/interventions.test.js
git commit -m "Interventi: logica per camere fatte e persone"
```

---

### Task 2: Mostrare i dati nel dettaglio intervento

**Files:**
- Modify: `src/data/interventions.js` (costante `COLUMNS`)
- Modify: `src/screens/Interventions.jsx` (componente `InterventionDetail`)
- Modify: `README.md` (paragrafo Interventi), `docs/STATO.md`

**Interfaces:**
- Consumes: `roomsProgress(item)` e `interventionPeople(item, staff)` dal Task 1; `staff` è già letto in `InterventionDetail` con `listStaff`.
- Produces: nulla che altri task usino.

- [ ] **Step 1: Aggiungere `created_by_name,completed_by_name,rooms_done` a `COLUMNS` in `src/data/interventions.js`**

Le colonne sono già leggibili (`grant select` della `0019`); nessun'altra modifica ai dati.

- [ ] **Step 2: In `InterventionDetail` sostituire la riga "Camere: …" e aggiungere le persone**

  - Se `roomsProgress(item).total > 0`: titolo "Camere: {done} su {total} fatte" e un elenco, una riga per camera: "✓ 101 · fatta il {formatDate(at)} da {by}" oppure "○ 102"; data e nome compaiono solo se presenti.
  - Se `interventionPeople(...).createdBy`: riga "Creato da {nome}".
  - La riga "Fatto il …" resta e, se c'è `completedBy`, diventa "Fatto il … da {nome}".
  - Nessun nuovo file CSS: usare le classi già presenti (`muted`, `stack`).

- [ ] **Step 3: Verificare**

Run: `npm run check`
Expected: test, build e controllo bundle passano. Poi aprire un intervento importato (con camere) a 360 px in Piccolo, Normale e Grande: nessuno scorrimento orizzontale, nessuna scritta "undefined" o "null".

- [ ] **Step 4: Aggiornare `README.md` e `docs/STATO.md`**

Una frase nel paragrafo **Operatività** del README (il dettaglio intervento mostra chi lo ha creato/chiuso e le camere fatte). In `docs/STATO.md`: una riga in "Fatto" e togliere da "Da fare" della riga del 2026-11-05 la parte "`rooms_done` negli interventi". Restano da fare: nome di chi ha creato lavori e prenotazioni sale (altro piano) e salvare `completed_by_name` quando si chiude un intervento dall'app (serve una migrazione).

- [ ] **Step 5: Commit**

```bash
git add src/data/interventions.js src/screens/Interventions.jsx README.md docs/STATO.md
git commit -m "Interventi: mostra chi li ha creati/chiusi e le camere fatte"
```

---

## Fuori da questo piano

- Nome di chi ha creato **planning lavori** e **prenotazioni sale** (altre schermate: piano a parte).
- Salvare `completed_by_name` quando si chiude un intervento dall'app (richiede migrazione e funzione server).
- Segnare le camere come fatte dall'app (oggi `rooms_done` arriva solo dalla vecchia app).
