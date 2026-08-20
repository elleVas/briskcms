import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PuckContext } from '@puckeditor/core';
import { statConfig, statPropsSchema } from './stat.block.js';

const puckContext: PuckContext = {
  renderDropZone: () => null,
  metadata: {},
  isEditing: false,
  dragRef: null,
};

describe('statPropsSchema', () => {
  it('accepts valid Stat props', () => {
    const result = statPropsSchema.safeParse({
      value: 250,
      prefix: '+',
      suffix: 'clienti',
      label: 'Clienti serviti',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a non-numeric value', () => {
    const result = statPropsSchema.safeParse({
      value: '250',
      prefix: '',
      suffix: '',
      label: 'Clienti serviti',
    });
    expect(result.success).toBe(false);
  });
});

describe('statConfig.render', () => {
  it('renders the prefix, value, suffix and label', () => {
    render(
      statConfig.render({
        id: 'test-id',
        value: 250,
        prefix: '+',
        suffix: ' clienti',
        label: 'Clienti serviti',
        puck: puckContext,
      }),
    );

    expect(screen.getByText('+250 clienti')).toBeTruthy();
    expect(screen.getByText('Clienti serviti')).toBeTruthy();
  });
});

describe('statConfig.fields', () => {
  it('edits the label inline on the canvas, but keeps value in the sidebar', () => {
    expect(statConfig.fields?.label).toMatchObject({
      type: 'text',
      contentEditable: true,
      visible: false,
    });
    expect(statConfig.fields?.value).not.toHaveProperty(
      'contentEditable',
      true,
    );
  });
});
