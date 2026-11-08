# Standard per agenti — Implementation Plan

> **For agentic workers:** eseguire i task in ordine. Solo documentazione e commenti; nessun cambio funzionale all'app.

**Goal:** Allineare README, AGENTS.md, STATO e un nuovo `docs/STANDARD.md` così Claude/Cursor/Codex sappiano come standardizzare ruoli, categorie, migrazioni, sicurezza e hosting.

**Architecture:** Una fonte di verità operativa (`docs/STANDARD.md`) citata da AGENTS.md; README corretto sulle contraddizioni dell'audit; STATO aggiornato.

**Tech Stack:** Markdown only (+ un commento in `src/lib/home.js`).

**Spec:** audit in chat 2026-11-08 (bug/incoerenze).

## Global Constraints
- Mai PIN/token/chiavi nei file.
- Non applicare migrazioni al database da qui.
- Modifiche piccole e mirate.

## Tasks
- [x] Task 1: Scrivere `docs/STANDARD.md`
- [x] Task 2: Correggere README (presenza, login, ruoli, migrazioni, hosting, categorie, APP_URL)
- [x] Task 3: Collegare AGENTS.md → STANDARD.md; aggiornare STATO; fix commento `home.js`
- [ ] Task 4: Verifica greps di coerenza, commit, push, PR
