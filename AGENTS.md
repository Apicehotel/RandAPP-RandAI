# AGENTS.md — regole per tutti gli strumenti AI

Questo file vale per **Claude, Cursor e Codex**. È l'unica fonte di regole: `CLAUDE.md` e `.cursor/rules/` rimandano qui.

## Progetto
RandAPP-RandAI — vedi `README.md` per descrizione, stack e comandi. Il README è la fonte di verità su come funziona l'app.

## Regole obbligatorie
1. **Prima di iniziare**: leggi `README.md` e `docs/STATO.md`.
2. **Dopo ogni modifica**: aggiorna `README.md` (se cambia il funzionamento) e aggiungi una riga in `docs/STATO.md`.
3. **Mai dati sensibili** (PIN, password, token, chiavi API) nel README, nei commit, nel codice o nei log. Usa variabili d'ambiente (`.env`, già in `.gitignore`) e documenta solo i *nomi* delle variabili.
4. **Non lavorare su `main`**: ogni strumento usa il proprio branch (vedi sotto) e si integra con una Pull Request.
5. **Modifiche piccole e mirate**: non riscrivere file che non c'entrano con il compito.
6. **Non toccare il lavoro in corso di un altro strumento**: controlla `docs/STATO.md` → sezione "In corso".

## Branch
| Strumento | Prefisso branch |
|-----------|-----------------|
| Claude    | `claude/<descrizione-breve>` |
| Cursor    | `cursor/<descrizione-breve>` |
| Codex     | `codex/<descrizione-breve>` |

Prima di iniziare: `git fetch origin && git rebase origin/main` (o parti da `main` aggiornato).

## Commit
- Messaggi brevi, in italiano, all'imperativo: `Aggiungi login`, `Correggi calcolo totale`.
- Un commit = una modifica logica.

## Passaggio di consegne
Quando finisci un lavoro, aggiorna `docs/STATO.md`: cosa hai fatto, cosa resta, cosa deve sapere il prossimo strumento.

## Stack e comandi
Vedi sezione "Stack" e "Comandi" del `README.md` (da tenere aggiornata).
