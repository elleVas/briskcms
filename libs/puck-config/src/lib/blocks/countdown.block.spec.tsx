import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PuckContext } from '@puckeditor/core';
import { countdownConfig, countdownPropsSchema } from './countdown.block.js';

const puckContext: PuckContext = {
  renderDropZone: () => null,
  metadata: {},
  isEditing: false,
  dragRef: null,
};

describe('countdownPropsSchema', () => {
  it('accepts valid Countdown props', () => {
    const result = countdownPropsSchema.safeParse({
      targetDate: '2026-12-31T23:59',
      label: 'Offerta valida fino a',
    });
    expect(result.success).toBe(true);
  });

  it('rejects Countdown props without a targetDate', () => {
    const result = countdownPropsSchema.safeParse({ label: '' });
    expect(result.success).toBe(false);
  });
});

describe('countdownConfig.render', () => {
  it('renders the label and the raw target date as a static preview', () => {
    render(
      countdownConfig.render({
        id: 'test-id',
        targetDate: '2026-12-31T23:59',
        label: 'Offerta valida fino a',
        puck: puckContext,
      }),
    );

    expect(screen.getByText('Offerta valida fino a')).toBeTruthy();
    expect(screen.getByText('2026-12-31T23:59')).toBeTruthy();
  });

  it('shows a placeholder when no target date is set', () => {
    render(
      countdownConfig.render({
        id: 'test-id',
        targetDate: '',
        label: '',
        puck: puckContext,
      }),
    );

    expect(screen.getByText('Nessuna data impostata')).toBeTruthy();
  });
});
