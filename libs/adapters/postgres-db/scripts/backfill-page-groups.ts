/**
 * A one-off backfill: it converts the old "one Page per locale, linked by
 * groupId" model (ADR-0017) into the new field-level i18n model (a shared
 * structure in PageGroup plus per-locale text overlays in PageTranslation)
 * — see the `majestic-petting-lampson.md` plan.
 *
 * For every existing `groupId`:
 * 1. The page in the site's DEFAULT locale becomes the canonical PageGroup
 *    (the structure plus the default values of translatable fields). It
 *    reuses the same `groupId` as the new PageGroup's id — so no remapping
 *    table is needed anywhere else.
 * 2. Every page in the group (including the canonical one) becomes a
 *    PageTranslation. When its structure matches the canonical one exactly
 *    (the same `computeContentStructureSignature`), the values of
 *    `translatable` fields that differ from the canonical ones go into
 *    `fieldValues` (a light overlay) — otherwise the translation starts out
 *    `isDiverged: true` with `divergedContent` = its current content
 *    untouched (no loss at all for a translation already independent in
 *    practice, which the old drift detector already flagged as such).
 * 3. The hierarchy (parentId) becomes shared: the canonical page's
 *    parentId, mapped to its parent's GROUPID (not its pageId).
 *
 * It deliberately does NOT migrate `page_versions` history — retroactively
 * reconstructing what the "canonical" structure was at each past version is
 * ambiguous (the default locale may have changed in the meantime, or a
 * version may predate this very concept) and the plan never promised it.
 * Every new PageGroup/PageTranslation restarts with ONE initial version
 * (the state at backfill time) rather than the whole history — acceptable:
 * this project has no production DB yet, only development data
 * (docs-showcase).
 *
 * Idempotent ONLY when re-run against a DB that has not yet populated
 * page_groups/page_translations — NOT meant to be re-run after a successful
 * first pass (it would find the old `pages` again, unchanged, and recreate
 * duplicate rows). To be run once, during a maintenance window, with the
 * old `pages`/`page_versions` tables left intact (removed only at the end
 * of the plan, after full verification).
 */
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import {
  computeContentStructureSignature,
  type Block,
  type FieldValueOverlay,
  type PageContent,
} from '@brisk/shared-types';
import {
  createAppDb,
  withTenant,
  type BriskDb,
  type BriskTx,
} from '../src/lib/client';
import {
  pageGroupVersions,
  pageGroups,
  pageTranslationVersions,
  pageTranslations,
  pages,
  sites,
  tenants,
} from '../src/lib/schema';

// A source of truth DELIBERATELY duplicated from
// libs/block-registry/src/lib/blocks/*.block.ts's `translatable: true` (see
// the audit) — not imported from @brisk/block-registry here: this is a
// one-off Node script, and it is not worth tying `@brisk/postgres-db` (an
// adapter layer) to a React/editor package for a metadata read that will
// not change again once this backfill is done. If a new `translatable`
// field is added AFTER this script has already run successfully, this map
// no longer needs updating.
// The 6 types that reuse ctaLinkFields() (libs/block-registry/src/lib/fields/
// link-type-field.ts) also carry `url` — found live that a real site often
// uses it for a relative internal path ("/it/docs") rather than the actual
// PagePickerField, so it has to vary per language like any other text field
// (see the comment on that field).
const CTA_LINK_FIELDS = ['url'];

const TRANSLATABLE_FIELDS: Record<string, string[]> = {
  Banner: ['title', 'text', 'buttonLabel', ...CTA_LINK_FIELDS],
  AccordionItem: ['question', 'answer'],
  Button: ['label', ...CTA_LINK_FIELDS],
  BeforeAfter: ['beforeLabel', 'afterLabel'],
  Breadcrumb: ['homeLabel'],
  Code: ['code'],
  Feature: ['title', 'text'],
  Countdown: ['label'],
  Hero: ['title', 'subtitle'],
  Link: ['label', ...CTA_LINK_FIELDS],
  Image: ['alt', 'caption'],
  NavDropdown: ['label'],
  NavLink: ['label', ...CTA_LINK_FIELDS],
  PromoBar: ['message', ...CTA_LINK_FIELDS],
  PricingPlan: ['name', 'price', 'period', 'buttonLabel', ...CTA_LINK_FIELDS],
  NewsletterSignup: ['title', 'buttonLabel'],
  SearchBox: ['placeholder'],
  Stat: ['prefix', 'suffix', 'label'],
  Quote: ['quote', 'role'],
  Rating: ['label'],
  Tab: ['label'],
  Testimonial: ['quote', 'role'],
  TeamMember: ['role', 'bio'],
  TimelineStep: ['label', 'title', 'description'],
  Text: ['body'],
  WhatsAppButton: ['message'],
};

