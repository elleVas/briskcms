/**
 * A one-off migration: it rewrites every block style still in the flat,
 * pre-ADR-0047 shape as the per-breakpoint one — `{ minHeight: '60vh' }`
 * becomes `{ base: { minHeight: '60vh' } }` — across page content and its
 * versions, published snapshots, diverged translations, header/footer
 * sections and theirs, and the per-type styles in
 * `site_theme_block_styles`. Idempotent: a row already migrated is left
 * exactly as it is and not rewritten, so it is safe to re-run.
 *
 * Unlike `backfill-block-ids.ts`, this does NOT have to run before the new
 * code: both shapes are read correctly either way (`blockSchema`
 * normalizes on parse, `normalizeResponsiveBlockStyle` at the database
 * boundary). What it buys is that only one shape is left in the tables —
 * otherwise every future reader, and every query written against the
 * JSONB, has to keep handling both forever.
 *
 * `tenants` has no RLS (it is the root table, see schema.ts) — readable
 * directly with the brisk_app connection. Every content table below it is
 * tenant-scoped instead and requires `withTenant`.
 */
import {
  migrateResponsiveBlockStyles,
  migrateStyle,
  type PageContent,
} from '@brisk/shared-types';
import { and, eq } from 'drizzle-orm';
import {
  createAppDb,
  withTenant,
  type BriskDb,
  type BriskTx,
} from '../src/lib/client';
import {
  pageGroups,
  pageGroupVersions,
  pageTranslations,
  siteLayoutSections,
  siteLayoutSectionVersions,
  siteThemeBlockStyles,
  tenants,
} from '../src/lib/schema';

let migrated = 0;
let untouched = 0;

/**
 * The content columns of one row, migrated together: a row is written once
 * or not at all, whichever of its columns changed.
 */
function migrateColumns(
  columns: Record<string, PageContent | null>,
): Record<string, PageContent> | null {
  const changes: Record<string, PageContent> = {};
  for (const [name, content] of Object.entries(columns)) {
    if (!content) {
      continue;
    }
    const result = migrateResponsiveBlockStyles(content);
    if (result.changed) {
      changes[name] = result.content;
    }
  }
  return Object.keys(changes).length > 0 ? changes : null;
}

async function migratePageGroups(tx: BriskTx, tenantId: string): Promise<void> {
  const rows = await tx
    .select({ id: pageGroups.id, content: pageGroups.content })
    .from(pageGroups)
    .where(eq(pageGroups.tenantId, tenantId));

  for (const row of rows) {
    const changes = migrateColumns({ content: row.content });
    if (!changes) {
      untouched += 1;
      continue;
    }
    await tx.update(pageGroups).set(changes).where(eq(pageGroups.id, row.id));
    migrated += 1;
  }
}

async function migratePageGroupVersions(
  tx: BriskTx,
  tenantId: string,
): Promise<void> {
  const rows = await tx
    .select({ id: pageGroupVersions.id, content: pageGroupVersions.content })
    .from(pageGroupVersions)
    .where(eq(pageGroupVersions.tenantId, tenantId));

  for (const row of rows) {
    const changes = migrateColumns({ content: row.content });
    if (!changes) {
      untouched += 1;
      continue;
    }
    await tx
      .update(pageGroupVersions)
      .set(changes)
      .where(eq(pageGroupVersions.id, row.id));
    migrated += 1;
  }
}

/**
 * The published snapshot matters as much as the draft: it is what the
 * public site actually serves, and it is frozen at publish time — nothing
 * rewrites it on its own.
 */
async function migratePageTranslations(
  tx: BriskTx,
  tenantId: string,
): Promise<void> {
  const rows = await tx
    .select({
      id: pageTranslations.id,
      publishedSnapshot: pageTranslations.publishedSnapshot,
      divergedContent: pageTranslations.divergedContent,
    })
    .from(pageTranslations)
    .where(eq(pageTranslations.tenantId, tenantId));

  for (const row of rows) {
    const changes = migrateColumns({
      publishedSnapshot: row.publishedSnapshot,
      divergedContent: row.divergedContent,
    });
    if (!changes) {
      untouched += 1;
      continue;
    }
    await tx
      .update(pageTranslations)
      .set(changes)
      .where(eq(pageTranslations.id, row.id));
    migrated += 1;
  }
}

async function migrateSiteLayoutSections(
  tx: BriskTx,
  tenantId: string,
): Promise<void> {
  const rows = await tx
    .select({
      id: siteLayoutSections.id,
      content: siteLayoutSections.content,
      publishedContent: siteLayoutSections.publishedContent,
    })
    .from(siteLayoutSections)
    .where(eq(siteLayoutSections.tenantId, tenantId));

  for (const row of rows) {
    const changes = migrateColumns({
      content: row.content,
      publishedContent: row.publishedContent,
    });
    if (!changes) {
      untouched += 1;
      continue;
    }
    await tx
      .update(siteLayoutSections)
      .set(changes)
      .where(eq(siteLayoutSections.id, row.id));
    migrated += 1;
  }
}

async function migrateSiteLayoutSectionVersions(
  tx: BriskTx,
  tenantId: string,
): Promise<void> {
  const rows = await tx
    .select({
      id: siteLayoutSectionVersions.id,
      content: siteLayoutSectionVersions.content,
    })
    .from(siteLayoutSectionVersions)
    .where(eq(siteLayoutSectionVersions.tenantId, tenantId));

  for (const row of rows) {
    const changes = migrateColumns({ content: row.content });
    if (!changes) {
      untouched += 1;
      continue;
    }
    await tx
      .update(siteLayoutSectionVersions)
      .set(changes)
      .where(eq(siteLayoutSectionVersions.id, row.id));
    migrated += 1;
  }
}

/** The per-TYPE tier (docs/adr/0022), one row per (site, block type) — the same shape change, in its own table rather than inside a page's content. */
async function migrateThemeBlockStyles(
  tx: BriskTx,
  tenantId: string,
): Promise<void> {
  const rows = await tx
    .select()
    .from(siteThemeBlockStyles)
    .where(eq(siteThemeBlockStyles.tenantId, tenantId));

  for (const row of rows) {
    const result = migrateStyle(row.style);
    if (!result.changed || !result.style) {
      untouched += 1;
      continue;
    }
    await tx
      .update(siteThemeBlockStyles)
      .set({ style: result.style })
      .where(
        and(
          eq(siteThemeBlockStyles.siteId, row.siteId),
          eq(siteThemeBlockStyles.blockType, row.blockType),
        ),
      );
    migrated += 1;
  }
}

async function main(): Promise<void> {
  const db: BriskDb = createAppDb();

  const allTenants = await db.select({ id: tenants.id }).from(tenants);

  for (const tenant of allTenants) {
    await withTenant(db, tenant.id, async (tx) => {
      await migratePageGroups(tx, tenant.id);
      await migratePageGroupVersions(tx, tenant.id);
      await migratePageTranslations(tx, tenant.id);
      await migrateSiteLayoutSections(tx, tenant.id);
      await migrateSiteLayoutSectionVersions(tx, tenant.id);
      await migrateThemeBlockStyles(tx, tenant.id);
    });
  }

  console.log(
    `Responsive block style migration complete: ${migrated} rows rewritten, ${untouched} already current (${allTenants.length} tenants).`,
  );
  await db.$client.end();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
