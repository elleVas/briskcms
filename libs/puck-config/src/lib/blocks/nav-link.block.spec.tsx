import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CustomField, PuckContext } from '@puckeditor/core';
import type { PickedPage } from '@brisk/shared-types';
import { PageListContext } from '../page-list-context.js';
import { navLinkConfig, navLinkPropsSchema } from './nav-link.block.js';

const puckContext: PuckContext = {
  renderDropZone: () => null,
  metadata: {},
  isEditing: false,
  dragRef: null,
};

describe('navLinkPropsSchema', () => {
  it('accepts a page-typed link', () => {
    const result = navLinkPropsSchema.safeParse({
      label: 'Chi siamo',
      linkType: 'page',
      page: {
        pageId: 'page-1',
        locale: 'it',
        slug: 'chi-siamo',
        title: 'Chi siamo',
      },
      url: '',
      position: 'left',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a url-typed link', () => {
    const result = navLinkPropsSchema.safeParse({
      label: 'Sito partner',
      linkType: 'url',
      page: null,
      url: 'https://example.com',
      position: 'right',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown linkType', () => {
    const result = navLinkPropsSchema.safeParse({
      label: 'x',
      linkType: 'email',
      page: null,
      url: '',
      position: 'left',
    });
    expect(result.success).toBe(false);
  });

  it('defaults position to left when omitted', () => {
    const result = navLinkPropsSchema.parse({
      label: 'x',
      linkType: 'url',
      page: null,
      url: '',
    });
    expect(result.position).toBe('left');
  });
});

describe('navLinkConfig.render', () => {
  it('shows the label alone when no page is picked yet', () => {
    render(
      navLinkConfig.render({
        id: 'test-id',
        label: 'Link',
        linkType: 'page',
        page: null,
        url: '',
        position: 'left',
        visibility: 'always',
        puck: puckContext,
      }),
    );

    expect(screen.getByText('Link')).toBeTruthy();
  });

  it("shows the picked page's title for a page-typed link", () => {
    render(
      navLinkConfig.render({
        id: 'test-id',
        label: 'Chi siamo',
        linkType: 'page',
        page: {
          pageId: 'page-1',
          locale: 'it',
          slug: 'chi-siamo',
          title: 'Chi siamo',
        },
        url: '',
        position: 'left',
        visibility: 'always',
        puck: puckContext,
      }),
    );

    expect(screen.getByText('Chi siamo → Chi siamo')).toBeTruthy();
  });

  it('does not append an arrow for a url-typed link', () => {
    render(
      navLinkConfig.render({
        id: 'test-id',
        label: 'Sito partner',
        linkType: 'url',
        page: null,
        url: 'https://example.com',
        position: 'left',
        visibility: 'always',
        puck: puckContext,
      }),
    );

    expect(screen.getByText('Sito partner')).toBeTruthy();
  });

  it('pushes itself to the far side of the flex row when positioned right', () => {
    render(
      navLinkConfig.render({
        id: 'test-id',
        label: 'Contatti',
        linkType: 'url',
        page: null,
        url: '/contatti',
        position: 'right',
        visibility: 'always',
        puck: puckContext,
      }),
    );

    expect(screen.getByText('Contatti').style.marginLeft).toBe('auto');
  });
});

describe('navLinkConfig.fields', () => {
  it('edits label inline on the canvas instead of the sidebar', () => {
    expect(navLinkConfig.fields?.label).toMatchObject({
      type: 'text',
      contentEditable: true,
      visible: false,
    });
  });
});

describe('navLinkConfig.fields.page', () => {
  it('wires the custom field to PagePickerField', () => {
    const pageField = navLinkConfig.fields
      ?.page as CustomField<PickedPage | null>;
    render(
      <PageListContext.Provider value={{ pick: vi.fn() }}>
        {pageField.render({
          field: pageField,
          name: 'page',
          id: 'test-id',
          value: null,
          onChange: vi.fn(),
        })}
      </PageListContext.Provider>,
    );

    expect(screen.getByText('Scegli pagina')).toBeTruthy();
  });
});
