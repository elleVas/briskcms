import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CustomField, PuckContext } from '@puckeditor/core';
import type { PickedPage } from '@brisk/shared-types';
import { PageListContext } from '../page-list-context.js';
import { bannerConfig, bannerPropsSchema } from './banner.block.js';

const puckContext: PuckContext = {
  renderDropZone: () => null,
  metadata: {},
  isEditing: false,
  dragRef: null,
};

describe('bannerPropsSchema', () => {
  it('accepts a page-typed link', () => {
    const result = bannerPropsSchema.safeParse({
      title: 'Titolo',
      text: 'Testo',
      buttonLabel: 'Vai',
      linkType: 'page',
      page: {
        pageId: 'page-1',
        locale: 'it',
        slug: 'servizi',
        title: 'Servizi',
      },
      url: '',
      backgroundColor: '#f4f4f5',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown linkType', () => {
    const result = bannerPropsSchema.safeParse({
      title: 'Titolo',
      text: 'Testo',
      buttonLabel: 'Vai',
      linkType: 'email',
      page: null,
      url: '',
      backgroundColor: '#f4f4f5',
    });
    expect(result.success).toBe(false);
  });
});

describe('bannerConfig.render', () => {
  it('renders title, text and the button label', () => {
    render(
      bannerConfig.render({
        id: 'test-id',
        title: 'Titolo',
        text: 'Testo del banner',
        buttonLabel: 'Vai',
        linkType: 'url',
        page: null,
        url: 'https://example.com',
        backgroundColor: '#f4f4f5',
        puck: puckContext,
      }),
    );

    expect(screen.getByText('Titolo')).toBeTruthy();
    expect(screen.getByText('Testo del banner')).toBeTruthy();
    expect(screen.getByText('Vai')).toBeTruthy();
  });

  it("shows the picked page's title for a page-typed link", () => {
    render(
      bannerConfig.render({
        id: 'test-id',
        title: 'Titolo',
        text: 'Testo',
        buttonLabel: 'Vai',
        linkType: 'page',
        page: {
          pageId: 'page-1',
          locale: 'it',
          slug: 'servizi',
          title: 'Servizi',
        },
        url: '',
        backgroundColor: '#f4f4f5',
        puck: puckContext,
      }),
    );

    expect(screen.getByText('Vai → Servizi')).toBeTruthy();
  });
});

describe('bannerConfig.fields', () => {
  it('edits title, text and buttonLabel inline on the canvas instead of the sidebar', () => {
    expect(bannerConfig.fields?.title).toMatchObject({
      type: 'text',
      contentEditable: true,
      visible: false,
    });
    expect(bannerConfig.fields?.text).toMatchObject({
      type: 'textarea',
      contentEditable: true,
      visible: false,
    });
    expect(bannerConfig.fields?.buttonLabel).toMatchObject({
      type: 'text',
      contentEditable: true,
      visible: false,
    });
  });
});

describe('bannerConfig.fields.page', () => {
  it('wires the custom field to PagePickerField', () => {
    const pageField = bannerConfig.fields
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
