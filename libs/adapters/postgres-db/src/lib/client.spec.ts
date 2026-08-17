import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { adminConnectionString, createAppDb, createDb } from './client.js';

const ENV_KEYS = [
  'POSTGRES_HOST',
  'POSTGRES_PORT',
  'POSTGRES_DB',
  'POSTGRES_USER',
  'POSTGRES_PASSWORD',
  'POSTGRES_APP_PASSWORD',
] as const;

describe('createDb', () => {
  it('builds a BriskDb without opening a connection', () => {
    // postgres.js connects lazily on first query, so this is safe without a
    // real database — constructing the client must not throw.
    expect(() =>
      createDb('postgres://user:pass@localhost:5432/db'),
    ).not.toThrow();
  });
});

describe('adminConnectionString / createAppDb', () => {
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    }
  });

  it('throws when POSTGRES_PASSWORD is missing', () => {
    expect(() => adminConnectionString()).toThrow(
      /Missing required environment variable: POSTGRES_PASSWORD/,
    );
  });

  it('throws when POSTGRES_APP_PASSWORD is missing', () => {
    expect(() => createAppDb()).toThrow(
      /Missing required environment variable: POSTGRES_APP_PASSWORD/,
    );
  });

  it('falls back to default host/port/db/user when unset', () => {
    process.env.POSTGRES_PASSWORD = 'secret';
    expect(adminConnectionString()).toBe(
      'postgres://brisk:secret@localhost:5432/brisk',
    );
  });

  it('uses explicit host/port/db/user when set', () => {
    process.env.POSTGRES_HOST = 'db.internal';
    process.env.POSTGRES_PORT = '5433';
    process.env.POSTGRES_DB = 'custom_db';
    process.env.POSTGRES_USER = 'custom_user';
    process.env.POSTGRES_PASSWORD = 'secret';
    expect(adminConnectionString()).toBe(
      'postgres://custom_user:secret@db.internal:5433/custom_db',
    );
  });

  it('createAppDb builds a client scoped to the brisk_app role', () => {
    process.env.POSTGRES_APP_PASSWORD = 'app-secret';
    expect(() => createAppDb()).not.toThrow();
  });
});
