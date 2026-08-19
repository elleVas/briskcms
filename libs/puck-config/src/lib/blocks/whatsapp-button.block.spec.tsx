import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PuckContext } from '@puckeditor/core';
import {
  whatsAppButtonConfig,
  whatsAppButtonPropsSchema,
} from './whatsapp-button.block.js';

const puckContext: PuckContext = {
  renderDropZone: () => null,
  metadata: {},
  isEditing: false,
  dragRef: null,
};

describe('whatsAppButtonPropsSchema', () => {
  it('defaults visibility to always when omitted', () => {
    const result = whatsAppButtonPropsSchema.parse({
      phoneNumber: '+391234567890',
      message: '',
    });
    expect(result.visibility).toBe('always');
  });

  it('accepts a phone number and message', () => {
    const result = whatsAppButtonPropsSchema.safeParse({
      phoneNumber: '+391234567890',
      message: 'Ciao!',
      visibility: 'always',
    });
    expect(result.success).toBe(true);
  });

  it('rejects props missing phoneNumber', () => {
    const result = whatsAppButtonPropsSchema.safeParse({ message: '' });
    expect(result.success).toBe(false);
  });
});

describe('whatsAppButtonConfig.render', () => {
  it('shows the phone number next to the icon', () => {
    render(
      whatsAppButtonConfig.render({
        id: 'test-id',
        phoneNumber: '+391234567890',
        message: '',
        visibility: 'always',
        puck: puckContext,
      }),
    );

    expect(screen.getByText('+391234567890')).toBeTruthy();
  });
});
