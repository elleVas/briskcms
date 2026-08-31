import { describe, expect, it } from 'vitest';
import type { PageListItem } from '../lib/pages-api-client';
import { computeSiblingReorder } from './compute-sibling-reorder';

function page(overrides: Partial<PageListItem>): PageListItem {
  return {
    id: 'id',
    tenantId: 't',
    siteId: 's',
    groupId: 'g',
    locale: 'it',
    slug: 'slug',
    parentId: null,
    status: 'draft',
    seoMeta: { title: 'Title', description: '' },
    order: 0,
    createdByName: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    hasUnpublishedChanges: false,
    ...overrides,
  };
}

describe('computeSiblingReorder', () => {
  it('moves the active page to the position of the over page, within the same (locale, parentId) group', () => {
    const pages = [
      page({ id: 'a', parentId: null, locale: 'it' }),
      page({ id: 'b', parentId: null, locale: 'it' }),
      page({ id: 'c', parentId: null, locale: 'it' }),
    ];
    expect(computeSiblingReorder(pages, 'a', 'c')).toEqual({
      locale: 'it',
      parentId: null,
      orderedPageIds: ['b', 'c', 'a'],
    });
  });

  it('returns null when dropped on itself', () => {
    const pages = [page({ id: 'a' }), page({ id: 'b' })];
    expect(computeSiblingReorder(pages, 'a', 'a')).toBeNull();
  });

  it('returns null when there is no drop target', () => {
    const pages = [page({ id: 'a' })];
    expect(computeSiblingReorder(pages, 'a', null)).toBeNull();
  });

  it("rejects a drop across different parents (reparenting is ParentPageSelect's job, not drag)", () => {
    const pages = [
      page({ id: 'a', parentId: null }),
      page({ id: 'root' }),
      page({ id: 'b', parentId: 'root' }),
    ];
    expect(computeSiblingReorder(pages, 'a', 'b')).toBeNull();
  });

  it('rejects a drop across different locales, even under the same parentId value', () => {
    const pages = [
      page({ id: 'a', locale: 'it', parentId: null }),
      page({ id: 'b', locale: 'en', parentId: null }),
    ];
    expect(computeSiblingReorder(pages, 'a', 'b')).toBeNull();
  });

  it('only reorders within the dragged group, ignoring pages from other groups mixed into the flat list', () => {
    const pages = [
      page({ id: 'root' }),
      page({ id: 'a', parentId: 'root', locale: 'it' }),
      page({ id: 'x', parentId: null, locale: 'it' }), // unrelated sibling, different group
      page({ id: 'b', parentId: 'root', locale: 'it' }),
    ];
    expect(computeSiblingReorder(pages, 'a', 'b')).toEqual({
      locale: 'it',
      parentId: 'root',
      orderedPageIds: ['b', 'a'],
    });
  });
});
