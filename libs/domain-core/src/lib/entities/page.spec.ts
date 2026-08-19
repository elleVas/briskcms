import { describe, expect, it } from 'vitest';
import { Page } from './page.js';

describe('Page entity', () => {
  const baseInput = {
    id: 'page-1',
    tenantId: 'tenant-1',
    siteId: 'site-1',
    groupId: 'group-1',
    locale: 'it',
    slug: 'home',
    seoMeta: { title: 'Home', description: 'La home' },
  };

  it('starts as a draft with no published content', () => {
    const page = Page.create(baseInput);
    expect(page.status).toBe('draft');
    expect(page.publishedContent).toBeNull();
    expect(page.content).toEqual([]);
  });

  it('saveDraft updates content without touching publishedContent', () => {
    const page = Page.create(baseInput);
    page.saveDraft([{ type: 'Hero', props: { title: 'Ciao' } }]);
    expect(page.content).toEqual([{ type: 'Hero', props: { title: 'Ciao' } }]);
    expect(page.publishedContent).toBeNull();
  });

  it('publish promotes the current draft to publishedContent', () => {
    const page = Page.create(baseInput);
    page.saveDraft([{ type: 'Hero', props: { title: 'Ciao' } }]);
    page.publish();
    expect(page.status).toBe('published');
    expect(page.publishedContent).toEqual([
      { type: 'Hero', props: { title: 'Ciao' } },
    ]);
  });

  it('restoreContent changes the draft but never the already-published content', () => {
    const page = Page.create(baseInput);
    page.saveDraft([{ type: 'Hero', props: { title: 'v1' } }]);
    page.publish();

    page.restoreContent([{ type: 'Hero', props: { title: 'v0' } }]);

    expect(page.content).toEqual([{ type: 'Hero', props: { title: 'v0' } }]);
    expect(page.publishedContent).toEqual([
      { type: 'Hero', props: { title: 'v1' } },
    ]);
    expect(page.status).toBe('published');
  });

  it('create() exposes every prop via its getters', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const page = Page.create({ ...baseInput, now });

    expect(page.id).toBe('page-1');
    expect(page.tenantId).toBe('tenant-1');
    expect(page.siteId).toBe('site-1');
    expect(page.groupId).toBe('group-1');
    expect(page.locale).toBe('it');
    expect(page.slug).toBe('home');
    expect(page.seoMeta).toEqual({ title: 'Home', description: 'La home' });
    expect(page.createdAt).toEqual(now);
    expect(page.updatedAt).toEqual(now);
  });

  it('starts with no parent, and setParent() reassigns it without touching other fields', () => {
    const page = Page.create(baseInput);
    expect(page.parentId).toBeNull();

    const now = new Date('2026-02-01T00:00:00Z');
    page.setParent('parent-1', now);

    expect(page.parentId).toBe('parent-1');
    expect(page.updatedAt).toEqual(now);

    page.setParent(null);
    expect(page.parentId).toBeNull();
  });

  it('fromProps/toProps round-trip without loss', () => {
    const props = {
      ...baseInput,
      parentId: null,
      status: 'published' as const,
      content: [{ type: 'Hero', props: { title: 'v1' } }],
      publishedContent: [{ type: 'Hero', props: { title: 'v1' } }],
      createdAt: new Date('2025-12-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    };

    const page = Page.fromProps(props);

    expect(page.toProps()).toEqual(props);
  });
});
