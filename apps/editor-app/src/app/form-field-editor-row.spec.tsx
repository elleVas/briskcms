import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { FormField, FormStep } from '@brisk/shared-types';
import { TooltipProvider } from '../components/ui/tooltip';
import { FormFieldEditorRow } from './form-field-editor-row';

function renderRow(
  field: FormField,
  onChange: (field: FormField) => void = vi.fn(),
  steps: FormStep[] = [],
) {
  return render(
    <TooltipProvider>
      <FormFieldEditorRow
        field={field}
        onChange={onChange}
        onRemove={vi.fn()}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
        canMoveUp={false}
        canMoveDown={false}
        steps={steps}
      />
    </TooltipProvider>,
  );
}

describe('FormFieldEditorRow', () => {
  it('updates the label', () => {
    const onChange = vi.fn();
    renderRow({ id: 'f1', label: '', type: 'text', required: false }, onChange);

    fireEvent.change(screen.getByLabelText('Etichetta'), {
      target: { value: 'Nome' },
    });

    expect(onChange).toHaveBeenCalledWith({
      id: 'f1',
      label: 'Nome',
      type: 'text',
      required: false,
    });
  });

  it('shows the options textarea only for the select type', () => {
    const { unmount } = renderRow({
      id: 'f1',
      label: 'x',
      type: 'text',
      required: false,
    });
    expect(screen.queryByLabelText(/opzioni/i)).toBeFalsy();
    unmount();

    renderRow({
      id: 'f2',
      label: 'x',
      type: 'select',
      required: false,
      options: [],
    });
    expect(screen.getByLabelText(/opzioni/i)).toBeTruthy();
  });

  it('keeps a newly typed blank line in the options textarea instead of collapsing it', () => {
    // Regression: an earlier version filtered out empty lines on every
    // keystroke, so pressing Enter after the first option immediately
    // erased the blank line it had just created — the user could never
    // get a cursor onto a second line to start typing the next option.
    // Sanitizing (trim + drop blanks) now happens once, at save time
    // (form-editor-view.tsx), not on every change here.
    const onChange = vi.fn();
    renderRow(
      {
        id: 'f1',
        label: 'x',
        type: 'select',
        required: false,
        options: ['Preventivo'],
      },
      onChange,
    );

    fireEvent.change(screen.getByLabelText(/opzioni/i), {
      target: { value: 'Preventivo\n' },
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ options: ['Preventivo', ''] }),
    );
  });

  it('lists newsletter-consent as a selectable type, with no options textarea', () => {
    renderRow({
      id: 'f1',
      label: 'x',
      type: 'newsletter-consent',
      required: false,
    });

    expect(
      screen.getByRole('option', { name: 'Iscrizione newsletter' }),
    ).toBeTruthy();
    expect(screen.queryByLabelText(/opzioni/i)).toBeFalsy();
  });

  it('lists date, time and file as selectable types, with no options textarea', () => {
    const { unmount: unmountDate } = renderRow({
      id: 'f1',
      label: 'x',
      type: 'date',
      required: false,
    });
    expect(screen.getByRole('option', { name: 'Data' })).toBeTruthy();
    expect(screen.queryByLabelText(/opzioni/i)).toBeFalsy();
    unmountDate();

    const { unmount: unmountTime } = renderRow({
      id: 'f2',
      label: 'x',
      type: 'time',
      required: false,
    });
    expect(screen.getByRole('option', { name: 'Ora' })).toBeTruthy();
    unmountTime();

    renderRow({ id: 'f3', label: 'x', type: 'file', required: false });
    expect(
      screen.getByRole('option', { name: 'Caricamento file' }),
    ).toBeTruthy();
    expect(screen.queryByLabelText(/opzioni/i)).toBeFalsy();
  });

  it('shows no step dropdown when the form has no steps', () => {
    renderRow(
      { id: 'f1', label: 'x', type: 'text', required: false },
      vi.fn(),
      [],
    );

    expect(screen.queryByLabelText('Step')).toBeFalsy();
  });

  it('shows a step dropdown listing every step, plus "no step", when the form has steps', () => {
    const steps: FormStep[] = [
      { id: 'step-1', title: 'Dati personali' },
      { id: 'step-2', title: 'Dettagli' },
    ];
    renderRow(
      { id: 'f1', label: 'x', type: 'text', required: false },
      vi.fn(),
      steps,
    );

    const select = screen.getByLabelText('Step') as HTMLSelectElement;
    expect(select.value).toBe('');
    expect(screen.getByRole('option', { name: 'Nessuno step' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Dati personali' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Dettagli' })).toBeTruthy();
  });

  it('assigns a field to a step and can clear it back to none', () => {
    const onChange = vi.fn();
    const steps: FormStep[] = [{ id: 'step-1', title: 'Dati personali' }];
    renderRow(
      { id: 'f1', label: 'x', type: 'text', required: false },
      onChange,
      steps,
    );

    fireEvent.change(screen.getByLabelText('Step'), {
      target: { value: 'step-1' },
    });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ stepId: 'step-1' }),
    );

    fireEvent.change(screen.getByLabelText('Step'), {
      target: { value: '' },
    });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ stepId: null }),
    );
  });

  it('toggles required', () => {
    const onChange = vi.fn();
    renderRow(
      { id: 'f1', label: 'x', type: 'text', required: false },
      onChange,
    );

    fireEvent.click(screen.getByRole('switch'));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ required: true }),
    );
  });
});
