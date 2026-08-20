import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { FormField } from '@brisk/shared-types';
import { TooltipProvider } from '../components/ui/tooltip.js';
import { FormFieldEditorRow } from './form-field-editor-row.js';

function renderRow(
  field: FormField,
  onChange: (field: FormField) => void = vi.fn(),
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
