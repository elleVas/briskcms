import { z } from 'zod';
import { blockSchema, seoMetaSchema } from './content-model';
import { fieldValueOverlaySchema } from './field-value-overlay';

export const pageStatusSchema = z.enum(['draft', 'published']);
export type PageStatus = z.infer<typeof pageStatusSchema>;

/**
 * The editor CRUD shape (`GET/PATCH/POST /pages/*` responses in
 * apps/api's PagesController) — the full block tree (both draft and
 * published), unlike PublishedPage which only ever carries the published
 * one. Shared between PagesController's toDto() (server-side shape) and
 * apps/editor-app's pages-api-client.ts (parses it off the wire).
 */
export const pageRecordSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  siteId: z.string(),
  groupId: z.string(),
  locale: z.string(),
  slug: z.string(),
  parentId: z.string().nullable(),
  status: pageStatusSchema,
  content: z.array(blockSchema),
  publishedContent: z.array(blockSchema).nullable(),
  seoMeta: seoMetaSchema,
  // The block-structure signature (see content-structure-signature.ts)
  // this page's content was last confirmed aligned to — for a translation,
  // that of its group's default-locale page at the time it was created or
  // last explicitly marked synced; `null` for a page never tracked under
  // this mechanism (pre-existing translations, or a group's own
  // default-locale page, which never drifts from itself).
  syncedStructureSignature: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PageRecord = z.infer<typeof pageRecordSchema>;

/**
 * The `GET /pages` list-item shape — deliberately without `content`/
 * `publishedContent` (security review 2026-08-24, database section: the
 * list endpoint used to ship the entire Puck block tree just to render a
 * list of titles). `hasUnpublishedChanges` replaces the client-side
 * content-vs-publishedContent comparison the list view used to do with
 * both full trees already in hand — computed server-side instead (see
 * `PageSummary` in libs/ports, the internal Port-level type this DTO
 * mirrors at the wire boundary; named differently here to keep the two
 * concerns — internal repository contract vs. wire shape — visibly
 * distinct, even though they happen to carry the same fields today).
 */
export const pageListItemSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  siteId: z.string(),
  groupId: z.string(),
  locale: z.string(),
  slug: z.string(),
  parentId: z.string().nullable(),
  status: pageStatusSchema,
  seoMeta: seoMetaSchema,
  // Sibling-scoped position (drag-to-reorder) — see PageSummary's own doc
  // comment in libs/ports.
  order: z.number(),
  // Resolved server-side (displayName, falling back to email), not a raw
  // user id — this DTO is display-only, same reasoning as
  // hasUnpublishedChanges below.
  createdByName: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  hasUnpublishedChanges: z.boolean(),
});
export type PageListItem = z.infer<typeof pageListItemSchema>;

export const paginatedPagesSchema = z.object({
  items: z.array(pageListItemSchema),
  total: z.number(),
});
export type PaginatedPages = z.infer<typeof paginatedPagesSchema>;

/** One translation, projected down to what a page-groups list row's locale badge needs — see pageGroupListItemSchema. */
export const pageGroupListItemTranslationSchema = z.object({
  locale: z.string(),
  slug: z.string(),
  title: z.string(),
  status: pageStatusSchema,
  isDiverged: z.boolean(),
});
export type PageGroupListItemTranslation = z.infer<
  typeof pageGroupListItemTranslationSchema
>;

/** `GET /page-groups` (Fase 4's pages-list view) — one row per PageGroup, every locale's translation summarized for the row's availability badges. */
export const pageGroupListItemSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  siteId: z.string(),
  parentId: z.string().nullable(),
  order: z.number(),
  createdByName: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  translations: z.array(pageGroupListItemTranslationSchema),
});
export type PageGroupListItemRecord = z.infer<typeof pageGroupListItemSchema>;

export const paginatedPageGroupsSchema = z.object({
  items: z.array(pageGroupListItemSchema),
  total: z.number(),
});
export type PaginatedPageGroups = z.infer<typeof paginatedPageGroupsSchema>;

/** `GET /pages/:id/versions` — mirrors the plain `PageVersion` domain interface (libs/domain-core), which has no extra fields to whitelist against. */
export const pageVersionRecordSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  pageId: z.string(),
  content: z.array(blockSchema),
  createdBy: z.string().nullable(),
  createdAt: z.string(),
});
export type PageVersionRecord = z.infer<typeof pageVersionRecordSchema>;

/**
 * i18n a livello di campo (vedi ADR pendente/il piano) — wire shape del
 * `PageGroup` domain entity (libs/domain-core), non ancora servita da
 * alcun endpoint (Fase 1 del piano). Affianca `pageRecordSchema` sopra
 * (vecchio modello a pagina duplicata) finché la Fase 5 non rimuove
 * quest'ultimo — le due coesistono deliberatamente durante la migrazione.
 */
export const pageGroupRecordSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  siteId: z.string(),
  parentId: z.string().nullable(),
  order: z.number(),
  content: z.array(blockSchema),
  createdBy: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PageGroupRecord = z.infer<typeof pageGroupRecordSchema>;

/** Wire shape del `PageTranslation` domain entity — vedi `pageGroupRecordSchema` sopra per il contesto della coesistenza col vecchio modello. */
export const pageTranslationRecordSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  siteId: z.string(),
  pageGroupId: z.string(),
  locale: z.string(),
  slug: z.string(),
  seoMeta: seoMetaSchema,
  fieldValues: fieldValueOverlaySchema,
  status: pageStatusSchema,
  publishedSnapshot: z.array(blockSchema).nullable(),
  isDiverged: z.boolean(),
  divergedContent: z.array(blockSchema).nullable(),
  createdBy: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PageTranslationRecord = z.infer<typeof pageTranslationRecordSchema>;

/** `GET /page-groups/:id/versions` — mirrors `PageGroupVersion` (libs/domain-core). */
export const pageGroupVersionRecordSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  pageGroupId: z.string(),
  content: z.array(blockSchema),
  createdBy: z.string().nullable(),
  createdAt: z.string(),
});
export type PageGroupVersionRecord = z.infer<
  typeof pageGroupVersionRecordSchema
>;

/** `GET /page-translations/:id/versions` — mirrors `PageTranslationVersion` (libs/domain-core). */
export const pageTranslationVersionRecordSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  pageTranslationId: z.string(),
  fieldValues: fieldValueOverlaySchema,
  seoMeta: seoMetaSchema,
  createdBy: z.string().nullable(),
  createdAt: z.string(),
});
export type PageTranslationVersionRecord = z.infer<
  typeof pageTranslationVersionRecordSchema
>;
