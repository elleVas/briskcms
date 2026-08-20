import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CustomField, PuckContext } from '@puckeditor/core';
import type { PickedPage } from '@brisk/shared-types';
import { PageListContext } from '../page-list-context.js';
import { buttonConfig, buttonPropsSchema } from './button.block.js';

const puckContext: PuckContext = {
  renderDropZone: () => null,
  metadata: {},
  isEditing: false,
  dragRef: null,
};

describe('buttonPropsSchema', () => {
  it('defaults variant to primary when omitted', () => {
    const result = buttonPropsSchema.parse({
      label: 'Vai',
      linkType: 'url',
      page: null,
      url: 'https://example.com',
    });
    expect(result.variant).toBe('primary');
  });

  it('rejects an unknown variant', () => {
    const result = buttonPropsSchema.safeParse({
      label: 'Vai',
      linkType: 'url',
      page: null,
      url: '',
      variant: 'tertiary',
    });
    expect(result.success).toBe(false);
  });
});

describe('buttonConfig.render', () => {
  it('renders the label', () => {
    render(
      buttonConfig.render({
        id: 'test-id',
        label: 'Vai',
        linkType: 'url',
        page: null,
        url: 'https://example.com',
        variant: 'primary',
        puck: puckContext,
      }),
    );

    expect(screen.getByText('Vai')).toBeTruthy();
  });

  it("shows the picked page's title for a page-typed link", () => {
    render(
      buttonConfig.render({
        id: 'test-id',
        label: 'Vai',
        linkType: 'page',
        page: {
          pageId: 'page-1',
          locale: 'it',
          slug: 'servizi',
          title: 'Servizi',
        },
        url: '',
        variant: 'primary',
        puck: puckContext,
      }),
    );

    expect(screen.getByText('Vai → Servizi')).toBeTruthy();
  });
});

describe('buttonConfig.fields', () => {
  it('edits label inline on the canvas instead of the sidebar', () => {
    expect(buttonConfig.fields?.label).toMatchObject({
      type: 'text',
      contentEditable: true,
      visible: false,
    });
  });
});

describe('buttonConfig.fields.page', () => {
  it('wires the custom field to PagePickerField', () => {
    const pageField = buttonConfig.fields
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
