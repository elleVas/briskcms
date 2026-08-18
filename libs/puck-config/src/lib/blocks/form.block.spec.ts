import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PuckContext } from '@puckeditor/core';
import { formConfig, formBlockPropsSchema } from './form.block.js';

const puckContext: PuckContext = {
  renderDropZone: () => null,
  metadata: {},
  isEditing: false,
  dragRef: null,
};

const form = { formId: 'form-1', formName: 'Contatti' };

describe('formBlockPropsSchema', () => {
  it('accepts valid Form props with a form selected', () => {
    const result = formBlockPropsSchema.safeParse({ form });
    expect(result.success).toBe(true);
  });

  it('accepts Form props with no form selected yet', () => {
    const result = formBlockPropsSchema.safeParse({ form: null });
    expect(result.success).toBe(true);
  });

  it('rejects Form props missing the form key', () => {
    const result = formBlockPropsSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('formConfig.render', () => {
  it("renders the form's name when a form is selected", () => {
    render(formConfig.render({ id: 'test-id', form, puck: puckContext }));

    expect(screen.getByText('Modulo: Contatti')).toBeTruthy();
  });

  it('renders a placeholder when no form is selected', () => {
    render(formConfig.render({ id: 'test-id', form: null, puck: puckContext }));

    expect(screen.getByText('Nessun modulo selezionato')).toBeTruthy();
  });
});
