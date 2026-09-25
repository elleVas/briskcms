import type {
  ReusableSectionDto,
  ReusableSectionListItemDto,
} from '../lib/reusable-sections-api-client';
import type {
  SiteLayoutSectionDto,
  SiteLayoutSectionVersionDto,
} from '../lib/site-layout-sections-api-client';
import type { TaxonomyDto, TermDto } from '../lib/taxonomies-api-client';
import type { UserDto } from '../lib/users-api-client';

/*
 * Builders for the response shapes only the editor declares — the ones in
 * `src/lib/*-api-client.ts`, not in `@brisk/shared-types`, so they cannot
 * live in `@brisk/testing/records` with the rest.
 *
 * Same rules as there: fixed, readable defaults in `site-1` of `tenant-1`,
 * and a spec passes as overrides only the fields its test is about.
 */

const CREATED_AT = '2026-01-01T00:00:00.000Z';

/** The same person as `buildUser` in `@brisk/testing`, as the users list sends them. */
export function buildUserDto(overrides: Partial<UserDto> = {}): UserDto {
  return {
    id: 'user-1',
    tenantId: 'tenant-1',
    email: 'lele@example.com',
    displayName: 'Lele',
    slug: null,
    avatarUrl: null,
    role: 'admin',
    isActive: true,
    emailVerifiedAt: null,
    createdAt: CREATED_AT,
    ...overrides,
  };
}

/** A header nobody has published yet — what `SiteLayoutSection.create` leaves. */
export function buildSiteLayoutSectionDto(
  overrides: Partial<SiteLayoutSectionDto> = {},
): SiteLayoutSectionDto {
  return {
    id: 'section-1',
    tenantId: 'tenant-1',
    siteId: 'site-1',
    locale: 'it',
    kind: 'header',
    status: 'draft',
    content: [],
    publishedContent: null,
    sticky: false,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    ...overrides,
  };
}

export function buildSiteLayoutSectionVersionDto(
  overrides: Partial<SiteLayoutSectionVersionDto> = {},
): SiteLayoutSectionVersionDto {
  return {
    id: 'version-1',
    tenantId: 'tenant-1',
    siteLayoutSectionId: 'section-1',
    content: [],
    createdBy: null,
    createdAt: CREATED_AT,
    ...overrides,
  };
}

/** A shared section nobody has published yet — what `ReusableSection.create` leaves. */
export function buildReusableSectionDto(
  overrides: Partial<ReusableSectionDto> = {},
): ReusableSectionDto {
  return {
    id: 'reusable-section-1',
    tenantId: 'tenant-1',
    siteId: 'site-1',
    name: 'Section',
    kind: 'shared',
    status: 'draft',
    content: [],
    publishedContent: null,
    exposedFields: {},
    createdBy: null,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    ...overrides,
  };
}

/** The same section as a row of the sections list, used nowhere yet. */
export function buildReusableSectionListItemDto(
  overrides: Partial<ReusableSectionListItemDto> = {},
): ReusableSectionListItemDto {
  return {
    ...buildReusableSectionDto(),
    usedOnPages: 0,
    usedInTemplates: 0,
    ...overrides,
  };
}

export function buildTaxonomyDto(
  overrides: Partial<TaxonomyDto> = {},
): TaxonomyDto {
  return {
    id: 'taxonomy-1',
    tenantId: 'tenant-1',
    siteId: 'site-1',
    prefix: 'categoria',
    name: { it: 'Categoria' },
    hierarchical: true,
    order: 0,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    ...overrides,
  };
}

/** A top-level term of `buildTaxonomyDto`'s taxonomy, named and addressed in Italian. */
export function buildTermDto(overrides: Partial<TermDto> = {}): TermDto {
  return {
    id: 'term-1',
    tenantId: 'tenant-1',
    siteId: 'site-1',
    taxonomyId: 'taxonomy-1',
    parentId: null,
    name: { it: 'Term' },
    description: {},
    seoMeta: {},
    noindex: false,
    landingPageGroupId: null,
    order: 0,
    slugs: { it: 'term' },
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    ...overrides,
  };
}
