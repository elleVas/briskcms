import { describe, expect, it } from 'vitest';
import type { ComponentData, Fields } from '@puckeditor/core';
import { withInlineTextFallback } from './resolve-inline-text-fallback.js';

interface Props {
  title: string;
  icon: string;
}

const fields: Fields<Props> = {
  title: { type: 'text', contentEditable: true, visible: false },
  icon: { type: 'text' },
};

const rootParent = { type: 'root', props: { id: 'root' } } as ComponentData;
const containerParent = {
  type: 'Container',
  props: { id: 'container-1' },
} as ComponentData;

describe('withInlineTextFallback', () => {
  it('keeps contentEditable fields canvas-only at the page root (parent is the synthetic root)', () => {
    const result = withInlineTextFallback(fields, rootParent);
    expect(result.title).toMatchObject({
      contentEditable: true,
      visible: false,
    });
  });

  it('keeps contentEditable fields canvas-only when parent is null', () => {
    const result = withInlineTextFallback(fields, null);
    expect(result.title).toMatchObject({
      contentEditable: true,
      visible: false,
    });
  });

  it('falls back to the sidebar field when nested inside a Slot', () => {
    const result = withInlineTextFallback(fields, containerParent);
    expect(result.title).toMatchObject({
      contentEditable: true,
      visible: true,
    });
  });

  it('leaves non-contentEditable fields untouched either way', () => {
    expect(withInlineTextFallback(fields, containerParent).icon).toMatchObject(
      fields.icon!,
    );
    expect(withInlineTextFallback(fields, rootParent).icon).toMatchObject(
      fields.icon!,
    );
  });
});
