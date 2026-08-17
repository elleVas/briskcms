# Workflow Git

`main` è protetto: nessun push diretto, nessuna eccezione (nemmeno per il
proprietario del repo — vedi [ADR-0001](adr/0001-public-repository-for-branch-protection.md)).
Ogni modifica entra solo tramite Pull Request mergiabile.

## Branch

`<tipo>/<breve-descrizione-kebab-case>`, tipi ammessi:

- `feature/` — nuova funzionalità
- `fix/` — bugfix
- `chore/` — manutenzione, dipendenze, config
- `docs/` — solo documentazione
- `refactor/` — refactoring senza cambio di comportamento

Esempi: `feature/page-draft-publish-flow`, `fix/rls-tenant-scoping-media`,
`chore/docker-compose-caddy`.

## Cosa richiede un via libera esplicito prima di implementare

Per esplicita richiesta dell'autore, questi tipi di cambiamento vanno discussi
*prima* di scrivere codice, non dopo:

- nuove dipendenze/librerie non già previste
- modifiche allo schema del content model o del database
- cambi al pattern Ports & Adapters (nuovi Port, spostamento di responsabilità tra
  `domain-core`/`ports`/`application`/adapter)
- decisioni di sicurezza (auth, RLS, gestione sessioni)
- qualunque deviazione dalle fasi/decisioni già definite

Le decisioni prese vengono registrate in [docs/adr](adr/) quando comportano un
trade-off reale, così la motivazione resta leggibile anche mesi dopo.
