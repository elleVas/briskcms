import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PuckContext } from '@puckeditor/core';
import { breadcrumbConfig, breadcrumbPropsSchema } from './breadcrumb.block.js';

const puckContext: PuckContext = {
  renderDropZone: () => null,
  metadata: {},
  isEditing: false,
  dragRef: null,
};

describe('breadcrumbPropsSchema', () => {
  it('defaults homeLabel and visibility when omitted', () => {
    const result = breadcrumbPropsSchema.parse({});
    expect(result.homeLabel).toBe('Home');
    expect(result.visibility).toBe('always');
  });

  it('accepts an explicit homeLabel and visibility', () => {
    const result = breadcrumbPropsSchema.safeParse({
      homeLabel: 'Inizio',
      visibility: 'desktop-only',
    });
    expect(result.success).toBe(true);
  });
});

describe('breadcrumbConfig.render', () => {
  it('renders the configured home label', () => {
    render(
      breadcrumbConfig.render({
        id: 'test-id',
        homeLabel: 'Inizio',
        visibility: 'always',
        puck: puckContext,
      }),
    );

    expect(screen.getByText('Inizio')).toBeTruthy();
  });
});

describe('breadcrumbConfig.fields', () => {
  it('edits homeLabel inline on the canvas instead of the sidebar', () => {
    expect(breadcrumbConfig.fields?.homeLabel).toMatchObject({
      type: 'text',
      contentEditable: true,
      visible: false,
    });
  });
});
