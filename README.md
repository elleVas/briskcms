# Brisk

[![Coverage](https://img.shields.io/badge/coverage-%E2%89%A580%25%20domain%2Fapp%20%C2%B7%20%E2%89%A560%25%20infra-brightgreen.svg)](https://github.com/elleVas/briskcms/actions/workflows/ci.yml)

Self-hosted visual CMS for brochure/showcase websites, built on Astro. Drag-and-drop
editor (React + Puck), backend with its own database (Postgres, multi-tenant-ready
via Row Level Security), public rendering via Astro.

Nx monorepo, pnpm package manager, Ports & Adapters architecture.

## Quickstart

```sh
cp .env.example .env
docker compose up -d postgres mailpit
pnpm install
pnpm --filter @brisk/postgres-db run db:migrate
pnpm --filter @brisk/postgres-db run db:seed
pnpm exec nx run-many -t build typecheck test lint
```

## Documentation

- [docs/architecture.md](docs/architecture.md) — Ports & Adapters, monorepo
  structure, multi-tenant/RLS, content model
- [docs/development.md](docs/development.md) — local setup, commands, DB
  connection
- [docs/git-workflow.md](docs/git-workflow.md) — branches, PRs, what requires
  sign-off before implementing
- [docs/adr/](docs/adr/) — Architecture Decision Records
