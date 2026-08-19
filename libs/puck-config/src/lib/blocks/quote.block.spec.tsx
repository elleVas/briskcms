import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PuckContext } from '@puckeditor/core';
import { quoteConfig, quotePropsSchema } from './quote.block.js';

const puckContext: PuckContext = {
  renderDropZone: () => null,
  metadata: {},
  isEditing: false,
  dragRef: null,
};

describe('quotePropsSchema', () => {
  it('accepts valid Quote props', () => {
    const result = quotePropsSchema.safeParse({
      quote: 'Una citazione.',
      author: 'Maria Rossi',
      role: 'CEO, Acme',
    });
    expect(result.success).toBe(true);
  });

  it('rejects Quote props without a quote', () => {
    const result = quotePropsSchema.safeParse({ author: '', role: '' });
    expect(result.success).toBe(false);
  });
});

describe('quoteConfig.render', () => {
  it('renders the quote and the author — role citation', () => {
    render(
      quoteConfig.render({
        id: 'test-id',
        quote: 'Una citazione di prova.',
        author: 'Maria Rossi',
        role: 'CEO, Acme',
        puck: puckContext,
      }),
    );

    expect(screen.getByText('Una citazione di prova.')).toBeTruthy();
    expect(screen.getByText('Maria Rossi — CEO, Acme')).toBeTruthy();
  });

  it('omits the citation entirely when author and role are both empty', () => {
    render(
      quoteConfig.render({
        id: 'test-id',
        quote: 'Una citazione di prova.',
        author: '',
        role: '',
        puck: puckContext,
      }),
    );

    expect(screen.queryByText('—')).toBeFalsy();
  });

  it('renders just the author when role is empty', () => {
    render(
      quoteConfig.render({
        id: 'test-id',
        quote: 'Una citazione di prova.',
        author: 'Maria Rossi',
        role: '',
        puck: puckContext,
      }),
    );

    expect(screen.getByText('Maria Rossi')).toBeTruthy();
  });
});
