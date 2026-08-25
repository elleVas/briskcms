import postgres from 'postgres';

/**
 * `postgres` (porsager/postgres, il driver dietro drizzle-orm/postgres-js —
 * vedi client.ts) rifiuta l'insert/update con un `PostgresError` reale, mai
 * un errore di dominio: sotto concorrenza vera (due richieste quasi
 * simultanee superano entrambe il check-then-act applicativo) è questo,
 * non l'use-case, il primo punto che vede il conflitto. `constraint_name`
 * combacia esattamente con quello generato da Drizzle in schema.ts (visibile
 * anche nelle migration SQL, es. `pages_tenant_id_site_id_locale_slug_unique`).
 *
 * Drizzle non lascia risalire il `PostgresError` grezzo: lo avvolge in un
 * proprio `DrizzleQueryError`, con l'originale in `.cause` (verificato dal
 * vivo contro Postgres reale — vedi drizzle-page.repository.integration.spec.ts).
 */
export function isUniqueViolation(
  error: unknown,
  constraintName: string,
): boolean {
  const cause =
    error instanceof Error && error.cause instanceof Error
      ? error.cause
      : error;
  return (
    cause instanceof postgres.PostgresError &&
    cause.code === '23505' &&
    cause.constraint_name === constraintName
  );
}
