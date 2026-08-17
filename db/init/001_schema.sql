-- Brisk — schema iniziale (bozza da piano-progetto-astro-cms.md, "Modello dati")
-- Multi-tenant-ready dal giorno 1: ogni tabella ha tenant_id, anche in single-tenant.

create table tenants (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

create table users (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants (id) on delete cascade,
  email             text not null,
  password_hash     text not null,
  role              text not null check (role in ('admin', 'editor')),
  email_verified_at timestamptz,
  created_at        timestamptz not null default now(),
  unique (tenant_id, email)
);

create table sites (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants (id) on delete cascade,
  name            text not null,
  domain          text,
  default_locale  text not null,
  enabled_locales text[] not null default array[]::text[],
  created_at      timestamptz not null default now()
);

create table pages (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references tenants (id) on delete cascade,
  site_id            uuid not null references sites (id) on delete cascade,
  group_id           uuid not null, -- lega le traduzioni della stessa pagina
  locale             text not null,
  slug               text not null,
  status             text not null check (status in ('draft', 'published')),
  content            jsonb not null default '{}'::jsonb,           -- ultimo draft (formato Puck)
  published_content  jsonb,                                        -- ultima versione pubblicata
  seo_meta           jsonb not null default '{}'::jsonb,           -- title, description, og tags, canonical
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (tenant_id, site_id, group_id, locale),
  unique (tenant_id, site_id, locale, slug)
);

create table page_versions (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants (id) on delete cascade,
  page_id    uuid not null references pages (id) on delete cascade,
  content    jsonb not null,
  created_by uuid references users (id) on delete set null,
  created_at timestamptz not null default now()
  -- ogni salvataggio crea una riga qui, mai overwrite distruttivo
);

create table media (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants (id) on delete cascade,
  site_id          uuid not null references sites (id) on delete cascade,
  filename         text not null,
  storage_key      text not null,
  storage_provider text not null check (storage_provider in ('local', 's3')),
  mime_type        text not null,
  size             bigint not null,
  width            integer,
  height           integer,
  created_at       timestamptz not null default now()
);

create table form_submissions (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants (id) on delete cascade,
  site_id    uuid not null references sites (id) on delete cascade,
  page_id    uuid references pages (id) on delete set null, -- preserva lo storico anche se la pagina viene rimossa
  payload    jsonb not null,
  created_at timestamptz not null default now()
);

create index pages_tenant_site_idx on pages (tenant_id, site_id);
create index page_versions_page_idx on page_versions (page_id);
create index media_tenant_site_idx on media (tenant_id, site_id);
create index form_submissions_tenant_site_idx on form_submissions (tenant_id, site_id);
