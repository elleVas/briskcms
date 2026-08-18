import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PickedForm } from '@brisk/shared-types';
import { FormListContext } from '../form-list-context.js';
import { FormPickerField } from './form-picker-field.js';

const samplePicked: PickedForm = { formId: 'form-1', formName: 'Contatti' };

function renderField(
  value: PickedForm | null,
  onChange: (value: PickedForm | null) => void,
  pick: () => Promise<PickedForm | null>,
) {
  return render(
    <FormListContext.Provider value={{ pick }}>
      <FormPickerField value={value} onChange={onChange} />
    </FormListContext.Provider>,
  );
}

describe('FormPickerField', () => {
  it('shows "Scegli modulo" and no name when nothing is selected', () => {
    renderField(null, vi.fn(), vi.fn());

    expect(screen.getByText('Scegli modulo')).toBeTruthy();
    expect(screen.queryByText('Contatti')).toBeFalsy();
  });

  it('shows the form name and "Cambia modulo" when a form is selected', () => {
    renderField(samplePicked, vi.fn(), vi.fn());

    expect(screen.getByText('Contatti')).toBeTruthy();
    expect(screen.getByText('Cambia modulo')).toBeTruthy();
  });

  it('calls onChange with the picked form once the picker resolves', async () => {
    const onChange = vi.fn();
    const pick = vi.fn().mockResolvedValue(samplePicked);
    renderField(null, onChange, pick);

    fireEvent.click(screen.getByText('Scegli modulo'));
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith(samplePicked));
  });

  it('does not call onChange when the picker is dismissed without a selection', async () => {
    const onChange = vi.fn();
    const pick = vi.fn().mockResolvedValue(null);
    renderField(null, onChange, pick);

    fireEvent.click(screen.getByText('Scegli modulo'));
    await vi.waitFor(() => expect(pick).toHaveBeenCalled());
    expect(onChange).not.toHaveBeenCalled();
  });
});
