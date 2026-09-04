import postgres from 'postgres';
import { describe, expect, it } from 'vitest';
import { isUniqueViolation } from './unique-violation';

function buildPostgresError(
  overrides: Partial<{ code: string; constraint_name: string }> = {},
) {
  // `PostgresError`'s public type (from `postgres`'s .d.ts) exposes only the
  // constructor inherited from `Error` (message, options) — it does not
  // reflect the real runtime constructor (`Object.assign(this, x)`, see
  // node_modules/postgres/src/errors.js), which is how the driver actually
  // builds these errors (confirmed live against a real Postgres in
  // drizzle-page.repository.integration.spec.ts). An isolated, commented
  // cast bridging exactly that type/runtime gap — there is no "typed" way
  // to construct this fixture.
  const error = new postgres.PostgresError(
    'duplicate key value violates unique constraint',
  );
  return Object.assign(error, {
    code: '23505',
    constraint_name: 'pages_tenant_id_site_id_locale_slug_unique',
    ...overrides,
  }) as postgres.PostgresError;
}

describe('isUniqueViolation', () => {
  it('is true for a 23505 on the exact constraint named', () => {
    const error = buildPostgresError();
    expect(
      isUniqueViolation(error, 'pages_tenant_id_site_id_locale_slug_unique'),
    ).toBe(true);
  });

  it('is false when the constraint name differs (a different unique index fired)', () => {
    const error = buildPostgresError({
      constraint_name: 'pages_tenant_id_site_id_group_id_locale_unique',
    });
    expect(
      isUniqueViolation(error, 'pages_tenant_id_site_id_locale_slug_unique'),
    ).toBe(false);
  });

  it('is false for a different Postgres error code (e.g. a foreign key violation)', () => {
    const error = buildPostgresError({ code: '23503' });
    expect(
      isUniqueViolation(error, 'pages_tenant_id_site_id_locale_slug_unique'),
    ).toBe(false);
  });

  it('is false for a plain Error, not a PostgresError', () => {
    const error = new Error('boom');
    expect(
      isUniqueViolation(error, 'pages_tenant_id_site_id_locale_slug_unique'),
    ).toBe(false);
  });

  it('is false for a non-error value', () => {
    expect(
      isUniqueViolation('boom', 'pages_tenant_id_site_id_locale_slug_unique'),
    ).toBe(false);
  });

  it('is true when the PostgresError is wrapped in another Error via .cause (Drizzle wraps every driver error in its own DrizzleQueryError)', () => {
    const wrapped = new Error('Failed query', { cause: buildPostgresError() });
    expect(
      isUniqueViolation(wrapped, 'pages_tenant_id_site_id_locale_slug_unique'),
    ).toBe(true);
  });

  it('is false when the wrapped .cause is a different constraint', () => {
    const wrapped = new Error('Failed query', {
      cause: buildPostgresError({
        constraint_name: 'pages_tenant_id_site_id_group_id_locale_unique',
      }),
    });
    expect(
      isUniqueViolation(wrapped, 'pages_tenant_id_site_id_locale_slug_unique'),
    ).toBe(false);
  });
});
