# Brisk

CMS visuale self-hosted per siti vetrina, basato su Astro. Editor drag-and-drop
(React + Puck), backend con database proprio (Postgres, multi-tenant-ready via
Row Level Security), rendering pubblico via Astro.

Monorepo Nx, package manager pnpm, architettura Ports & Adapters.

## Quickstart

```sh
cp .env.example .env
docker compose up -d postgres
pnpm install
pnpm exec nx run-many -t build typecheck test lint
```

## Documentazione

- [docs/architecture.md](docs/architecture.md) — Ports & Adapters, struttura del
  monorepo, multi-tenant/RLS, content model
- [docs/development.md](docs/development.md) — setup locale, comandi, connessione
  al DB
- [docs/git-workflow.md](docs/git-workflow.md) — branch, PR, cosa richiede via
  libera prima di implementare
- [docs/adr/](docs/adr/) — Architecture Decision Records
