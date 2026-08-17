import { defineConfig } from 'drizzle-kit';

// Migrations always run as the Postgres admin/superuser (creating RLS
// policies and granting privileges to brisk_app requires table-owner rights)
// — never as brisk_app itself. See docs/adr/0002-non-superuser-role-for-rls-enforcement.md.
const host = process.env.POSTGRES_HOST ?? 'localhost';
const port = process.env.POSTGRES_PORT ?? '5432';
const user = process.env.POSTGRES_USER ?? 'brisk';
const password = process.env.POSTGRES_PASSWORD ?? 'changeme';
const database = process.env.POSTGRES_DB ?? 'brisk';

export default defineConfig({
  schema: './src/lib/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: `postgres://${user}:${password}@${host}:${port}/${database}`,
  },
});
