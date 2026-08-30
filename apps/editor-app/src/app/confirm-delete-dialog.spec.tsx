import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDeleteDialog } from './confirm-delete-dialog';

describe('ConfirmDeleteDialog', () => {
  it('shows the given title and description', () => {
    render(
      <ConfirmDeleteDialog
        open
        onOpenChange={vi.fn()}
        title="Eliminare questa pagina?"
        description='"Chi siamo" verrà eliminata definitivamente.'
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByText('Eliminare questa pagina?')).toBeTruthy();
    expect(screen.getByText(/"Chi siamo"/)).toBeTruthy();
  });

  it('calls onConfirm when the destructive action is clicked', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDeleteDialog
        open
        onOpenChange={vi.fn()}
        title="Eliminare questo file?"
        description="Verrà eliminato definitivamente."
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^elimina$/i }));

    expect(onConfirm).toHaveBeenCalled();
  });

  it('does not call onConfirm when cancelled', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDeleteDialog
        open
        onOpenChange={vi.fn()}
        title="Eliminare questo modulo?"
        description="Verrà eliminato definitivamente."
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /annulla/i }));

    expect(onConfirm).not.toHaveBeenCalled();
  });
});
