import { describe, expect, it } from 'vitest';
import type { PageContent } from './content-model';
import {
  collectPageGroupReferences,
  collectResolvedPageRefs,
  resolvePageReferences,
} from './page-reference';

describe('collectPageGroupReferences', () => {
  it('collects every referenced pageGroupId, including nested children', () => {
    const content: PageContent = [
      {
        id: 'nav-1',
        type: 'NavLink',
        props: {
          label: 'Docs',
          linkType: 'page',
          page: { pageGroupId: 'group-docs', title: 'Docs' },
          url: '',
        },
      },
      {
        id: 'columns-1',
        type: 'Columns',
        props: {},
        children: [
          {
            id: 'button-1',
            type: 'Button',
            props: {
              label: 'Go',
              linkType: 'page',
              page: { pageGroupId: 'group-contact', title: 'Contact' },
              url: '',
            },
          },
        ],
      },
    ];

    expect(collectPageGroupReferences(content)).toEqual(
      new Set(['group-docs', 'group-contact']),
    );
  });

  it('ignores blocks with no page reference, including a null one', () => {
    const content: PageContent = [
      { id: 'text-1', type: 'Text', props: { body: 'hi' } },
      {
        id: 'link-1',
        type: 'Link',
        props: { label: 'x', linkType: 'url', page: null, url: '/x' },
      },
    ];

    expect(collectPageGroupReferences(content)).toEqual(new Set());
  });
});

describe('resolvePageReferences', () => {
  it('adds locale/slug to every matching page reference for the given map', () => {
    const content: PageContent = [
      {
        id: 'nav-1',
        type: 'NavLink',
        props: {
          label: 'Docs',
          linkType: 'page',
          page: { pageGroupId: 'group-docs', title: 'Docs' },
          url: '',
        },
      },
    ];

    const resolved = resolvePageReferences(
      content,
      new Map([['group-docs', { locale: 'it', slug: 'documentazione' }]]),
    );

    expect(resolved[0].props['page']).toEqual({
      pageGroupId: 'group-docs',
      title: 'Docs',
      locale: 'it',
      slug: 'documentazione',
    });
  });

  it('resolves to null when the referenced group has no translation in this locale', () => {
    const content: PageContent = [
      {
        id: 'nav-1',
        type: 'NavLink',
        props: {
          label: 'Docs',
          linkType: 'page',
          page: { pageGroupId: 'group-docs', title: 'Docs' },
          url: '',
        },
      },
    ];

    const resolved = resolvePageReferences(content, new Map());

    expect(resolved[0].props['page']).toBeNull();
  });

  it('resolves nested children too, and leaves everything else untouched', () => {
    const content: PageContent = [
      {
        id: 'columns-1',
        type: 'Columns',
        props: { layout: 'two-equal' },
        children: [
          {
            id: 'button-1',
            type: 'Button',
            props: {
              label: 'Go',
              linkType: 'page',
              page: { pageGroupId: 'group-contact', title: 'Contact' },
              url: '',
            },
          },
          { id: 'text-1', type: 'Text', props: { body: 'hi' } },
        ],
      },
    ];

    const resolved = resolvePageReferences(
      content,
      new Map([['group-contact', { locale: 'en', slug: 'contact' }]]),
    );

    expect(resolved[0].children?.[0].props['page']).toEqual({
      pageGroupId: 'group-contact',
      title: 'Contact',
      locale: 'en',
      slug: 'contact',
    });
    expect(resolved[0].children?.[1]).toEqual({
      id: 'text-1',
      type: 'Text',
      props: { body: 'hi' },
    });
    expect(resolved[0].props).toEqual({ layout: 'two-equal' });
  });
});

describe('collectResolvedPageRefs', () => {
  it('harvests pageGroupId -> locale/slug pairs from an already-resolved tree', () => {
    const content: PageContent = [
      {
        id: 'nav-1',
        type: 'NavLink',
        props: {
          label: 'Docs',
          linkType: 'page',
          page: {
            pageGroupId: 'group-docs',
            title: 'Docs',
            locale: 'it',
            slug: 'documentazione',
          },
          url: '',
        },
      },
    ];

    expect(collectResolvedPageRefs(content)).toEqual(
      new Map([['group-docs', { locale: 'it', slug: 'documentazione' }]]),
    );
  });

  it('skips an unresolved reference (no locale/slug yet)', () => {
    const content: PageContent = [
      {
        id: 'nav-1',
        type: 'NavLink',
        props: {
          label: 'Docs',
          linkType: 'page',
          page: { pageGroupId: 'group-docs', title: 'Docs' },
          url: '',
        },
      },
    ];

    expect(collectResolvedPageRefs(content)).toEqual(new Map());
  });
});