/**
 * Extracts into `fieldValues` only the values that DIFFER from the
 * canonical structure — it walks by INDEX, which is valid only because the
 * caller has already verified the two structures match exactly (an
 * identical computeContentStructureSignature). The inverse direction of
 * mergeTranslatedContent (@brisk/shared-types), deliberately not living
 * there: that one stays one-way, this is one-off migration logic.
 */
function extractFieldValues(
  translationContent: PageContent,
  canonicalContent: PageContent,
): FieldValueOverlay {
  const overlay: FieldValueOverlay = {};

  function walk(translationBlocks: Block[], canonicalBlocks: Block[]): void {
    translationBlocks.forEach((tBlock, index) => {
      const cBlock = canonicalBlocks[index];
      // Keyed on the CANONICAL block's id (the one that survives on
      // PageGroup.content), not on the translation's — every locale had
      // independent ids of its own under the old model
      // (createPageTranslation copied only the tree's SHAPE, not the real
      // ids). mergeTranslatedContent looks up `fieldValues[block.id]` while
      // walking `groupContent` (the canonical one): an overlay keyed on the
      // wrong id would NEVER be found — a real bug, found live through the
      // round-trip verification rather than merely theorized.
      if (!cBlock?.id) return;

      const keys = TRANSLATABLE_FIELDS[tBlock.type] ?? [];
      for (const key of keys) {
        const tValue = tBlock.props[key];
        const cValue = cBlock.props[key];
        if (typeof tValue === 'string' && tValue !== cValue) {
          overlay[cBlock.id] = { ...overlay[cBlock.id], [key]: tValue };
        }
      }

      if (tBlock.children && cBlock.children) {
        walk(tBlock.children, cBlock.children);
      }
    });
  }

  walk(translationContent, canonicalContent);
  return overlay;
}

interface OldPageRow {
  id: string;
  siteId: string;
  groupId: string;
  locale: string;
  slug: string;
  parentId: string | null;
  status: 'draft' | 'published';
  content: PageContent;
  publishedContent: PageContent | null;
  seoMeta: {
    title: string;
    description: string;
    ogTags?: Record<string, string>;
    canonical?: string;
  };
  order: number;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

let groupsCreated = 0;
let translationsCreated = 0;
let divergedCount = 0;

async function backfillTenant(tx: BriskTx, tenantId: string): Promise<void> {
  const siteRows = await tx
    .select({ id: sites.id, defaultLocale: sites.defaultLocale })
    .from(sites)
    .where(eq(sites.tenantId, tenantId));
  const defaultLocaleBySite = new Map(
    siteRows.map((s) => [s.id, s.defaultLocale]),
  );

  const allPages = (await tx
    .select()
    .from(pages)
    .where(eq(pages.tenantId, tenantId))) as unknown as OldPageRow[];
  if (allPages.length === 0) return;

  // pageId -> groupId, per rimappare parentId (un id di pagina) nel
  // parentId condiviso del nuovo modello (un id di GRUPPO).
  const groupIdByPageId = new Map(allPages.map((p) => [p.id, p.groupId]));

  const pagesByGroup = new Map<string, OldPageRow[]>();
  for (const page of allPages) {
    const group = pagesByGroup.get(page.groupId) ?? [];
    group.push(page);
    pagesByGroup.set(page.groupId, group);
  }

  // First pass: it resolves the canonical page and parentGroupId for EVERY
  // group before inserting any row — the Map's iteration order does not
  // guarantee a parent comes before its children, and page_groups has a
  // self-referencing FK constraint on parentId (see schema.ts). Every row
  // is therefore inserted with `parentId: null`, and a second pass updates
  // it to the real value — sidestepping the ordering problem entirely
  // rather than trying to topologically sort the groups.
  interface ResolvedGroup {
    groupId: string;
    siteId: string;
    canonical: OldPageRow;
    canonicalSignature: string;
    newParentGroupId: string | null;
  }
  const resolvedGroups: ResolvedGroup[] = [];
  for (const [groupId, groupPages] of pagesByGroup) {
    const siteId = groupPages[0].siteId;
    const defaultLocale = defaultLocaleBySite.get(siteId);
    const canonical =
      groupPages.find((p) => p.locale === defaultLocale) ??
      [...groupPages].sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
      )[0];
    resolvedGroups.push({
      groupId,
      siteId,
      canonical,
      canonicalSignature: computeContentStructureSignature(canonical.content),
      newParentGroupId: canonical.parentId
        ? (groupIdByPageId.get(canonical.parentId) ?? null)
        : null,
    });
  }

