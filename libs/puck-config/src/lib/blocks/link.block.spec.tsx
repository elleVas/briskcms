import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CustomField, PuckContext } from '@puckeditor/core';
import type { PickedPage } from '@brisk/shared-types';
import { PageListContext } from '../page-list-context.js';
import { linkConfig, linkPropsSchema } from './link.block.js';

const puckContext: PuckContext = {
  renderDropZone: () => null,
  metadata: {},
  isEditing: false,
  dragRef: null,
};

describe('linkPropsSchema', () => {
  it('accepts a page-typed link', () => {
    const result = linkPropsSchema.safeParse({
      label: 'Scopri di più',
      linkType: 'page',
      page: {
        pageId: 'page-1',
        locale: 'it',
        slug: 'servizi',
        title: 'Servizi',
      },
      url: '',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a URL-typed link', () => {
    const result = linkPropsSchema.safeParse({
      label: 'Scopri di più',
      linkType: 'url',
      page: null,
      url: 'https://example.com',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown linkType', () => {
    const result = linkPropsSchema.safeParse({
      label: 'Scopri di più',
      linkType: 'email',
      page: null,
      url: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('linkConfig.render', () => {
  it('renders the label', () => {
    render(
      linkConfig.render({
        id: 'test-id',
        label: 'Scopri di più',
        linkType: 'url',
        page: null,
        url: 'https://example.com',
        puck: puckContext,
      }),
    );

    expect(screen.getByText('Scopri di più')).toBeTruthy();
  });

  it("shows the picked page's title for a page-typed link", () => {
    render(
      linkConfig.render({
        id: 'test-id',
        label: 'Scopri di più',
        linkType: 'page',
        page: {
          pageId: 'page-1',
          locale: 'it',
          slug: 'servizi',
          title: 'Servizi',
        },
        url: '',
        puck: puckContext,
      }),
    );

    expect(screen.getByText('Scopri di più → Servizi')).toBeTruthy();
  });
});

describe('linkConfig.fields', () => {
  it('edits label inline on the canvas instead of the sidebar', () => {
    expect(linkConfig.fields?.label).toMatchObject({
      type: 'text',
      contentEditable: true,
      visible: false,
    });
  });
});

describe('linkConfig.fields.page', () => {
  it('wires the custom field to PagePickerField', () => {
    const pageField = linkConfig.fields?.page as CustomField<PickedPage | null>;
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
