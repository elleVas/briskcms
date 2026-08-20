import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PuckContext } from '@puckeditor/core';
import {
  newsletterSignupConfig,
  newsletterSignupPropsSchema,
} from './newsletter-signup.block.js';

const puckContext: PuckContext = {
  renderDropZone: () => null,
  metadata: {},
  isEditing: false,
  dragRef: null,
};

describe('newsletterSignupPropsSchema', () => {
  it('accepts valid props', () => {
    const result = newsletterSignupPropsSchema.safeParse({
      title: 'Iscriviti',
      buttonLabel: 'Vai',
    });
    expect(result.success).toBe(true);
  });

  it('rejects props missing a title', () => {
    const result = newsletterSignupPropsSchema.safeParse({
      buttonLabel: 'Vai',
    });
    expect(result.success).toBe(false);
  });
});

describe('newsletterSignupConfig.render', () => {
  it('renders the title and button label', () => {
    render(
      newsletterSignupConfig.render({
        id: 'test-id',
        title: 'Iscriviti alla newsletter',
        buttonLabel: 'Iscrivimi',
        puck: puckContext,
      }),
    );

    expect(screen.getByText('Iscriviti alla newsletter')).toBeTruthy();
    expect(screen.getByText('Iscrivimi')).toBeTruthy();
  });
});

describe('newsletterSignupConfig.fields', () => {
  it('edits title and buttonLabel inline on the canvas', () => {
    expect(newsletterSignupConfig.fields?.title).toMatchObject({
      type: 'text',
      contentEditable: true,
      visible: false,
    });
    expect(newsletterSignupConfig.fields?.buttonLabel).toMatchObject({
      type: 'text',
      contentEditable: true,
      visible: false,
    });
  });
});