  for (const { groupId, siteId, canonical } of resolvedGroups) {
    await tx.insert(pageGroups).values({
      id: groupId,
      tenantId,
      siteId,
      parentId: null,
      content: canonical.content,
      order: canonical.order,
      createdBy: canonical.createdBy,
      createdAt: canonical.createdAt,
      updatedAt: canonical.updatedAt,
    });
  }
  for (const { groupId, newParentGroupId } of resolvedGroups) {
    if (newParentGroupId === null) continue;
    await tx
      .update(pageGroups)
      .set({ parentId: newParentGroupId })
      .where(eq(pageGroups.id, groupId));
  }

  for (const {
    groupId,
    siteId,
    canonical,
    canonicalSignature,
    newParentGroupId,
  } of resolvedGroups) {
    const groupPages = pagesByGroup.get(groupId) as OldPageRow[];

    await tx.insert(pageGroupVersions).values({
      id: randomUUID(),
      tenantId,
      pageGroupId: groupId,
      content: canonical.content,
      createdBy: canonical.createdBy,
      createdAt: canonical.updatedAt,
    });
    groupsCreated += 1;

    for (const page of groupPages) {
      const isCanonical = page.id === canonical.id;
      const signature = isCanonical
        ? canonicalSignature
        : computeContentStructureSignature(page.content);
      const isDiverged = signature !== canonicalSignature;
      const fieldValues =
        !isCanonical && !isDiverged
          ? extractFieldValues(page.content, canonical.content)
          : {};

      const translationId = randomUUID();
      await tx.insert(pageTranslations).values({
        id: translationId,
        tenantId,
        siteId,
        pageGroupId: groupId,
        parentGroupId: newParentGroupId,
        locale: page.locale,
        slug: page.slug,
        seoMeta: page.seoMeta,
        fieldValues,
        status: page.status,
        // Copied verbatim, never recomputed: it preserves exactly what is
        // already live on the public site. The structure+fieldValues merge
        // only comes into play from the NEXT real publish() onwards.
        publishedSnapshot: page.publishedContent,
        isDiverged,
        divergedContent: isDiverged ? page.content : null,
        createdBy: page.createdBy,
        createdAt: page.createdAt,
        updatedAt: page.updatedAt,
      });
      await tx.insert(pageTranslationVersions).values({
        id: randomUUID(),
        tenantId,
        pageTranslationId: translationId,
        fieldValues,
        seoMeta: page.seoMeta,
        createdBy: page.createdBy,
        createdAt: page.updatedAt,
      });
      translationsCreated += 1;
      if (isDiverged) divergedCount += 1;
    }
  }
}

async function main(): Promise<void> {
  const db: BriskDb = createAppDb();

  try {
    const allTenants = await db.select({ id: tenants.id }).from(tenants);
    for (const tenant of allTenants) {
      await withTenant(db, tenant.id, (tx) => backfillTenant(tx, tenant.id));
    }

    console.log(
      `Backfill page_groups/page_translations completato: ${groupsCreated} gruppi, ${translationsCreated} traduzioni (${divergedCount} già scollegate per drift strutturale pre-esistente), ${allTenants.length} tenant.`,
    );
  } finally {
    // Always closed, errors included — without this the connection pool
    // keeps the Node process alive indefinitely after an error halfway
    // through a transaction, which looks like a hang rather than a clear
    // failure.
    await db.$client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
