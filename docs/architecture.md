# Architettura

Brisk segue Ports & Adapters (hexagonal architecture): il dominio non conosce
dettagli di infrastruttura, l'infrastruttura vive solo negli adapter. Vedi anche
[docs/adr](adr/) per le decisioni che hanno un trade-off reale dietro.

## Grafo delle dipendenze

```
domain-core   (entità pure, zero dipendenze)
    ^
    |
  ports       (interfacce: PageRepositoryPort, MediaStoragePort, AuthPort, ...)
    ^
    |
application   (use case: createPage, saveDraft, publishPage, listPageVersions,
               rollbackToVersion — dipende da domain-core + ports)
    ^
    |
adapters/*    (implementazioni concrete dei Port: Postgres, storage locale/S3, auth)
    ^
    |
 apps/api     (NestJS — wiring DI: inietta gli adapter concreti dietro alle
               interfacce Port, espone REST/tRPC)
```

`shared-types` è trasversale: definisce il content model (`Block`, `PageContent`,
`SeoMeta`) condiviso tra `domain-core`, `apps/editor-app` e `apps/public-site`, cosà
che editor, API e rendering non possano disallinearsi su cosa significa un blocco.

Regola pratica per capire dove va un nuovo pezzo di codice:

- **Cambia solo le regole di business di un'entità** (es. "una pagina pubblicata non
  può tornare draft senza un nuovo publish") → `domain-core`.
- **Serve un nuovo modo per il dominio di parlare col mondo esterno** (nuovo tipo di
  repository, nuovo storage) → nuova interfaccia in `ports`.
- **Orchestra più chiamate a un Port per completare un'azione utente** → nuovo use
  case in `application`.
- **Implementa concretamente un Port** (query SQL, chiamata S3, hashing password) →
  nuovo adapter in `libs/adapters/`.

## Multi-tenant e Row Level Security

Ogni tabella con dati per-tenant ha `tenant_id` fin dal giorno 1 (anche in
single-tenant) e Row Level Security attiva con policy `tenant_id = current_tenant()`
(vedi `db/init/002_rls.sql`). `current_tenant()` legge la session variable Postgres
`app.current_tenant_id`, che l'adapter imposta a inizio richiesta a partire dal
`TenantContextPort`.

**Punto critico**: RLS protegge solo se la connessione applicativa NON è superuser
— vedi [ADR-0002](adr/0002-non-superuser-role-for-rls-enforcement.md). Il ruolo
`brisk_app` (creato in `db/init/000_roles.sh`) è quello che il backend deve sempre
usare a runtime.

## Content model

Il "contenuto" di una pagina è un array di blocchi (`PageContent = Block[]`,
`libs/shared-types`), lo stesso formato che dalla Fase 2 in poi produrrà l'editor
Puck e che `apps/public-site` consuma per il rendering server-side. Ogni pagina ha
sempre due copie del content model:

- `content` — l'ultimo draft, modificabile.
- `publishedContent` — l'ultima versione effettivamente pubblicata, immutabile fino
  al prossimo `publish()`.

Ogni salvataggio (creazione, draft, rollback) crea una riga in `page_versions`
(mai un overwrite distruttivo) — vedi `Page` in `libs/domain-core` e gli use case
in `libs/application/src/lib/use-cases/`.

## Monorepo

```
apps/
  api/            NestJS — REST/tRPC, wiring DI, guard TenantContext/auth
  editor-app/     React + Puck (Fase 2) — editor drag-and-drop
  public-site/    Astro — rendering pubblico dei siti

libs/
  domain-core/    entità pure: Page, PageVersion, User, Media, FormSubmission
  ports/          interfacce che gli adapter implementano
  application/    use case (orchestrazione, zero infrastruttura)
  adapters/       implementazioni concrete dei Port
  puck-config/    definizione dei blocchi editor (Fase 2)
  shared-types/   content model condiviso (Block, PageContent, SeoMeta)

db/
  init/           schema Postgres iniziale, ruoli, RLS (vedi docs/development.md)

docs/
  adr/            Architecture Decision Records
```
