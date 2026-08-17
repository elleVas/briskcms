# Brisk

CMS visuale self-hosted per siti vetrina, basato su Astro. Editor drag-and-drop
(React + Puck), backend con database proprio (Postgres, multi-tenant-ready via
Row Level Security), rendering pubblico via Astro.

Monorepo Nx, package manager pnpm.

## Struttura

```
apps/
  api/            NestJS — REST/tRPC per CRUD pagine/media/auth
  editor-app/     React + Puck — editor drag-and-drop per content editor e dev
  public-site/    Astro — rendering pubblico dei siti

libs/
  domain-core/    entità pure (Page, Block, User, Media, FormSubmission)
  ports/          interfacce (PageRepositoryPort, MediaStoragePort, AuthPort, ...)
  adapters/       implementazioni concrete dei port (Postgres, storage locale/S3, auth)
  puck-config/    definizione dei blocchi editor
  shared-types/   tipi condivisi tra backend, editor e rendering

db/
  init/           schema Postgres iniziale + ruoli + Row Level Security
```

## Sviluppo locale

```sh
cp .env.example .env
docker compose up -d postgres
pnpm install
pnpm exec nx run-many -t build typecheck test
```

Ogni tabella con `tenant_id` ha Row Level Security attiva dal primo commit —
la connessione applicativa runtime usa il ruolo non-superuser `brisk_app`
(vedi `db/init/000_roles.sh`), non l'utente admin di Postgres, altrimenti le
policy RLS verrebbero bypassate.

## Workflow Git

`main` è protetto: nessun push diretto, solo Pull Request. Branch:
`<tipo>/<breve-descrizione-kebab-case>` — tipi ammessi `feature/`, `fix/`,
`chore/`, `docs/`, `refactor/`.
