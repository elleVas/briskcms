import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  type BriskDb,
  contentPreviewTokens,
  createAppDb,
  deleteIntegrationTenants,
  tenants,
  withTenant,
} from '@brisk/postgres-db';
import { PreviewTokenAdapter } from './preview-token.adapter.js';

/**
 * Runs against a real Postgres — see docs/development.md. Connects as
 * `brisk_app`, so this also regression-tests RLS isolation for
 * `content_preview_tokens` (see 0022_content_preview_tokens_rls.sql).
 */
describe('PreviewTokenAdapter (integration)', () => {
  let db: BriskDb;
  let adapter: PreviewTokenAdapter;
  let tenantId: string;

  beforeAll(async () => {
    db = createAppDb();

    const [tenant] = await db
      .insert(tenants)
      .values({ name: `Integration Tenant ${randomUUID()}` })
      .returning({ id: tenants.id });
    tenantId = tenant.id;
    adapter = new PreviewTokenAdapter(db, tenantId);
  });

  afterAll(async () => {
    await deleteIntegrationTenants(db, [tenantId]);
    await db.$client.end();
  });

  it('creates a token that validates back to the same content', async () => {
    const pageId = randomUUID();
    const created = await adapter.createToken(
      tenantId,
      'page',
      pageId,
      1000 * 60 * 60,
    );

    const validated = await adapter.validateToken(
      created.token,
      'page',
      pageId,
    );

    expect(validated?.tenantId).toBe(tenantId);
    expect(validated?.contentType).toBe('page');
    expect(validated?.contentId).toBe(pageId);
  });

  it('is non-consuming: validating twice both succeed', async () => {
    const pageId = randomUUID();
    const created = await adapter.createToken(
      tenantId,
      'page',
      pageId,
      1000 * 60,
    );

    const first = await adapter.validateToken(created.token, 'page', pageId);
    const second = await adapter.validateToken(created.token, 'page', pageId);

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
  });

  it('never persists the plaintext token — only its hash is in the DB', async () => {
    const pageId = randomUUID();
    const created = await adapter.createToken(
      tenantId,
      'page',
      pageId,
      1000 * 60,
    );

    const [row] = await withTenant(db, tenantId, (tx) =>
      tx
        .select()
        .from(contentPreviewTokens)
        .where(eq(contentPreviewTokens.contentId, pageId))
        .limit(1),
    );

    expect(row.tokenHash).not.toBe(created.token);
  });

  it('rejects a token validated against a mismatched contentId', async () => {
    const pageId = randomUUID();
    const created = await adapter.createToken(
      tenantId,
      'page',
      pageId,
      1000 * 60,
    );

    expect(
      await adapter.validateToken(created.token, 'page', randomUUID()),
    ).toBeNull();
  });

  it('rejects a token validated against a mismatched contentType', async () => {
    const sectionId = randomUUID();
    const created = await adapter.createToken(
      tenantId,
      'header',
      sectionId,
      1000 * 60,
    );

    expect(
      await adapter.validateToken(created.token, 'footer', sectionId),
    ).toBeNull();
  });

  it('rejects an unknown token', async () => {
    expect(
      await adapter.validateToken('not-a-real-token', 'page', randomUUID()),
    ).toBeNull();
  });

  it('rejects an expired token', async () => {
    const pageId = randomUUID();
    const created = await adapter.createToken(
      tenantId,
      'page',
      pageId,
      1000 * 60,
    );
    await withTenant(db, tenantId, (tx) =>
      tx
        .update(contentPreviewTokens)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(contentPreviewTokens.contentId, pageId)),
    );

    expect(
      await adapter.validateToken(created.token, 'page', pageId),
    ).toBeNull();
  });
});
