import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PuckContext } from '@puckeditor/core';
import {
  testimonialConfig,
  testimonialPropsSchema,
} from './testimonial.block.js';

const puckContext: PuckContext = {
  renderDropZone: () => null,
  metadata: {},
  isEditing: false,
  dragRef: null,
};

describe('testimonialPropsSchema', () => {
  it('accepts valid Testimonial props', () => {
    const result = testimonialPropsSchema.safeParse({
      quote: 'Ottimo servizio',
      author: 'Maria Rossi',
      role: 'CEO',
      avatar: null,
      rating: 5,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a rating outside 1-5', () => {
    const result = testimonialPropsSchema.safeParse({
      quote: 'Ottimo servizio',
      author: 'Maria Rossi',
      role: 'CEO',
      avatar: null,
      rating: 6,
    });
    expect(result.success).toBe(false);
  });
});

describe('testimonialConfig.render', () => {
  it('renders the quote, author, role and filled stars up to the rating', () => {
    render(
      testimonialConfig.render({
        id: 'test-id',
        quote: 'Ottimo servizio',
        author: 'Maria Rossi',
        role: 'CEO',
        avatar: null,
        rating: 3,
        puck: puckContext,
      }),
    );

    expect(screen.getByText('Ottimo servizio')).toBeTruthy();
    expect(screen.getByText('Maria Rossi')).toBeTruthy();
    expect(screen.getByText('CEO')).toBeTruthy();
  });

  it('renders the avatar image when picked', () => {
    // The avatar is decorative (alt="", the author's name is the real
    // accessible label right next to it) — same reasoning as
    // media-picker-field.spec.tsx's own thumbnail, so it has no accessible
    // "img" role; query the DOM directly instead of by role.
    const { container } = render(
      testimonialConfig.render({
        id: 'test-id',
        quote: 'Ottimo servizio',
        author: 'Maria Rossi',
        role: '',
        avatar: { mediaId: 'media-1', url: 'http://localhost/a.webp' },
        rating: 5,
        puck: puckContext,
      }),
    );

    expect(container.querySelector('img')).toHaveProperty(
      'src',
      'http://localhost/a.webp',
    );
  });
});

describe('testimonialConfig.fields', () => {
  it('edits the quote inline on the canvas, but keeps author/role in the sidebar', () => {
    expect(testimonialConfig.fields?.quote).toMatchObject({
      type: 'textarea',
      contentEditable: true,
      visible: false,
    });
    expect(testimonialConfig.fields?.author).not.toHaveProperty(
      'contentEditable',
      true,
    );
    expect(testimonialConfig.fields?.role).not.toHaveProperty(
      'contentEditable',
      true,
    );
  });
});
