import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PuckContext } from '@puckeditor/core';
import {
  accordionItemConfig,
  accordionItemPropsSchema,
} from './accordion-item.block.js';

const puckContext: PuckContext = {
  renderDropZone: () => null,
  metadata: {},
  isEditing: false,
  dragRef: null,
};

describe('accordionItemPropsSchema', () => {
  it('accepts a valid question/answer pair', () => {
    const result = accordionItemPropsSchema.safeParse({
      question: 'Come funziona?',
      answer: 'Facile.',
    });
    expect(result.success).toBe(true);
  });

  it('rejects props without a question', () => {
    const result = accordionItemPropsSchema.safeParse({ answer: 'Facile.' });
    expect(result.success).toBe(false);
  });
});

describe('accordionItemConfig.render', () => {
  it('renders the question and the answer', () => {
    render(
      accordionItemConfig.render({
        id: 'test-id',
        question: 'Come funziona?',
        answer: 'Facile.',
        puck: puckContext,
      }),
    );

    expect(screen.getByText('Come funziona?')).toBeTruthy();
    expect(screen.getByText('Facile.')).toBeTruthy();
  });
});

describe('accordionItemConfig.fields', () => {
  it('edits question and answer inline on the canvas instead of the sidebar', () => {
    expect(accordionItemConfig.fields?.question).toMatchObject({
      type: 'text',
      contentEditable: true,
      visible: false,
    });
    expect(accordionItemConfig.fields?.answer).toMatchObject({
      type: 'textarea',
      contentEditable: true,
      visible: false,
    });
  });
});
