/**
 * A one-off backfill: it assigns a stable id to every existing block that
 * lacks one (pages, page versions, headers/footers, header/footer versions)
 * — see the visual editor plan, Day 1: an id assigned once, forever, before
 * the new editor touches any content (selection, dragging and fragment
 * patching are all addressed by id). Idempotent: it regenerates only where
 * one is missing, and never touches an id that is already there — safe to
 * re-run.
 *
 * To be run once, during a maintenance window, BEFORE deploying any code
 * that requires the id in the Zod schema (see content-model.ts). The Puck
 * editor still live during the backfill is unaffected: it goes on
 * discarding ids as it does today.
 *
 * `tenants` has no RLS (it is the root table, see schema.ts) — readable
 * directly with the brisk_app connection. Every content table below it is
 * tenant-scoped instead and requires `withTenant`.
 */
import { backfillBlockIds, type PageContent } from '@brisk/shared-types';
import { eq } from 'drizzle-orm';
import {
  createAppDb,
  withTenant,
  type BriskDb,
  type BriskTx,
} from '../src/lib/client';
import {
  pages,
  pageVersions,
  siteLayoutSections,
  siteLayoutSectionVersions,
  tenants,
} from '../src/lib/schema';

let backfilled = 0;
let untouched = 0;

async function backfillPages(tx: BriskTx, tenantId: string): Promise<void> {
  const rows = await tx
    .select({
      id: pages.id,
      content: pages.content,
      publishedContent: pages.publishedContent,
    })
    .from(pages)
    .where(eq(pages.tenantId, tenantId));

  for (const row of rows) {
    const content = backfillBlockIds(row.content as PageContent);
    const published = row.publishedContent
      ? backfillBlockIds(row.publishedContent as PageContent)
      : null;

    if (!content.changed && !published?.changed) {
      untouched += 1;
      continue;
    }

    await tx
      .update(pages)
      .set({
        content: content.content,
        ...(published ? { publishedContent: published.content } : {}),
      })
      .where(eq(pages.id, row.id));
    backfilled += 1;
  }
}

async function backfillPageVersions(
  tx: BriskTx,
  tenantId: string,
): Promise<void> {
  const rows = await tx
    .select({ id: pageVersions.id, content: pageVersions.content })
    .from(pageVersions)
    .where(eq(pageVersions.tenantId, tenantId));

  for (const row of rows) {
    const result = backfillBlockIds(row.content as PageContent);
    if (!result.changed) {
      untouched += 1;
      continue;
    }
    await tx
      .update(pageVersions)
      .set({ content: result.content })
      .where(eq(pageVersions.id, row.id));
    backfilled += 1;
  }
}

async function backfillSiteLayoutSections(
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
    const content = backfillBlockIds(row.content as PageContent);
    const published = row.publishedContent
      ? backfillBlockIds(row.publishedContent as PageContent)
      : null;

    if (!content.changed && !published?.changed) {
      untouched += 1;
      continue;
    }

    await tx
      .update(siteLayoutSections)
      .set({
        content: content.content,
        ...(published ? { publishedContent: published.content } : {}),
      })
      .where(eq(siteLayoutSections.id, row.id));
    backfilled += 1;
  }
}

async function backfillSiteLayoutSectionVersions(
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
    const result = backfillBlockIds(row.content as PageContent);
    if (!result.changed) {
      untouched += 1;
      continue;
    }
    await tx
      .update(siteLayoutSectionVersions)
      .set({ content: result.content })
      .where(eq(siteLayoutSectionVersions.id, row.id));
    backfilled += 1;
  }
}

async function main(): Promise<void> {
  const db: BriskDb = createAppDb();

  const allTenants = await db.select({ id: tenants.id }).from(tenants);

  for (const tenant of allTenants) {
    await withTenant(db, tenant.id, async (tx) => {
      await backfillPages(tx, tenant.id);
      await backfillPageVersions(tx, tenant.id);
      await backfillSiteLayoutSections(tx, tenant.id);
      await backfillSiteLayoutSectionVersions(tx, tenant.id);
    });
  }

  console.log(
    `Backfill id blocchi completato: ${backfilled} righe aggiornate, ${untouched} già a posto (${allTenants.length} tenant).`,
  );
  await db.$client.end();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
