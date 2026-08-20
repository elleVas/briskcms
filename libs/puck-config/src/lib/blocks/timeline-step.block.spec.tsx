import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PuckContext } from '@puckeditor/core';
import {
  timelineStepConfig,
  timelineStepPropsSchema,
} from './timeline-step.block.js';

const puckContext: PuckContext = {
  renderDropZone: () => null,
  metadata: {},
  isEditing: false,
  dragRef: null,
};

describe('timelineStepPropsSchema', () => {
  it('accepts valid TimelineStep props', () => {
    const result = timelineStepPropsSchema.safeParse({
      label: 'Fase 1',
      title: 'Analisi',
      description: 'Raccogliamo i requisiti.',
    });
    expect(result.success).toBe(true);
  });

  it('rejects props without a title', () => {
    const result = timelineStepPropsSchema.safeParse({
      label: 'Fase 1',
      description: 'Raccogliamo i requisiti.',
    });
    expect(result.success).toBe(false);
  });
});

describe('timelineStepConfig.render', () => {
  it('renders the label, title and description', () => {
    render(
      timelineStepConfig.render({
        id: 'test-id',
        label: 'Fase 1',
        title: 'Analisi',
        description: 'Raccogliamo i requisiti.',
        puck: puckContext,
      }),
    );

    expect(screen.getByText('Fase 1')).toBeTruthy();
    expect(screen.getByText('Analisi')).toBeTruthy();
    expect(screen.getByText('Raccogliamo i requisiti.')).toBeTruthy();
  });
});

describe('timelineStepConfig.fields', () => {
  it('edits label, title and description inline on the canvas', () => {
    expect(timelineStepConfig.fields?.label).toMatchObject({
      type: 'text',
      contentEditable: true,
      visible: false,
    });
    expect(timelineStepConfig.fields?.title).toMatchObject({
      type: 'text',
      contentEditable: true,
      visible: false,
    });
    expect(timelineStepConfig.fields?.description).toMatchObject({
      type: 'textarea',
      contentEditable: true,
      visible: false,
    });
  });
});
