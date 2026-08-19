import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PuckContext } from '@puckeditor/core';
import { embedHtmlConfig, embedHtmlPropsSchema } from './embed-html.block.js';

const puckContext: PuckContext = {
  renderDropZone: () => null,
  metadata: {},
  isEditing: false,
  dragRef: null,
};

describe('embedHtmlPropsSchema', () => {
  it('accepts any string as html', () => {
    const result = embedHtmlPropsSchema.safeParse({
      html: '<script>alert(1)</script>',
    });
    expect(result.success).toBe(true);
  });

  it('rejects props without html', () => {
    const result = embedHtmlPropsSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('embedHtmlConfig.render', () => {
  it('shows the pasted code as escaped preview text, never executed', () => {
    render(
      embedHtmlConfig.render({
        id: 'test-id',
        html: '<script>alert(1)</script>',
        puck: puckContext,
      }),
    );

    expect(screen.getByText('<script>alert(1)</script>')).toBeTruthy();
    // Would throw if the string were ever inserted as real markup instead
    // of escaped text — confirms this is a text preview, not a live render.
    expect(document.querySelector('script')).toBeNull();
  });

  it('shows a placeholder when no code has been entered yet', () => {
    render(
      embedHtmlConfig.render({
        id: 'test-id',
        html: '',
        puck: puckContext,
      }),
    );

    expect(screen.getByText('Nessun codice inserito')).toBeTruthy();
  });
});
