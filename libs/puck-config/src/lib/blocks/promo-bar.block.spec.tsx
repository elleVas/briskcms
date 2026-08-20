import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CustomField, PuckContext } from '@puckeditor/core';
import type { PickedPage } from '@brisk/shared-types';
import { PageListContext } from '../page-list-context.js';
import { promoBarConfig, promoBarPropsSchema } from './promo-bar.block.js';

const puckContext: PuckContext = {
  renderDropZone: () => null,
  metadata: {},
  isEditing: false,
  dragRef: null,
};

describe('promoBarPropsSchema', () => {
  it('accepts a page-typed link', () => {
    const result = promoBarPropsSchema.safeParse({
      message: 'Promo di primavera',
      linkType: 'page',
      page: {
        pageId: 'page-1',
        locale: 'it',
        slug: 'promo',
        title: 'Promo',
      },
      url: '',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a url-typed link', () => {
    const result = promoBarPropsSchema.safeParse({
      message: 'Promo di primavera',
      linkType: 'url',
      page: null,
      url: 'https://example.com',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown linkType', () => {
    const result = promoBarPropsSchema.safeParse({
      message: 'x',
      linkType: 'email',
      page: null,
      url: '',
    });
    expect(result.success).toBe(false);
  });

  it('defaults visibility to always when omitted', () => {
    const result = promoBarPropsSchema.parse({
      message: 'x',
      linkType: 'url',
      page: null,
      url: '',
    });
    expect(result.visibility).toBe('always');
  });
});

describe('promoBarConfig.render', () => {
  it('shows the message alone when no page is picked yet', () => {
    render(
      promoBarConfig.render({
        id: 'test-id',
        message: 'Promo di primavera',
        linkType: 'page',
        page: null,
        url: '',
        visibility: 'always',
        puck: puckContext,
      }),
    );

    expect(screen.getByText('Promo di primavera')).toBeTruthy();
  });

  it("shows the picked page's title for a page-typed link", () => {
    render(
      promoBarConfig.render({
        id: 'test-id',
        message: 'Promo di primavera',
        linkType: 'page',
        page: {
          pageId: 'page-1',
          locale: 'it',
          slug: 'promo',
          title: 'Promo',
        },
        url: '',
        visibility: 'always',
        puck: puckContext,
      }),
    );

    expect(screen.getByText('Promo di primavera → Promo')).toBeTruthy();
  });

  it('does not append an arrow for a url-typed link', () => {
    render(
      promoBarConfig.render({
        id: 'test-id',
        message: 'Promo di primavera',
        linkType: 'url',
        page: null,
        url: 'https://example.com',
        visibility: 'always',
        puck: puckContext,
      }),
    );

    expect(screen.getByText('Promo di primavera')).toBeTruthy();
  });
});

describe('promoBarConfig.fields', () => {
  it('edits message inline on the canvas instead of the sidebar', () => {
    expect(promoBarConfig.fields?.message).toMatchObject({
      type: 'textarea',
      contentEditable: true,
      visible: false,
    });
  });
});

describe('promoBarConfig.fields.page', () => {
  it('wires the custom field to PagePickerField', () => {
    const pageField = promoBarConfig.fields
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
