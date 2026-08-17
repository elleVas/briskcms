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
});
