/**
 * Backfill una tantum: assegna un id stabile ad ogni blocco esistente che ne
 * è privo (pagine, versioni di pagina, header/footer, versioni di
 * header/footer) — vedi il piano dell'editor visuale, Giorno 1: un id
 * assegnato una volta, per sempre, prima che il nuovo editor tocchi
 * qualunque contenuto (selezione/drag/patch a frammento sono tutti
 * indirizzati per id). Idempotente: rigenera solo dove manca, un id già
 * presente non viene mai toccato — sicuro da rieseguire.
 *
 * Da girare una volta, in un momento di manutenzione, PRIMA di deployare
 * qualunque codice che pretenda l'id come obbligatorio nello schema Zod
 * (vedi content-model.ts). L'editor Puck ancora attivo durante il backfill
 * non ne risente: continua a scartare gli id come oggi.
 *
 * `tenants` non ha RLS (è la tabella radice, vedi schema.ts) — leggibile
 * direttamente con la connessione brisk_app. Ogni tabella di contenuto
 * successiva è invece scoped per tenant e richiede `withTenant`.
 */
import { backfillBlockIds, type PageContent } from '@brisk/shared-types';
import { eq } from 'drizzle-orm';
import {
  createAppDb,
  withTenant,
  type BriskDb,
  type BriskTx,
} from '../src/lib/client.js';
import {
  pages,
  pageVersions,
  siteLayoutSections,
  siteLayoutSectionVersions,
  tenants,
} from '../src/lib/schema.js';

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
