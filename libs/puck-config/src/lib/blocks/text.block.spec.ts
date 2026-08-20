import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ComponentData, PuckContext } from '@puckeditor/core';
import { textConfig, textPropsSchema } from './text.block.js';

type ResolveFieldsParams = Parameters<
  NonNullable<typeof textConfig.resolveFields>
>[1];

function resolveFieldsWithParent(parent: ComponentData | null) {
  return textConfig.resolveFields?.({ props: { id: 'text-1', body: 'x' } }, {
    parent,
  } as ResolveFieldsParams);
}

const puckContext: PuckContext = {
  renderDropZone: () => null,
  metadata: {},
  isEditing: false,
  dragRef: null,
};

describe('textPropsSchema', () => {
  it('accepts valid Text props', () => {
    const result = textPropsSchema.safeParse({ body: 'Un paragrafo.' });
    expect(result.success).toBe(true);
  });

  it('rejects Text props without a body', () => {
    const result = textPropsSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('textConfig.render', () => {
  it('renders the body text', () => {
    render(
      textConfig.render({
        id: 'test-id',
        body: 'Un paragrafo di prova.',
        puck: puckContext,
      }),
    );

    expect(screen.getByText('Un paragrafo di prova.')).toBeTruthy();
  });
});

describe('textConfig.fields', () => {
  it('edits body inline on the canvas instead of the sidebar', () => {
    expect(textConfig.fields?.body).toMatchObject({
      type: 'textarea',
      contentEditable: true,
      visible: false,
    });
  });
});

describe('textConfig.resolveFields', () => {
  it('keeps canvas-only editing at the page root', async () => {
    const result = await resolveFieldsWithParent({
      type: 'root',
      props: { id: 'root' },
    } as ComponentData);
    expect(result?.body).toMatchObject({ visible: false });
  });

  it('falls back to the sidebar textarea when nested inside a Slot (e.g. Container/Column)', async () => {
    const result = await resolveFieldsWithParent({
      type: 'Container',
      props: { id: 'container-1' },
    } as ComponentData);
    expect(result?.body).toMatchObject({ visible: true });
  });
});
